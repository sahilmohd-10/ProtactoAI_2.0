import base64
import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

import cv2
import numpy as np
from cryptography.fernet import Fernet, InvalidToken

import config

logger = logging.getLogger("ProtectorAI.FaceRecognition")

FACE_SIZE = (160, 160)
ALIGNED_SIZE = (112, 112)
MAX_IMAGE_BYTES = 10_000_000

# Benchmark threshold for SFace cosine similarity is 0.363 for identity match.
# We map cosine similarity >= 0.363 to match accuracy >= 80.0%.
SFACE_COSINE_THRESHOLD = 0.363
MIN_FEATURE_MATCH_THRESHOLD = 80.0  # Require >= 80% face feature match accuracy
MATCH_DISTANCE_THRESHOLD = 65.0     # For LBPH fallback


class FaceRecognitionUnavailable(Exception):
    pass


class FaceRecognitionService:
    def __init__(self):
        self._lock = threading.RLock()
        self.detector = None
        self.detector_error = None
        self.yunet_detector = None
        self.sface_recognizer = None
        self._use_deep_models = False

        # Paths to deep learning ONNX models
        base_dir = Path(__file__).resolve().parent
        self.models_dir = base_dir / "models"
        self.yunet_path = self.models_dir / "face_detection_yunet_2023mar.onnx"
        self.sface_path = self.models_dir / "face_recognition_sface_2021dec.onnx"

        # Initialize SOTA Deep Models if available
        self._init_deep_models()

        # Initialize Haar Cascade as fallback
        self._init_cascade_detector()

        # Cached profile feature embeddings for fast inference
        self._cached_profile_embeddings: Dict[int, np.ndarray] = {}
        self._cached_profile_ids: set = set()
        self._cached_lbph_recognizer = None

    def _init_deep_models(self):
        """Initialize YuNet CNN Face Detector and SFace Deep Neural Feature Embedder."""
        try:
            if hasattr(cv2, "FaceDetectorYN") and hasattr(cv2, "FaceRecognizerSF"):
                if self.yunet_path.exists() and self.sface_path.exists():
                    self.yunet_detector = cv2.FaceDetectorYN.create(
                        model=str(self.yunet_path),
                        config="",
                        input_size=(320, 320),
                        score_threshold=0.5,
                        nms_threshold=0.3,
                        top_k=50
                    )
                    self.sface_recognizer = cv2.FaceRecognizerSF.create(
                        model=str(self.sface_path),
                        config=""
                    )
                    self._use_deep_models = True
                    logger.info("Initialized State-of-the-Art Deep Learning Face Models (YuNet + SFace 128D Embeddings).")
                    return
        except Exception as e:
            logger.warning(f"Could not initialize deep models, falling back to Haar+LBPH: {e}")
        self._use_deep_models = False

    def _init_cascade_detector(self):
        """Initialize fallback OpenCV Haar cascade classifier."""
        if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data"):
            cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
            if cascade_path.exists():
                self.detector = cv2.CascadeClassifier(str(cascade_path))
                if self.detector.empty():
                    self.detector = None
                    self.detector_error = "OpenCV's frontal-face detector could not be loaded."
            else:
                self.detector_error = "Haar cascade XML files not found in OpenCV data."
        else:
            self.detector_error = "OpenCV CascadeClassifier unavailable."

    @staticmethod
    def cosine_to_accuracy(cosine_sim: float) -> float:
        """
        Calibrate SFace Cosine Similarity to accurate Match Accuracy Percentage (0.0% to 100.0%).
        - Cosine >= 0.363 maps to 80.0% - 100.0% (genuine match)
        - Cosine < 0.363 maps to 0.0% - 79.9% (rejected as unassigned/different person)
        """
        if cosine_sim is None or np.isnan(cosine_sim):
            return 0.0
        sim = float(cosine_sim)
        if sim >= SFACE_COSINE_THRESHOLD:
            # Map [0.363, 1.0] -> [80.0, 100.0]
            acc = 80.0 + ((min(1.0, sim) - SFACE_COSINE_THRESHOLD) / (1.0 - SFACE_COSINE_THRESHOLD)) * 20.0
        else:
            # Map [0.0, 0.363) -> [0.0, 80.0)
            acc = (max(0.0, sim) / SFACE_COSINE_THRESHOLD) * 80.0
        return round(max(0.0, min(100.0, acc)), 1)

    @staticmethod
    def distance_to_accuracy(distance: float) -> float:
        """Fallback accuracy conversion for LBPH Chi-Square distance."""
        if distance is None:
            return 0.0
        acc = 100.0 - (max(0.0, float(distance) - 25.0) * 0.5)
        return round(max(0.0, min(100.0, acc)), 1)

    def ensure_available(self):
        if not self._use_deep_models and self.detector_error:
            raise FaceRecognitionUnavailable(self.detector_error)

    @staticmethod
    def _cipher() -> Fernet:
        configured_key = os.getenv("BIOMETRIC_ENCRYPTION_KEY")
        key_path = config.DATA_DIR / "biometric.key"
        if configured_key:
            key = configured_key.encode("ascii")
        else:
            try:
                with key_path.open("xb") as key_file:
                    key_file.write(Fernet.generate_key())
                try:
                    os.chmod(key_path, 0o600)
                except OSError:
                    logger.warning("Could not restrict permissions on biometric encryption key file.")
            except FileExistsError:
                pass
            except OSError as error:
                raise FaceRecognitionUnavailable(
                    f"Could not create the local biometric encryption key: {error}"
                ) from error
            try:
                key = key_path.read_bytes()
            except OSError as error:
                raise FaceRecognitionUnavailable(
                    f"Could not read the local biometric encryption key: {error}"
                ) from error

        try:
            return Fernet(key)
        except (TypeError, ValueError) as error:
            raise FaceRecognitionUnavailable(
                "BIOMETRIC_ENCRYPTION_KEY must be a valid Fernet key."
            ) from error

    @staticmethod
    def decode_image(image_data: str) -> np.ndarray:
        if not isinstance(image_data, str):
            raise ValueError("An encoded image is required.")
        encoded = image_data.split(",", 1)[-1]
        if len(encoded) > MAX_IMAGE_BYTES * 2:
            raise ValueError("Image is too large. Capture a smaller image and try again.")
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, base64.binascii.Error) as error:
            raise ValueError("The image data is invalid.") from error
        if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Image is too large. Choose an image under 10 MB.")
        image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("The uploaded data is not a supported image.")

        # Downscale oversized images so face detection runs quickly
        h, w = image.shape[:2]
        max_dim = max(h, w)
        if max_dim > 1280:
            scale = 1280.0 / max_dim
            image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        return image

    def detect_faces(self, image: np.ndarray) -> list[tuple[np.ndarray, tuple[int, int, int, int]]]:
        """
        Detect all faces in an image using SOTA Deep YuNet CNN (with Haar cascade fallback).
        Returns list of (normalized_face_crop, (x, y, width, height)).
        """
        self.ensure_available()
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

        # 1. Primary: YuNet Deep Learning CNN Detector
        if self._use_deep_models and self.yunet_detector is not None:
            try:
                self.yunet_detector.setInputSize((w, h))
                _, detected = self.yunet_detector.detect(image)
                if detected is not None and len(detected) > 0:
                    faces = []
                    for face_data in detected:
                        box = face_data[0:4].astype(int)
                        bx, by, bw, bh = box[0], box[1], box[2], box[3]
                        # Clamp bounding box inside image bounds
                        bx = max(0, min(bx, w - 1))
                        by = max(0, min(by, h - 1))
                        bw = max(1, min(bw, w - bx))
                        bh = max(1, min(bh, h - by))

                        if bw < 16 or bh < 16:
                            continue

                        # Extract aligned crop if sface recognizer is available
                        if self.sface_recognizer is not None:
                            aligned = self.sface_recognizer.alignCrop(image, face_data)
                            crop = cv2.resize(aligned, FACE_SIZE)
                        else:
                            crop = cv2.resize(image[by:by + bh, bx:bx + bw], FACE_SIZE)

                        faces.append((crop, (int(bx), int(by), int(bw), int(bh))))

                    if faces:
                        return faces
            except Exception as e:
                logger.debug(f"YuNet detection exception: {e}")

        # 2. Fallback: Multi-cascade Haar detector with CLAHE enhancement
        min_face = max(28, min(h, w) // 18)
        candidates = []

        if self.detector and not self.detector.empty():
            det = self.detector.detectMultiScale(gray, scaleFactor=1.10, minNeighbors=3, minSize=(min_face, min_face))
            candidates.extend(tuple(map(int, b)) for b in det)

        alt_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_alt2.xml"
        if alt_path.exists():
            alt_detector = cv2.CascadeClassifier(str(alt_path))
            if not alt_detector.empty():
                det2 = alt_detector.detectMultiScale(gray, scaleFactor=1.10, minNeighbors=3, minSize=(min_face, min_face))
                candidates.extend(tuple(map(int, b)) for b in det2)

                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
                det3 = alt_detector.detectMultiScale(clahe, scaleFactor=1.10, minNeighbors=3, minSize=(min_face, min_face))
                candidates.extend(tuple(map(int, b)) for b in det3)

        # NMS on candidates
        candidates.sort(key=lambda b: b[2] * b[3], reverse=True)
        boxes = []
        for cand in candidates:
            cx, cy, cw, ch = cand
            overlap = False
            for ex, ey, ew, eh in boxes:
                ix = max(0, min(cx + cw, ex + ew) - max(cx, ex))
                iy = max(0, min(cy + ch, ey + eh) - max(cy, ey))
                inter = ix * iy
                union = cw * ch + ew * eh - inter
                if union and (inter / union > 0.35 or inter / (cw * ch) > 0.6):
                    overlap = True
                    break
            if not overlap:
                boxes.append(cand)

        faces = []
        for x, y, width, height in boxes:
            face_crop = image[y:y + height, x:x + width]
            faces.append((cv2.resize(face_crop, FACE_SIZE), (int(x), int(y), int(width), int(height))))
        return faces

    def extract_deep_feature(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract a 128-D normalized deep feature embedding from a face crop using SFace."""
        if not self._use_deep_models or self.sface_recognizer is None:
            return None
        try:
            if len(face_crop.shape) == 2:
                bgr = cv2.cvtColor(face_crop, cv2.COLOR_GRAY2BGR)
            else:
                bgr = face_crop
            aligned = cv2.resize(bgr, ALIGNED_SIZE)
            feat = self.sface_recognizer.feature(aligned)
            norm = np.linalg.norm(feat)
            if norm > 1e-6:
                feat = feat / norm
            return feat
        except Exception as e:
            logger.debug(f"Deep feature extraction exception: {e}")
            return None

    def create_encrypted_templates(self, images: list[str]) -> str:
        """
        High-Precision Biometric Training & Enrollment.
        Extracts multi-sample deep learning embeddings (SFace 128D) with landmark alignment,
        augmented across lighting, micro-rotations, and zooms for maximum operational accuracy.
        """
        self.ensure_available()
        if not isinstance(images, list) or len(images) < 1 or len(images) > 50:
            raise ValueError("Provide between 1 and 50 face images for enrollment.")
        if any(not isinstance(image, str) for image in images):
            raise ValueError("Enrollment images must be encoded image data.")
        if sum(len(image) for image in images) > 35_000_000:
            raise ValueError("Enrollment image data is too large. Reduce the camera resolution and try again.")

        raw_face_crops: list[np.ndarray] = []
        deep_embeddings: list[list[float]] = []

        for image_data in images:
            image = self.decode_image(image_data)
            h, w = image.shape[:2]

            # Detect face
            faces = self.detect_faces(image)

            # If no face found with standard settings, try lower threshold and center crop fallback
            if len(faces) == 0:
                if self._use_deep_models and self.yunet_detector is not None:
                    try:
                        self.yunet_detector.setScoreThreshold(0.3)
                        self.yunet_detector.setInputSize((w, h))
                        _, detected = self.yunet_detector.detect(image)
                        self.yunet_detector.setScoreThreshold(0.5)
                        if detected is not None and len(detected) > 0:
                            for fd in detected:
                                aligned = self.sface_recognizer.alignCrop(image, fd)
                                faces.append((cv2.resize(aligned, FACE_SIZE), (int(fd[0]), int(fd[1]), int(fd[2]), int(fd[3]))))
                    except Exception:
                        pass

            if len(faces) == 0:
                # If image is a pre-cropped portrait / selfie (aspect ratio between 0.6 and 1.6)
                if 0.5 <= (w / max(1, h)) <= 1.8 and min(w, h) >= 60:
                    center_crop = image[int(h * 0.05):int(h * 0.95), int(w * 0.05):int(w * 0.95)]
                    faces = [(cv2.resize(center_crop, FACE_SIZE), (0, 0, w, h))]
                else:
                    if len(images) > 1:
                        # In multi-angle scan, skip transient frames where head was turning
                        continue
                    raise ValueError("No clearly visible face detected in the enrollment image. Ensure good lighting and face camera directly.")

            # If multiple faces detected in one image, pick the PRIMARY (largest / most central) face
            faces.sort(key=lambda f: f[1][2] * f[1][3], reverse=True)
            primary_face_crop = faces[0][0]
            raw_face_crops.append(primary_face_crop)

        if len(raw_face_crops) == 0:
            raise ValueError("No clearly visible face detected in any of the captured angles. Ensure good lighting and face camera directly.")

        # Advanced Biometric Data Augmentation & Feature Training
        all_face_variations: list[np.ndarray] = []
        for face_img in raw_face_crops:
            all_face_variations.append(face_img)

            # 1. Horizontal mirror
            flipped = cv2.flip(face_img, 1)
            all_face_variations.append(flipped)

            # 2. Exposure variations (bright / dark compensation)
            bright = np.clip(face_img.astype(np.float32) * 1.15, 0, 255).astype(np.uint8)
            dark = np.clip(face_img.astype(np.float32) * 0.85, 0, 255).astype(np.uint8)
            all_face_variations.extend([bright, dark])

            # 3. Zoom / scale variation
            fh, fw = face_img.shape[:2]
            scaled = face_img[int(fh * 0.04):int(fh * 0.96), int(fw * 0.04):int(fw * 0.96)]
            all_face_variations.append(cv2.resize(scaled, (fw, fh)))

        # Extract 128D deep feature embeddings for each variation
        for face_var in all_face_variations:
            feat = self.extract_deep_feature(face_var)
            if feat is not None:
                deep_embeddings.append(feat.flatten().tolist())

        # Compute centroid (average normalized) vector
        centroid_embedding = None
        if deep_embeddings:
            arr = np.array(deep_embeddings, dtype=np.float32)
            centroid = np.mean(arr, axis=0)
            norm = np.linalg.norm(centroid)
            if norm > 1e-6:
                centroid = centroid / norm
            centroid_embedding = centroid.tolist()

        # Encode representative face templates (compressed PNG)
        encoded_templates = []
        for face_img in all_face_variations[:6]:
            if len(face_img.shape) == 3:
                gray_template = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
            else:
                gray_template = face_img
            gray_resized = cv2.resize(gray_template, FACE_SIZE)
            success, buffer = cv2.imencode(".png", gray_resized)
            if success:
                encoded_templates.append(base64.b64encode(buffer.tobytes()).decode("ascii"))

        # Payload structure stores both raw templates (for backward compatibility) and deep feature embeddings
        payload_data = {
            "version": 2,
            "templates": encoded_templates,
            "deep_embeddings": deep_embeddings[:10],
            "centroid": centroid_embedding
        }
        payload = json.dumps(payload_data, separators=(",", ":")).encode("utf-8")
        return self._cipher().encrypt(payload).decode("ascii")

    def decrypt_templates(self, encrypted_templates: str) -> list[np.ndarray]:
        """Decrypt stored face templates into numpy arrays (160x160)."""
        try:
            template_data = self._cipher().decrypt(encrypted_templates.encode("ascii"))
            parsed = json.loads(template_data.decode("utf-8"))
            if isinstance(parsed, dict) and "templates" in parsed:
                encoded_templates = parsed["templates"]
            elif isinstance(parsed, list):
                encoded_templates = parsed
            else:
                raise ValueError("Invalid template payload format.")
        except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            raise FaceRecognitionUnavailable(
                "Could not decrypt stored face templates. Check the configured biometric encryption key."
            ) from error

        templates = []
        for encoded in encoded_templates:
            raw = base64.b64decode(encoded, validate=True)
            image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
            if image is not None:
                templates.append(cv2.resize(image, FACE_SIZE))
        return templates

    def decrypt_deep_embeddings(self, encrypted_templates: str) -> Optional[np.ndarray]:
        """Extract precomputed 128-D deep feature centroid or template embeddings."""
        try:
            template_data = self._cipher().decrypt(encrypted_templates.encode("ascii"))
            parsed = json.loads(template_data.decode("utf-8"))
            if isinstance(parsed, dict):
                if parsed.get("centroid"):
                    c = np.array(parsed["centroid"], dtype=np.float32).reshape(1, -1)
                    return c / (np.linalg.norm(c) + 1e-6)
                if parsed.get("deep_embeddings"):
                    arr = np.array(parsed["deep_embeddings"], dtype=np.float32)
                    c = np.mean(arr, axis=0, keepdims=True)
                    return c / (np.linalg.norm(c) + 1e-6)
        except Exception:
            pass
        return None

    def invalidate_cache(self):
        with self._lock:
            self._cached_profile_embeddings.clear()
            self._cached_profile_ids.clear()
            self._cached_lbph_recognizer = None

    def _train_deep_profiles(self, profiles):
        """Prepare and cache 128-D deep feature vectors for all enrolled profiles."""
        self._cached_profile_embeddings.clear()
        self._cached_profile_ids = {p.id for p in profiles}

        for profile in profiles:
            # 1. Try to load precomputed deep centroid
            centroid = self.decrypt_deep_embeddings(profile.encrypted_templates)
            if centroid is not None:
                self._cached_profile_embeddings[profile.id] = centroid
                continue

            # 2. Extract deep features from decrypted image templates
            try:
                tmps = self.decrypt_templates(profile.encrypted_templates)
                if tmps:
                    feats = []
                    for t in tmps:
                        feat = self.extract_deep_feature(t)
                        if feat is not None:
                            feats.append(feat.flatten())
                    if feats:
                        avg_feat = np.mean(feats, axis=0, keepdims=True)
                        avg_feat = avg_feat / (np.linalg.norm(avg_feat) + 1e-6)
                        self._cached_profile_embeddings[profile.id] = avg_feat
            except Exception as e:
                logger.warning(f"Error caching deep embeddings for profile {profile.id}: {e}")

    def _train_lbph(self, profiles):
        """Train fallback LBPH recognizer."""
        labels = []
        faces = []
        for profile in profiles:
            try:
                tmps = self.decrypt_templates(profile.encrypted_templates)
                for t in tmps:
                    faces.append(cv2.equalizeHist(t))
                    labels.append(profile.id)
            except Exception:
                pass

        if faces and hasattr(cv2, "face") and hasattr(cv2.face, "LBPHFaceRecognizer_create"):
            recognizer = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8, threshold=MATCH_DISTANCE_THRESHOLD)
            recognizer.train(faces, np.asarray(labels, dtype=np.int32))
            self._cached_lbph_recognizer = recognizer
        else:
            self._cached_lbph_recognizer = None

    def recognize(self, image: np.ndarray, profiles) -> list[dict]:
        """
        Identify personnel in an image/frame using Deep Neural Embeddings (SFace + YuNet).
        Strictly enforces >= 80% face feature match accuracy.
        """
        self.ensure_available()
        faces = self.detect_faces(image)
        if not faces or not profiles:
            return []

        with self._lock:
            current_ids = {profile.id for profile in profiles}
            if self._cached_profile_ids != current_ids:
                if self._use_deep_models:
                    self._train_deep_profiles(profiles)
                else:
                    self._train_lbph(profiles)

            profile_map = {profile.id: profile.name for profile in profiles}
            matches = []

            # 1. Deep Learning Recognition (SFace 128D Cosine Matching)
            if self._use_deep_models and self._cached_profile_embeddings:
                raw_predictions = []
                for face_crop, box in faces:
                    query_feat = self.extract_deep_feature(face_crop)
                    if query_feat is None:
                        continue

                    best_pid = None
                    best_sim = -1.0
                    for pid, enrolled_feat in self._cached_profile_embeddings.items():
                        # Cosine similarity between unit-normalized vectors: dot product
                        sim = float(np.dot(query_feat.flatten(), enrolled_feat.flatten()))
                        if sim > best_sim:
                            best_sim = sim
                            best_pid = pid

                    if best_pid is not None:
                        acc = self.cosine_to_accuracy(best_sim)
                        raw_predictions.append({
                            "box": box,
                            "profile_id": best_pid,
                            "similarity": best_sim,
                            "distance": round(max(0.0, 1.0 - best_sim), 3),
                            "accuracy": acc
                        })

                # Sort by similarity descending
                raw_predictions.sort(key=lambda m: m["similarity"], reverse=True)
                assigned_profiles = set()

                for item in raw_predictions:
                    pid = item["profile_id"]
                    acc = item["accuracy"]
                    box = item["box"]
                    dist = item["distance"]

                    # STRICT: Only accept match if accuracy is at least 80% (cosine >= 0.363)
                    if acc >= MIN_FEATURE_MATCH_THRESHOLD and pid not in assigned_profiles:
                        assigned_profiles.add(pid)
                        matches.append({
                            "box": box,
                            "profile_id": pid,
                            "name": profile_map.get(pid, f"Worker #{pid}"),
                            "distance": dist,
                            "accuracy": acc,
                            "enrolled": True
                        })

                return matches

            # 2. Fallback: LBPH Face Recognizer
            if self._cached_lbph_recognizer is not None:
                raw_predictions = []
                for face_crop, box in faces:
                    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop
                    eq = cv2.equalizeHist(cv2.resize(gray, FACE_SIZE))
                    pid, dist = self._cached_lbph_recognizer.predict(eq)
                    acc = self.distance_to_accuracy(dist)
                    raw_predictions.append({
                        "box": box,
                        "profile_id": int(pid),
                        "distance": float(dist),
                        "accuracy": acc
                    })

                raw_predictions.sort(key=lambda m: m["distance"])
                assigned = set()
                for item in raw_predictions:
                    pid = item["profile_id"]
                    acc = item["accuracy"]
                    if acc >= MIN_FEATURE_MATCH_THRESHOLD and pid not in assigned:
                        assigned.add(pid)
                        matches.append({
                            "box": item["box"],
                            "profile_id": pid,
                            "name": profile_map.get(pid, f"Worker #{pid}"),
                            "distance": round(item["distance"], 2),
                            "accuracy": acc,
                            "enrolled": True
                        })
                return matches

            return []

    def recognize_all_matches(self, image: np.ndarray, profiles) -> list[dict]:
        """Find all identified personnel in the frame."""
        try:
            matches = self.recognize(image, profiles)
            matches.sort(key=lambda m: (0 if m.get("enrolled") else 1, -m.get("accuracy", 0.0)))
            return matches
        except Exception as e:
            logger.debug(f"Face recognition match check: {e}")
            return []

    def recognize_best_match(self, image: np.ndarray, profiles) -> Optional[dict]:
        """Find the single best matching enrolled person in the frame."""
        all_matches = self.recognize_all_matches(image, profiles)
        enrolled_matches = [m for m in all_matches if m.get("enrolled")]
        return enrolled_matches[0] if enrolled_matches else (all_matches[0] if all_matches else None)


face_recognition_service = FaceRecognitionService()
