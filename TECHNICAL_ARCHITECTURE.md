# Protector AI 2.0 — Technical System Architecture & Operational Pipeline

This document provides a complete technical deep-dive into how **Protector AI 2.0** ingests visual input, executes real-time neural network inference, performs biometric face recognition, tracks industrial safety compliance, and streams telemetry to the modern Apple HIG-inspired dashboard panel.

---

## 1. System Architecture Overview

```
                                      ┌─────────────────────────────────────────────────────────┐
                                      │                    VISUAL INPUT LAYER                   │
                                      │  [Physical WebCam / RTSP]      [Direct Browser WebRTC]  │
                                      │     OpenCV CAP_DSHOW             getUserMedia Canvas    │
                                      └────────────┬────────────────────────────┬───────────────┘
                                                   │                            │
                                            Hardware Video Feed        Base64 Frames (HTTP POST)
                                                   │                            │
                                                   ▼                            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND ENGINE PIPELINE                                    │
│                                                                                               │
│   ┌──────────────────────────────────┐               ┌────────────────────────────────────┐   │
│   │   Real-Time YOLOv8 PPE Engine    │               │  Biometric Identity Scanner Loop   │   │
│   │        (best.pt - 87.6 MB)       │               │   (Dual Haar Cascade + CLAHE)      │   │
│   │  • 25 Hazard & PPE Classes       │               │   (LBPH Recognizer + AES Cipher)   │   │
│   │  • Box Bounding & Classification │               │   • Multi-person distinct matching │   │
│   │  • Compliance Rate Calculation   │               │   • Filter unenrolled clutter      │   │
│   └─────────────────┬────────────────┘               └─────────────────┬──────────────────┘   │
│                     │                                                  │                      │
│                     └────────────────────────┬─────────────────────────┘                      │
│                                              ▼                                                │
│                                ┌───────────────────────────┐                                  │
│                                │ Frame Compositor & Overlay│                                  │
│                                │ • Cyan/Crimson/Gold Boxes │                                  │
│                                │ • Identified Worker Badges│                                  │
│                                │ • Incident Auto-Snapshots │                                  │
│                                └─────────────┬─────────────┘                                  │
└──────────────────────────────────────────────┼────────────────────────────────────────────────┘
                                               │
                                 MJPEG Stream & JSON Telemetry
                                               │
                                               ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND LIVE CONSOLE & DASHBOARD                              │
│                                                                                               │
│   ┌───────────────────────────────┐  ┌────────────────────────────────────────────────────┐   │
│   │     Central Optical Canvas    │  │                 Telemetry & Stats                  │   │
│   │ • Hardware Device 0 / WebRTC  │  │ • Live Compliance Rate Gauge (%)                   │   │
│   │ • Dynamic MJPEG / HTML5 Canvas│  │ • Worker Count & Active Violation Count            │   │
│   │ • Optical Fleet Camera Switch │  │ • Identified Personnel Badges (Mohd Sahil, Alok...)│   │
│   └───────────────────────────────┘  │ • Audio Alarm Engine on Safety Infractions         │   │
│                                      └────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Image Input & Ingestion Architecture

Protector AI 2.0 features a **dual-pipeline video ingestion engine** capable of dynamically switching between native OS hardware drivers and zero-install client browser cameras.

### A. Hardware Device Mode (`Device 0` via OpenCV)
- **Source**: Directly captures from physical USB webcams, industrial cameras, or RTSP/IP camera streams using OpenCV.
- **Driver**: On Windows, the backend utilizes `cv2.CAP_DSHOW` (DirectShow) for low-latency hardware initialization, falling back to standard V4L2/AVFoundation on Linux/macOS.
- **Resolution**: Configured to $1280 \times 720$ (720p HD) at 30 FPS.
- **Threading Model**: 
  - Main acquisition loop: Runs in a dedicated background `WorkerThread` (`camera_manager.py`).
  - Face recognition loop: Runs in a separate asynchronous daemon thread (`FaceScannerThread`) executing every $600\text{ms}$ to prevent CPU/GPU bottlenecks in the video stream.
- **Streaming**: Encodes analyzed frames into JPEG buffers (`cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])`) and streams them as an **MJPEG multipart HTTP response** (`multipart/x-mixed-replace; boundary=frame`) directly into the frontend `<img>` element.

### B. Direct Browser WebCam Mode (WebRTC + Base64 Inference)
- **Source**: Browser captures video using `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })`.
- **Inference Loop**:
  1. An offscreen HTML5 `<canvas>` draws the current `<video>` frame at an interval of $300\text{ms}$.
  2. Canvas converts the frame into an ultra-compressed Base64 JPEG string: `canvas.toDataURL('image/jpeg', 0.65)`.
  3. The client sends a lightweight `POST /api/cameras/<id>/infer_frame` request containing the frame.
  4. Backend runs YOLOv8 and biometric verification on the payload and returns JSON detections, compliance percentages, and identified personnel names.
  5. The frontend draws sleek Apple HIG vector bounding boxes directly over the live HTML5 `<video>` element.

### C. Hardware Conflict Handover Protocol
Operating systems like Windows lock camera hardware to a single process via DirectShow. To enable instant toggling between hardware streaming and browser streaming without "Device in Use" crashes:
1. When switching to **Browser Mode**, the frontend calls `POST /api/cameras/<id>/release_hardware`.
2. The backend immediately releases the `cv2.VideoCapture` handle and unblocks the OS driver.
3. The browser safely opens `getUserMedia`.
4. When switching back to **Hardware Mode**, the browser stops all `MediaStreamTrack`s, releases the camera handle, and commands the backend to re-initialize `cv2.CAP_DSHOW`.

---

## 3. Computer Vision & YOLOv8 PPE Inference Engine

The core object detection model resides in [`Protector-AI-2.0/Backend/engine.py`](file:///d:/Downloads/ProtectoAI/Protector-AI-2.0/Backend/engine.py) utilizing custom-trained weights ([`best.pt`](file:///d:/Downloads/ProtectoAI/Protector-AI-2.0/Backend/best.pt), 87.6 MB).

### A. Detection Classes & Categorization
The model detects 25 distinct industrial classes divided into three categories:

| Category | Classes | Visualization |
| :--- | :--- | :--- |
| **Compliant PPE** | `Hardhat`, `Safety Vest`, `Mask`, `Gloves`, `Safety Boots`, `Safety Glasses`, `Person` | **Emerald Green** (`#34C759`) bounding boxes |
| **Safety Violations** | `NO-Hardhat`, `NO-Safety Vest`, `NO-Mask`, `NO-Gloves`, `NO-Boots` | **Crimson Red** (`#FF3B30`) bounding boxes with warning labels |
| **Industrial Hazards** | `Fire`, `Smoke`, `Fall Hazard`, `Heavy Machinery`, `Restricted Zone Breach` | **Amber Gold** (`#FF9500`) alert boxes |

