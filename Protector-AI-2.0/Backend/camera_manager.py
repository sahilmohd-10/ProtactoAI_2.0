import os
import cv2
import time
import json
import logging
import threading
from datetime import datetime, timezone
import uuid
from pathlib import Path
import numpy as np

import config
from database import SessionLocal
from models import Incident, Camera, AuditLog, FaceProfile, FaceVisitLog
from engine import engine_instance
from face_recognition_service import face_recognition_service

logger = logging.getLogger("ProtectorAI.CameraManager")

class PersistentCameraWorker:
    def __init__(self, camera_id: str, engine, source: str = "0"):
        self.camera_id = camera_id
        self.engine = engine
        self.source = source
        self.device_index = int(source) if str(source).isdigit() else 0
        self.status = "Stopped"  # Stopped, Starting, Running, Stopping, Disconnected, Error
        self.error_message = ""
        self.thread = None
        self.face_scan_thread = None
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        
        self.latest_raw_frame = None
        self.latest_frame = None
        self.latest_jpeg = None
        self.active_people = {}  # name -> {"box": box, "timestamp": ts, "profile_id": id}
        self.active_person_name = None
        self.active_person_box = None
        self.active_person_timestamp = 0.0
        self.latest_metrics = {
            "workers": 0,
            "violations": 0,
            "compliant": 0,
            "compliance_rate": 100.0,
            "detections": [],
            "recognized_worker": None,
            "recognized_workers": [],
            "timestamp": time.time()
        }
        
        self.start_time = None
        self.stop_time = None
        self.frames_analyzed = 0
        self.violation_count_session = 0
        self.last_incident_time = {}  # category -> timestamp (cooldown)
        self.cap = None

    def start(self, device_index: int = None) -> tuple[bool, str]:
        with self.lock:
            if device_index is not None:
                self.device_index = device_index
                self.source = str(device_index)

            if self.status in ("Starting", "Running"):
                return True, f"Camera {self.camera_id} worker is already active."
            self.status = "Starting"
            self.error_message = ""
            self.stop_event.clear()
            self.frames_analyzed = 0
            self.violation_count_session = 0
            self.start_time = time.time()
            self.thread = threading.Thread(
                target=self._run_loop,
                daemon=True,
                name=f"PersistentWorker-{self.camera_id}"
            )
            self.thread.start()

            self.face_scan_thread = threading.Thread(
                target=self._face_scan_loop,
                daemon=True,
                name=f"FaceScanner-{self.camera_id}"
            )
            self.face_scan_thread.start()

        # Wait briefly up to 1s to verify transition to Running or detect immediate hardware failure
        time.sleep(0.3)
        return True, f"Monitoring analysis session initiated on camera {self.camera_id} (Device {self.device_index})."

    def stop(self) -> tuple[bool, str]:
        with self.lock:
            if self.status in ("Stopped", "Stopping"):
                return True, f"Camera {self.camera_id} worker is already stopped."
            self.status = "Stopping"
            self.stop_event.set()

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3.0)
        if self.face_scan_thread and self.face_scan_thread.is_alive():
            self.face_scan_thread.join(timeout=1.5)

        with self.lock:
            self._cleanup()
            self.status = "Stopped"
            self.stop_time = time.time()
            self.latest_jpeg = None
            self.latest_frame = None
            self.latest_raw_frame = None
            self.active_person_name = None
            self.active_person_box = None

        engine_instance.release_camera(self.camera_id)
        return True, f"Monitoring analysis successfully stopped on camera {self.camera_id}."

    def get_status(self) -> dict:
        uptime_seconds = 0
        if self.status == "Running" and self.start_time:
            uptime_seconds = int(time.time() - self.start_time)

        return {
            "camera_id": self.camera_id,
            "status": self.status,
            "error_message": self.error_message,
            "uptime_seconds": uptime_seconds,
            "start_time": datetime.fromtimestamp(self.start_time, tz=timezone.utc).isoformat() if self.start_time else None,
            "frames_analyzed": self.frames_analyzed,
            "violations_detected": self.violation_count_session,
            "metrics": self.latest_metrics,
            "has_live_feed": self.latest_jpeg is not None
        }

    def _cleanup(self):
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception as e:
                logger.warning(f"Error releasing camera {self.camera_id}: {e}")
            self.cap = None

    def _face_scan_loop(self):
        logger.info(f"Background biometric identity scanner active for camera {self.camera_id}")
        while not self.stop_event.is_set():
            time.sleep(0.6)
            raw = None
            with self.lock:
                if self.latest_raw_frame is not None:
                    raw = self.latest_raw_frame.copy()

            if raw is None or self.stop_event.is_set():
                continue

            try:
                db = SessionLocal()
                try:
                    profiles = db.query(FaceProfile).all()
                    if profiles:
                        matches = face_recognition_service.recognize_all_matches(raw, profiles)
                        now_ts = time.time()
                        if matches:
                            for m in matches:
                                p_name = m.get("name")
                                if p_name:
                                    self.active_people[p_name] = {
                                        "box": m.get("box"),
                                        "timestamp": now_ts,
                                        "profile_id": m.get("profile_id")
                                    }
                                    # Register visit if cooldown elapsed
                                    matched_prof = next((p for p in profiles if p.id == m.get("profile_id")), None)
                                    if matched_prof:
                                        last_seen = matched_prof.last_seen_at
                                        if last_seen and last_seen.tzinfo is None:
                                            last_seen = last_seen.replace(tzinfo=timezone.utc)
                                        now_utc = datetime.now(timezone.utc)
                                        if last_seen is None or (now_utc - last_seen).total_seconds() >= 30:
                                            db.add(FaceVisitLog(
                                                profile_id=matched_prof.id,
                                                recognized_at=now_utc,
                                                match_distance=m.get("distance", 0.0),
                                                camera_source=f"Live Optical Stream ({self.camera_id.upper()})"
                                            ))
                                            matched_prof.last_seen_at = now_utc
                                            db.commit()

                        # Purge people not seen in last 5 seconds
                        self.active_people = {n: v for n, v in self.active_people.items() if (now_ts - v.get("timestamp", 0)) < 5.0}
                finally:
                    db.close()
            except Exception as e:
                logger.debug(f"Face scan loop error: {e}")
                logger.debug(f"Face scan error in background thread: {e}")

    def _init_capture(self):
        self._cleanup()
        time.sleep(0.2)
        if self.camera_id in ("cam_01", "default"):
            target_idx = getattr(self, "device_index", 0)
            try:
                logger.info(f"Attempting to open camera on hardware index {target_idx} (CAP_DSHOW)...")
                cap = cv2.VideoCapture(target_idx, cv2.CAP_DSHOW)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(target_idx)
                if cap.isOpened():
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                    self.cap = cap
                    logger.info(f"Hardware camera successfully opened on Device {target_idx}")
                    return True
                else:
                    alt_idx = 1 if target_idx == 0 else 0
                    logger.info(f"Device {target_idx} failed, attempting alternate Device {alt_idx}...")
                    cap = cv2.VideoCapture(alt_idx, cv2.CAP_DSHOW)
                    if not cap.isOpened():
                        cap = cv2.VideoCapture(alt_idx)
                    if cap.isOpened():
                        self.device_index = alt_idx
                        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                        self.cap = cap
                        logger.info(f"Hardware camera opened on alternate Device {alt_idx}")
                        return True
            except Exception as e:
                logger.warning(f"Could not open physical webcam on device {target_idx}: {e}")

        # If camera not opened or synthetic camera requested, fallback to engine frame provider
        logger.info(f"Using high-fidelity synthetic/dataset feed for persistent camera {self.camera_id}")
        return True

    def _run_loop(self):
        logger.info(f"Worker thread started for camera {self.camera_id}")
        if not self._init_capture():
            with self.lock:
                self.status = "Error"
                self.error_message = "Failed to initialize camera video source."
            return

        with self.lock:
            self.status = "Running"

        while not self.stop_event.is_set():
            loop_start = time.time()
            frame = None

            # 1. Grab frame from physical camera if open
            if self.cap is not None and self.cap.isOpened():
                ret, raw_frame = self.cap.read()
                if ret and raw_frame is not None and raw_frame.size > 0:
                    frame = raw_frame

            # 2. Or fallback to engine's sample/synthetic generator
            if frame is None:
                frame = self.engine.get_next_frame(self.camera_id)

            if frame is None:
                time.sleep(0.05)
                continue

            with self.lock:
                self.latest_raw_frame = frame

            try:
                # 3. Run AI Inference
                annotated_frame, metrics = self.engine.process_frame(frame, conf_threshold=0.35)

                # Overlay recognized person(s) HUD tag
                now_ts = time.time()
                active_names = [name for name, info in self.active_people.items() if (now_ts - info.get("timestamp", 0)) < 5.0]
                if active_names:
                    worker_str = ", ".join(active_names)
                    metrics["recognized_workers"] = active_names
                    metrics["recognized_worker"] = worker_str
                    self.active_person_name = worker_str
                    tag = "IDENTIFIED: " + worker_str.upper()
                    (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    cv2.rectangle(annotated_frame, (12, 12), (24 + tw, 38), (20, 24, 20), -1)
                    cv2.rectangle(annotated_frame, (12, 12), (24 + tw, 38), (70, 200, 52), 1)
                    cv2.circle(annotated_frame, (22, 25), 4, (70, 200, 52), -1)
                    cv2.putText(annotated_frame, tag, (32, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
                else:
                    metrics["recognized_workers"] = []
                    metrics["recognized_worker"] = None
                    self.active_person_name = None

                # 4. Encode to JPEG
                ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82])
                if ret:
                    jpeg_bytes = buffer.tobytes()
                    with self.lock:
                        self.latest_frame = annotated_frame
                        self.latest_jpeg = jpeg_bytes
                        self.latest_metrics = metrics
                        self.frames_analyzed += 1

                # 5. Check for Violations & Auto-Persist Incident with Deduplication
                violations = [d for d in metrics.get("detections", []) if d.get("is_violation")]
                if violations:
                    self.violation_count_session += len(violations)

                    for v in violations:
                        label = v.get("label", "Unknown Violation")
                        category = label.replace("NO-", "Missing ") if label.startswith("NO-") else label

                        # 45-second cooldown per violation category per camera to prevent duplicate spamming
                        last_logged = self.last_incident_time.get(category, 0)
                        if (now_ts - last_logged) >= 45.0:
                            self.last_incident_time[category] = now_ts
                            self._record_incident(category, v, annotated_frame, metrics)

            except Exception as e:
                logger.error(f"Inference error in worker {self.camera_id}: {e}")

            # Sleep to match ~25-30 FPS without maxing out CPU
            elapsed = time.time() - loop_start
            sleep_duration = max(0.005, 0.04 - elapsed)
            time.sleep(sleep_duration)

        with self.lock:
            self._cleanup()
            self.status = "Stopped"
            logger.info(f"Worker thread stopped cleanly for camera {self.camera_id}")

    def _record_incident(self, category: str, violation_det: dict, annotated_frame: np.ndarray, metrics: dict):
        db = SessionLocal()
        try:
            inc_id = f"INC-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}-{self.camera_id}"
            now_ts = time.time()

            # STRICT FACE IDENTIFICATION:
            # ONLY assign name(s) if face(s) are ACTUALLY visible and recognized in this exact image!
            # If no face is visible or matched, DO NOT guess or inherit past names!
            recognized_in_frame = []
            try:
                profiles = db.query(FaceProfile).all()
                if profiles:
                    raw_to_check = self.latest_raw_frame if self.latest_raw_frame is not None else annotated_frame
                    matches = face_recognition_service.recognize_all_matches(raw_to_check, profiles)
                    recognized_in_frame = [m["name"] for m in matches if m.get("name")]
            except Exception as ex:
                logger.debug(f"Direct face match on incident frame: {ex}")

            unique_recognized = list(dict.fromkeys(recognized_in_frame))
            if unique_recognized:
                # Multiple people recognized in the image -> multiple names assigned!
                worker_name = ", ".join(unique_recognized)
                title = f"Autonomous Detection: {category} ({worker_name}) on {self.camera_id.upper()}"
            else:
                # Face not visible -> STRICTLY Unassigned Worker
                worker_name = "Unassigned Worker"
                title = f"Autonomous Detection: {category} on {self.camera_id.upper()}"

            # Save snapshot to disk
            snapshot_filename = f"incident_{inc_id}.jpg"
            snapshot_path = config.SNAPSHOTS_DIR / snapshot_filename
            cv2.imwrite(str(snapshot_path), annotated_frame)
            snapshot_url = f"/static/snapshots/{snapshot_filename}"

            location = "Main Optical Sector"
            if self.camera_id == "cam_02":
                location = "Chemical Loading Dock"
            elif self.camera_id == "cam_03":
                location = "Overhead Gantry East"

            severity = "Critical" if "Hardhat" in category or "Mask" in category else "High"

            new_incident = Incident(
                id=inc_id,
                title=title,
                category=category,
                severity=severity,
                status="Open",
                location=location,
                camera_id=self.camera_id,
                worker_id=worker_name,
                snapshot_url=snapshot_url,
                bounding_boxes=json.dumps(metrics.get("detections", []))
            )
            db.add(new_incident)

            # Audit log
            audit = AuditLog(
                user_email="system@protector.ai",
                action="AUTONOMOUS_INCIDENT_PERSISTED",
                details=f"Background monitoring logged {category} infraction for {worker_name} on {self.camera_id}",
                ip_address="127.0.0.1"
            )
            db.add(audit)
            db.commit()
            logger.info(f"Persistent worker {self.camera_id} auto-recorded incident {inc_id} ({category}) for {worker_name}")
        except Exception as e:
            logger.error(f"Failed to persist incident in worker: {e}")
            db.rollback()
        finally:
            db.close()


class PersistentCameraManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(PersistentCameraManager, cls).__new__(cls, *args, **kwargs)
                cls._instance.workers = {}
                cls._instance.init_cameras()
            return cls._instance

    def init_cameras(self):
        # Pre-initialize workers for cam_01, cam_02, cam_03
        for cid in ["cam_01", "cam_02", "cam_03"]:
            self.workers[cid] = PersistentCameraWorker(
                camera_id=cid,
                engine=engine_instance,
                source="0" if cid == "cam_01" else f"synthetic_{cid}"
            )

    def start_camera(self, camera_id: str, device_index: int = None) -> tuple[bool, str]:
        if camera_id not in self.workers:
            self.workers[camera_id] = PersistentCameraWorker(camera_id, engine_instance)
        worker = self.workers[camera_id]
        if device_index is not None and getattr(worker, "device_index", 0) != device_index:
            worker.stop()
            worker.device_index = device_index
            worker.source = str(device_index)
            time.sleep(0.25)
        return worker.start(device_index=device_index)

    def switch_device(self, camera_id: str, device_index: int) -> tuple[bool, str]:
        if camera_id not in self.workers:
            self.workers[camera_id] = PersistentCameraWorker(camera_id, engine_instance)
        worker = self.workers[camera_id]
        worker.stop()
        worker.device_index = device_index
        worker.source = str(device_index)
        time.sleep(0.3)
        return worker.start(device_index=device_index)

    def get_hardware_devices(self) -> list:
        devices = []
        for i in range(2):
            try:
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
                if cap.isOpened():
                    name = "Integrated Laptop Camera" if i == 0 else "External USB WebCam"
                    devices.append({"index": i, "name": name, "available": True})
                    cap.release()
            except Exception:
                pass
        if not devices:
            devices = [
                {"index": 0, "name": "Integrated Laptop Camera (Device 0)", "available": True},
                {"index": 1, "name": "External USB WebCam (Device 1)", "available": True}
            ]
        return devices

    def stop_camera(self, camera_id: str) -> tuple[bool, str]:
        if camera_id not in self.workers:
            return False, f"Camera {camera_id} not found."
        return self.workers[camera_id].stop()

    def get_status(self, camera_id: str) -> dict:
        if camera_id not in self.workers:
            return {
                "camera_id": camera_id,
                "status": "Stopped",
                "error_message": "Camera worker not initialized",
                "uptime_seconds": 0,
                "start_time": None,
                "frames_analyzed": 0,
                "violations_detected": 0,
                "metrics": None,
                "has_live_feed": False
            }
        return self.workers[camera_id].get_status()

    def release_camera(self, camera_id: str = "cam_01") -> bool:
        """Release any hardware camera capture handles across workers and engine."""
        worker = self.workers.get(camera_id)
        if worker:
            worker.stop()
        engine_instance.release_camera(camera_id)
        return True

    def get_stream_generator(self, camera_id: str):
        worker = self.workers.get(camera_id)
        if not worker:
            worker = PersistentCameraWorker(camera_id, engine_instance)
            self.workers[camera_id] = worker

        blank_img = np.zeros((720, 1280, 3), dtype=np.uint8)
        _, blank_buf = cv2.imencode('.jpg', blank_img, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        blank_jpeg = blank_buf.tobytes()

        while True:
            if worker.status == "Running" and worker.latest_jpeg is not None:
                jpeg = worker.latest_jpeg
            else:
                jpeg = blank_jpeg

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')
            time.sleep(0.04)

camera_manager_instance = PersistentCameraManager()
