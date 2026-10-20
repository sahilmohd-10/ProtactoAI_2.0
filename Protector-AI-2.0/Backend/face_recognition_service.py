import base64
import json
import logging
import os
import threading
from pathlib import Path

import cv2
import numpy as np
from cryptography.fernet import Fernet, InvalidToken

import config

logger = logging.getLogger("ProtectorAI.FaceRecognition")

FACE_SIZE = (160, 160)
MAX_IMAGE_BYTES = 10_000_000
MATCH_DISTANCE_THRESHOLD = 68.0


class FaceRecognitionUnavailable(Exception):
    pass


class FaceRecognitionService:
    def __init__(self):
        self.detector = None
        if not hasattr(cv2, "CascadeClassifier") or not hasattr(cv2, "data"):
            self.detector_error = (
                "Install backend requirements with 'pip install -r requirements.txt', "
                "then restart the backend to enable face matching."
            )
        elif not hasattr(cv2, "face") or not hasattr(cv2.face, "LBPHFaceRecognizer_create"):
            self.detector_error = "Install the opencv-contrib-python dependency to enable local face matching."
        else:
            cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
            self.detector = cv2.CascadeClassifier(str(cascade_path))
            self.detector_error = (
                None if not self.detector.empty()
                else "OpenCV's frontal-face detector could not be loaded."
            )
        self._lock = threading.RLock()
        self._cached_recognizer = None
        self._cached_labels = set()

    def ensure_available(self):
        if self.detector_error:
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
        self.ensure_available()
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        min_face = max(36, min(image.shape[:2]) // 14)
        candidates = []

        # Try default frontal face detector first
        if self.detector and not self.detector.empty():
            detected = self.detector.detectMultiScale(
                gray,
                scaleFactor=1.15,
                minNeighbors=4,
                minSize=(min_face, min_face)
            )
            candidates.extend(tuple(map(int, box)) for box in detected)

        # Fallback to alt detector only if primary detector found no candidates
        if not candidates:
            alt_detector = cv2.CascadeClassifier(
                str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_alt2.xml")
            )
            if not alt_detector.empty():
                detected = alt_detector.detectMultiScale(
                    gray,
                    scaleFactor=1.15,
                    minNeighbors=4,
                    minSize=(min_face, min_face)
                )
                candidates.extend(tuple(map(int, box)) for box in detected)

                if not candidates:
                    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
                    detected = alt_detector.detectMultiScale(
                        enhanced,
                        scaleFactor=1.15,
                        minNeighbors=4,
                        minSize=(min_face, min_face)
                    )
                    candidates.extend(tuple(map(int, box)) for box in detected)

        candidates.sort(key=lambda box: box[2] * box[3], reverse=True)
        boxes = []
        for candidate in candidates:
            x, y, width, height = candidate
            overlaps_existing = False
            for existing in boxes:
                ex, ey, ew, eh = existing
                intersection_width = max(0, min(x + width, ex + ew) - max(x, ex))
                intersection_height = max(0, min(y + height, ey + eh) - max(y, ey))
                intersection = intersection_width * intersection_height
                union = width * height + ew * eh - intersection
                if union and intersection / union > 0.4:
                    overlaps_existing = True
                    break
            if not overlaps_existing:
                boxes.append(candidate)

        faces = []
        for x, y, width, height in boxes:
            normalized = cv2.equalizeHist(gray[y:y + height, x:x + width])
            faces.append((cv2.resize(normalized, FACE_SIZE), (int(x), int(y), int(width), int(height))))
        return faces

    def create_encrypted_templates(self, images: list[str]) -> str:
        self.ensure_available()
        if not isinstance(images, list) or len(images) < 1 or len(images) > 10:
            raise ValueError("Provide between 1 and 10 face images for enrollment.")
        if any(not isinstance(image, str) for image in images):
            raise ValueError("Enrollment images must be encoded image data.")
        if sum(len(image) for image in images) > 25_000_000:
            raise ValueError("Enrollment image data is too large. Reduce the camera resolution and try again.")

        raw_faces: list[np.ndarray] = []
        for image_data in images:
            image = self.decode_image(image_data)
            faces = self.detect_faces(image)
            if len(faces) != 1:
                raise ValueError(
                    f"Each enrollment image must show exactly one clearly visible face (found {len(faces)})."
                )
            raw_faces.append(faces[0][0])

        # If user provided 1 or 2 images, generate variations (flip, contrast/brightness, crop)
        # to ensure LBPH classifier has 5 robust templates for matching
        all_face_variations = list(raw_faces)
        if len(all_face_variations) < 3:
            for face in raw_faces:
                # 1. Horizontal flip
                all_face_variations.append(cv2.flip(face, 1))
                # 2. Brightness variation +15
                brighter = np.clip(face.astype(np.int16) + 15, 0, 255).astype(np.uint8)
                all_face_variations.append(brighter)
                # 3. Brightness variation -15
                darker = np.clip(face.astype(np.int16) - 15, 0, 255).astype(np.uint8)
                all_face_variations.append(darker)
                # 4. Center crop zoom
                h, w = face.shape[:2]
                crop = face[int(h * 0.04):int(h * 0.96), int(w * 0.04):int(w * 0.96)]
                all_face_variations.append(cv2.resize(crop, (w, h)))
                if len(all_face_variations) >= 5:
                    break

        encoded_templates = []
        for face_img in all_face_variations[:8]:
            success, buffer = cv2.imencode(".png", face_img)
            if not success:
                raise ValueError("Could not prepare the face template.")
            encoded_templates.append(base64.b64encode(buffer.tobytes()).decode("ascii"))

        payload = json.dumps(encoded_templates, separators=(",", ":")).encode("utf-8")
        return self._cipher().encrypt(payload).decode("ascii")

    def decrypt_templates(self, encrypted_templates: str) -> list[np.ndarray]:
        try:
            template_data = self._cipher().decrypt(encrypted_templates.encode("ascii"))
            encoded_templates = json.loads(template_data.decode("utf-8"))
        except (InvalidToken, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise FaceRecognitionUnavailable(
                "Could not decrypt stored face templates. Check the configured biometric encryption key."
            ) from error

        templates = []
        for encoded in encoded_templates:
            raw = base64.b64decode(encoded, validate=True)
            image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
            if image is None or image.shape != FACE_SIZE[::-1]:
                raise FaceRecognitionUnavailable("A stored face template is invalid.")
            templates.append(image)
        return templates

    def invalidate_cache(self):
        with self._lock:
            self._cached_recognizer = None
            self._cached_labels.clear()

    def _train(self, profiles):
        labels = np.asarray(
            [profile.id for profile, templates in profiles for _ in templates],
            dtype=np.int32
        )
        faces = [face for _, templates in profiles for face in templates]
        if not faces:
            self._cached_recognizer = None
            self._cached_labels.clear()
            return
        recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=1,
            neighbors=8,
            grid_x=8,
            grid_y=8,
            threshold=MATCH_DISTANCE_THRESHOLD
        )
        recognizer.train(faces, labels)
        self._cached_recognizer = recognizer
        self._cached_labels = {profile.id for profile, _ in profiles}

    def recognize(self, image: np.ndarray, profiles) -> list[dict]:
        self.ensure_available()
        faces = self.detect_faces(image)
        if not faces or not profiles:
            return []

        with self._lock:
            if self._cached_recognizer is None or self._cached_labels != {profile.id for profile in profiles}:
                decoded_profiles = []
                for profile in profiles:
                    try:
                        tmps = self.decrypt_templates(profile.encrypted_templates)
                        if tmps:
                            decoded_profiles.append((profile, tmps))
                    except Exception as err:
                        logger.warning(f"Skipping profile {getattr(profile, 'id', None)} ({getattr(profile, 'name', '')}) due to decrypt issue: {err}")
                self._train(decoded_profiles)

            if self._cached_recognizer is None:
                return [{"box": box, "profile_id": None, "distance": None} for _, box in faces]

            matches = []
            profile_map = {profile.id: profile.name for profile in profiles}
            for face, box in faces:
                profile_id, distance = self._cached_recognizer.predict(face)
                known_id = int(profile_id) if distance <= MATCH_DISTANCE_THRESHOLD else None
                matches.append({
                    "box": box,
                    "profile_id": known_id,
                    "name": profile_map.get(known_id) if known_id else None,
                    "distance": round(float(distance), 2)
                })
            return matches

    def recognize_all_matches(self, image: np.ndarray, profiles) -> list[dict]:
        """Find all matching enrolled people in the given image/frame."""
        try:
            matches = self.recognize(image, profiles)
            valid_matches = [m for m in matches if m.get("profile_id") and m.get("name")]
            # Sort by distance (highest confidence first)
            valid_matches.sort(key=lambda m: m.get("distance", 999.0))
            return valid_matches
        except Exception as e:
            logger.debug(f"Face recognition match check: {e}")
            return []

    def recognize_best_match(self, image: np.ndarray, profiles) -> dict | None:
        """Find the best matching enrolled person in the given image/frame."""
        valid_matches = self.recognize_all_matches(image, profiles)
        return valid_matches[0] if valid_matches else None


face_recognition_service = FaceRecognitionService()