### B. Quantitative Compliance Formula
The compliance rate shown on your panel is calculated frame-by-frame:

$$\text{Compliance Rate} = \begin{cases} 
100\% & \text{if } N_{\text{violations}} = 0 \\
\max\left(0\%, \left(1.0 - \frac{N_{\text{violations}}}{N_{\text{compliant}} + N_{\text{violations}}}\right) \times 100\right) & \text{if } N_{\text{violations}} > 0 
\end{cases}$$

Where:
- $N_{\text{workers}}$: Number of detected `Person` boxes or recognized enrolled personnel.
- $N_{\text{violations}}$: Total active non-compliant equipment infractions detected in the current scene.
- $N_{\text{compliant}}$: Total verified safety gear items detected on workers.

---

## 4. Biometric Face Recognition & Worker Identification Pipeline

The biometric recognition system in [`Protector-AI-2.0/Backend/face_recognition_service.py`](file:///d:/Downloads/ProtectoAI/Protector-AI-2.0/Backend/face_recognition_service.py) guarantees privacy-first, on-premise worker identification with multi-person resolution.

```
       Input Frame (1280x720)
                 │
                 ▼
  Dual Haar Cascades + CLAHE Normalization
  (haarcascade_frontalface_default + alt2)
                 │
                 ▼
       Non-Maximum Suppression (NMS)
           (IoU > 0.35 Filter)
                 │
                 ▼
  Extracted Normalized Faces (160x160 Grayscale)
                 │
                 ▼
  Decrypted Biometric Templates (Fernet AES-128)
                 │
                 ▼
     LBPH Face Recognizer Inference
   (Distance <= 75.0 & Distinct Name Guard)
                 │
                 ▼
   Identified Personnel Badges & 30s Visit Log
```

### A. Multi-Scale Dual-Cascade Face Discovery
To catch faces in harsh construction lighting or angled camera poses:
1. **Primary Detector**: OpenCV default frontal face Haar cascade (`haarcascade_frontalface_default.xml`, scale 1.10, min neighbors 3).
2. **Secondary Detector**: Haar alt2 cascade (`haarcascade_frontalface_alt2.xml`) specializing in tilted or side profiles.
3. **CLAHE Enhancement**: Contrast Limited Adaptive Histogram Equalization (`clipLimit=2.0`, `tileGridSize=(8,8)`) is applied to boost discovery under deep shadows, glare, or backlight.
4. **Non-Maximum Suppression (NMS)**: Overlapping face bounding boxes (Intersection over Union $> 0.35$) are merged into a single distinct face target.

### B. Biometric Privacy & Fernet AES Encryption
- Raw camera snapshots are **never** stored unencrypted.
- During enrollment, face crops are normalized to $160 \times 160$ pixels, histogram equalized, and augmented with 5 variations (horizontal flip, brightness $+15$, brightness $-15$, and center crops).
- Face templates are serialized into JSON and encrypted using **Fernet AES-128-CBC with HMAC-SHA256 authentication**.
- The key is saved locally in `Backend/data/biometric.key` (with POSIX `0o600` permissions), completely air-gapped from cloud vendors.

### C. LBPH Recognition & Distinct Identity Guard
- **Algorithm**: Local Binary Patterns Histograms (`cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)`).
- **Match Distance Threshold**: Set to `75.0` (optimal threshold balancing false positives and angular variation).
- **Distinct Identity Guard**: Two faces in the same camera view can never be assigned the same enrolled name. If two candidates match the same person, the one with the lowest distance metric is assigned the name; the other is evaluated for remaining profiles.
- **Unregistered Filter Rule**: Faces of unenrolled individuals are strictly suppressed from the panel. Only verified enrolled personnel (e.g. **Mohd Sahil**, **Alok**, **Faisal**) are populated in the **Identified Worker** badge strip.
- **Automated Attendance / Visit Logging**: When an enrolled worker enters the frame, a record is added to `FaceVisitLog` with a 30-second deduplication cooldown.

---

## 5. Live Panel & Dashboard Architecture

The user interface in [`Protector-AI-2.0/Frontend/src/components/LiveConsole.tsx`](file:///d:/Downloads/ProtectoAI/Protector-AI-2.0/Frontend/src/components/LiveConsole.tsx) provides a mission-critical safety station:

### 1. Central Optical Viewport (`01 / OPTICAL OBSERVATION`)
- Houses the active video canvas with stream health status (`LIVE 720P HD`, `30 FPS`).
- Supports one-click switching between **Hardware Device 0** and **Direct Browser WebCam**.
- Instant action button: `START ANALYSIS` / `STOP ANALYSIS` triggering asynchronous worker lifecycle transitions.

### 2. Optical Fleet Grid (`02 / OPTICAL FLEET`)
- Displays all configured factory cameras:
  - `Real Camera — Live WebCam` (Hardware Device 0)
  - `Direct Browser WebCam` (Client WebRTC)
  - `Simulated Zone Cameras` (High-definition synthetic industrial safety feeds for multi-zone stress testing)

### 3. Quantitative Compliance Summary (`03 / COMPLIANCE RATE`)
- **Large Monospace Gauge**: Displays live safety compliance from `0%` to `100%`.
- **Status Indicator**: Dynamic color shifting (`Optimal` in emerald green vs `Infraction Flagged` in danger crimson).
- **Worker & Violation Counts**: Distinct counters for personnel present and active safety hazards.

### 4. Identified Personnel Live Badges
- Appears dynamically when enrolled personnel enter camera range.
- Formats single worker (`IDENTIFIED WORKER: Mohd Sahil`) or multiple personnel (`IDENTIFIED PERSONNEL (2): Mohd Sahil · Alok`).
- Backed by biometric verification timestamps and face recognition confidence metrics.

### 5. Violation Audio Alarm
- When violations are detected in real-time, the panel can trigger an audible frequency buzzer to alert plant operators immediately without requiring manual screen observation.

### 6. Incident Snapshot Storage
- When a severe infraction occurs, the backend grabs a high-resolution snapshot, writes it to `Backend/static/snapshots/`, and creates an immutable entry in the `Incident` database table with camera ID, timestamp, and severity rating.

---

## 6. API Reference (Backend Services)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cameras` | Lists all optical camera feeds and their online/offline states. |
| `GET` | `/api/cameras/<id>/stream` | MJPEG real-time video stream with YOLOv8 & biometric overlays. |
| `POST` | `/api/cameras/<id>/infer_frame` | Processes a Base64 frame captured from browser WebRTC. |
| `POST` | `/api/cameras/<id>/worker/start` | Starts background hardware acquisition and face scanning threads. |
| `POST` | `/api/cameras/<id>/worker/stop` | Stops camera threads and safely releases video drivers. |
| `POST` | `/api/cameras/<id>/release_hardware`| Unlocks physical OS camera handle for browser handover. |
| `POST` | `/api/biometrics/enroll` | Enrolls a worker profile with encrypted face templates. |
| `GET` | `/api/biometrics/profiles` | Retrieves list of registered personnel. |
| `GET` | `/api/biometrics/attendance` | Fetches biometric face visit and entry logs. |
| `POST` | `/api/command/execute` | Executes commands through the safety Command Terminal. |
| `POST` | `/api/copilot/chat` | AI Operations Copilot reasoning and signed safety tool calls. |

---

## 7. Verification & Operational Guidelines

- **Run Backend Verification**:
  ```bash
  cd Protector-AI-2.0/Backend
  python tests/test_all.py
  ```
- **Run Frontend Build Check**:
  ```bash
  cd Protector-AI-2.0/Frontend
  npm run build
  ```
- **Biometric Database Location**: `Protector-AI-2.0/Backend/data/protector_ai.db`
- **Biometric Encryption Key**: `Protector-AI-2.0/Backend/data/biometric.key` (Must remain strictly local; never commit to Git).
