import os
import cv2
import time
import glob
import json
import logging
from pathlib import Path
import numpy as np
from ultralytics import YOLO

import config

logger = logging.getLogger("ProtectorAI.Engine")
logging.basicConfig(level=logging.INFO)

class PPEInferenceEngine:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(PPEInferenceEngine, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self.model_path = config.MODEL_PATH
        self.model = None
        self.classes = config.PPE_CLASSES
        self.compliant_classes = config.COMPLIANT_CLASSES
        self.violation_classes = config.VIOLATION_CLASSES
        self.hazard_classes = config.HAZARD_CLASSES

        self.active_cameras = {}
        self.sample_images = []
        self._sample_index = 0

        self._load_model()
        self._load_sample_images()
        self._initialized = True

    def _load_model(self):
        try:
            logger.info(f"Loading YOLO model from: {self.model_path}")
            self.model = YOLO(self.model_path)
            # Update classes from model if available
            if hasattr(self.model, "names") and isinstance(self.model.names, dict):
                self.classes = self.model.names
            logger.info(f"Model successfully loaded. Classes count: {len(self.classes)}")
        except Exception as e:
            logger.error(f"Failed to load model from {self.model_path}: {e}. Falling back to yolov8n.pt")
            try:
                self.model = YOLO("yolov8n.pt")
            except Exception as ex:
                logger.error(f"Fallback model failed: {ex}")
                self.model = None

    def _load_sample_images(self):
        if config.DATASET_SAMPLE_DIR.exists():
            imgs = list(config.DATASET_SAMPLE_DIR.glob("*.jpg")) + list(config.DATASET_SAMPLE_DIR.glob("*.png"))
            self.sample_images = [str(p) for p in imgs]
            logger.info(f"Loaded {len(self.sample_images)} sample validation frames for streaming fallback.")

    def get_model_info(self):
        return {
            "model_path": self.model_path,
            "status": "online" if self.model is not None else "offline",
            "classes_count": len(self.classes),
            "classes": self.classes,
            "compliant_classes": list(self.compliant_classes),
            "violation_classes": list(self.violation_classes),
            "hazard_classes": list(self.hazard_classes),
            "device": "CUDA" if (hasattr(self.model, "device") and "cuda" in str(self.model.device).lower()) else "CPU"
        }

    def _get_camera_capture(self, camera_id="cam_01"):
        if camera_id in self.active_cameras:
            cap = self.active_cameras[camera_id]
            if cap.isOpened():
                return cap

        if camera_id == "cam_01":
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(0)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                self.active_cameras[camera_id] = cap
                return cap

        return None

    def release_camera(self, camera_id="cam_01"):
        """Release the camera hardware device so it can be accessed by browser or other clients."""
        for cid in list(self.active_cameras.keys()):
            try:
                cap = self.active_cameras.pop(cid, None)
                if cap is not None:
                    cap.release()
                    logger.info(f"Released hardware capture for camera {cid}")
            except Exception as e:
                logger.warning(f"Error releasing camera {cid}: {e}")

    def get_next_frame(self, camera_id="cam_01"):
        cap = self._get_camera_capture(camera_id)
        if cap and cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None and frame.size > 0:
                return frame

        # If camera not opened or secondary synthetic camera requested, use sample images
        if self.sample_images:
            idx = (self._sample_index + (1 if camera_id == "cam_02" else 3)) % len(self.sample_images)
            self._sample_index = (self._sample_index + 1) % len(self.sample_images)
            img = cv2.imread(self.sample_images[idx])
            if img is not None:
                return cv2.resize(img, (1280, 720))

        # Synthetic fallback frame
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        img[:] = (20, 24, 33)  # Apple dark slate
        cv2.putText(img, f"PROTECTOR AI 2.0 — {camera_id.upper()} FEED ACTIVE", (80, 120),
                    cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2)
        cv2.putText(img, "YOLOv8 Real-Time PPE Inference Online", (80, 180),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 120, 0), 2)
        cv2.putText(img, f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC')}", (80, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 180, 180), 1)
        return img

    def process_frame(self, frame, conf_threshold=0.35, target_classes=None):
        if frame is None or self.model is None:
            return frame, {"workers": 0, "violations": 0, "compliant": 0, "compliance_rate": 100.0, "detections": []}

        h, w = frame.shape[:2]
        results = self.model(frame, conf=conf_threshold, verbose=False)

        detections = []
        worker_count = 0
        compliant_count = 0
        violation_count = 0

        annotated_frame = frame.copy()

        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                label = self.classes.get(cls_id, f"Class {cls_id}")

                if target_classes and label not in target_classes and label != "Person":
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                # Clamp coordinates
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                is_violation = label in self.violation_classes
                is_compliant = label in self.compliant_classes
                is_person = (label == "Person")

                if is_person:
                    worker_count += 1
                elif is_violation:
                    violation_count += 1
                elif is_compliant:
                    compliant_count += 1

                # Color coding (Apple style: muted, refined semantic tones in BGR)
                if is_violation:
                    color = (48, 56, 235)       # Apple Red #EB3830
                    bg_color = (35, 42, 180)
                elif is_compliant:
                    color = (70, 200, 52)       # Apple Green #34C759
                    bg_color = (50, 150, 38)
                elif is_person:
                    color = (220, 220, 225)     # Apple Light Graphite #E5E5EA
                    bg_color = (120, 120, 130)
                else:
                    color = (0, 149, 255)       # Apple Safety Amber #FF9500
                    bg_color = (0, 110, 200)

                # Draw bounding box
                thickness = 2 if is_person else 3
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, thickness)

                # Corner accent lines for high-tech HUD look
                line_len = min(20, (x2 - x1) // 4, (y2 - y1) // 4)
                if line_len > 4:
                    cv2.line(annotated_frame, (x1, y1), (x1 + line_len, y1), color, thickness + 1)
                    cv2.line(annotated_frame, (x1, y1), (x1, y1 + line_len), color, thickness + 1)
                    cv2.line(annotated_frame, (x2, y1), (x2 - line_len, y1), color, thickness + 1)
                    cv2.line(annotated_frame, (x2, y1), (x2, y1 + line_len), color, thickness + 1)
                    cv2.line(annotated_frame, (x1, y2), (x1 + line_len, y2), color, thickness + 1)
                    cv2.line(annotated_frame, (x1, y2), (x1, y2 - line_len), color, thickness + 1)
                    cv2.line(annotated_frame, (x2, y2), (x2 - line_len, y2), color, thickness + 1)
                    cv2.line(annotated_frame, (x2, y2), (x2, y2 - line_len), color, thickness + 1)

                # Label tag pill
                tag_text = f"{label} {int(conf * 100)}%"
                (tw, th), baseline = cv2.getTextSize(tag_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(annotated_frame, (x1, max(0, y1 - 22)), (x1 + tw + 12, max(0, y1)), bg_color, -1)
                cv2.putText(annotated_frame, tag_text, (x1 + 6, max(0, y1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

                detections.append({
                    "label": label,
                    "confidence": round(conf, 2),
                    "box": [x1, y1, x2, y2],
                    "is_violation": is_violation,
                    "is_compliant": is_compliant
                })

        # Calculate compliance
        total_eval = compliant_count + violation_count
        if total_eval > 0:
            compliance_rate = round((compliant_count / total_eval) * 100.0, 1)
        else:
            compliance_rate = 100.0 if worker_count > 0 else 100.0

        # Bounding boxes and violation labels are drawn cleanly on the frame.
        # Top-level HUD telemetry is rendered by the modern React UI overlay.

        metrics = {
            "workers": worker_count,
            "violations": violation_count,
            "compliant": compliant_count,
            "compliance_rate": compliance_rate,
            "detections": detections,
            "timestamp": time.time()
        }

        return annotated_frame, metrics

    def generate_stream(self, camera_id="cam_01", conf_threshold=0.35, target_classes=None):
        while True:
            frame = self.get_next_frame(camera_id)
            if frame is None:
                time.sleep(0.04)
                continue

            annotated_frame, _ = self.process_frame(frame, conf_threshold=conf_threshold, target_classes=target_classes)

            # Encode as JPEG
            ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ret:
                time.sleep(0.04)
                continue

            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.033)  # ~30 FPS

    def capture_snapshot(self, camera_id="cam_01", conf_threshold=0.35):
        frame = self.get_next_frame(camera_id)
        if frame is None:
            return None, None

        annotated_frame, metrics = self.process_frame(frame, conf_threshold=conf_threshold)

        snapshot_filename = f"snap_{int(time.time())}_{camera_id}.jpg"
        snapshot_path = config.SNAPSHOTS_DIR / snapshot_filename
        cv2.imwrite(str(snapshot_path), annotated_frame)

        return f"/static/snapshots/{snapshot_filename}", metrics

engine_instance = PPEInferenceEngine()
