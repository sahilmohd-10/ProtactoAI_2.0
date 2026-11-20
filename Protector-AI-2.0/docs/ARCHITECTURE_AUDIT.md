# System Architecture Audit: Protector AI 2.0
**Document Version**: 2.0.0  
**Date**: November 2026  
**Auditor**: Principal Software & Systems Architect  
**Repository**: `https://github.com/sahilmohd-10/ProtactoAI_2.0.git`

---

## 1. System Overview & Topological Hierarchy

Protector AI 2.0 is an enterprise-grade industrial computer vision and worker safety intelligence platform designed for high-throughput manufacturing, construction, and hazardous environments. It executes real-time multi-person PPE compliance monitoring, autonomous facial biometric identification, shift and punctuality recording, and OSHA violation intelligence.

```
+-------------------------------------------------------------------------------------------------+
|                                        FRONTEND CLIENT                                          |
|                  React 19 | Vite | TypeScript | Lucide Icons | Apple HIG Design System          |
|                                     http://localhost:5173                                       |
+-------------------------------------------------------------------------------------------------+
                                               |
                                     HTTP REST / JSON Polling
                                               |
+-------------------------------------------------------------------------------------------------+
|                                        BACKEND SERVER                                           |
|                              Flask 3.1.3 | WSGI Server | Python 3.10+                           |
|                                    http://127.0.0.1:5000                                        |
|                                                                                                 |
|  +--------------------+  +----------------------+  +---------------------+  +----------------+  |
|  |   Camera Manager   |  |   Computer Vision    |  |  Face Recognition   |  |   Attendance   |  |
|  | Multi-Thread Engine|  | YOLOv8 (25 classes)  |  | SFace + YuNet Deep  |  | Multi-Tab Sync |  |
|  +--------------------+  +----------------------+  +---------------------+  +----------------+  |
|            |                        |                         |                      |          |
|  +--------------------+  +----------------------+  +---------------------+  +----------------+  |
|  | Hardware CAP_DSHOW |  | OpenRouter / Local   |  | AES-256 Fernet Key  |  | Excel & CSV    |  |
|  | WebCam (Device 0)  |  | Autonomous Copilot   |  | Biometric Vault     |  | Sync Targets   |  |
|  +--------------------+  +----------------------+  +---------------------+  +----------------+  |
+-------------------------------------------------------------------------------------------------+
                                               |
                                  SQLAlchemy ORM (Scoped Sessions)
                                               |
+-------------------------------------------------------------------------------------------------+
|                                       PERSISTENCE LAYER                                         |
|                           SQLite: data/protector_ai.db & protector_ai.db                        |
|                           Excel: D:\Downloads\Attandance.xlsx (Primary Target)                  |
|                           Key Vault: data/biometric.key (Restricted Perms)                      |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Frontend Architecture
- **Framework**: React 19.0.0 with Vite 8.3 build system and TypeScript 5.8+.
- **Design System**: Apple Human Interface Guidelines (HIG) + Linear design language (dark neutral charcoal surface palette, glassmorphism, accent citron highlights, monospace telemetry).
- **Component Organization**:
  - `App.tsx`: Main routing and authentication state controller.
  - `Header.tsx`: Top operational navigation bar, real-time system clock, operator identity badge.
  - `Sidebar.tsx`: Multi-module navigation with role-based visibility gating.
  - `LiveConsole.tsx`: Primary surveillance HUD with bounding box overlays, compliance tickers, and worker identification tags.
  - `IncidentManagement.tsx`: Comprehensive violation feed, severity categorization, and status resolution workflows.
  - `AttendanceManagement.tsx`: Executive workforce dashboard, 6 KPI cards, 7-day trend chart, shift classification, and instant Excel/CSV download.
  - `PeopleManagement.tsx`: Biometric enrollment studio (multi-sample upload or live camera capture), encrypted key store.
  - `Analytics.tsx`: High-level compliance rate visualizations, violation trends, and zone breach distributions.
  - `SystemHealth.tsx`: Diagnostic hardware telemetry, FPS performance, CPU/memory usage, and model load status.
  - `TeamAccess.tsx`: User management, role-based access control (Admin vs. Operator), and session revocation.
- **State Management**: Localized state with persistent auth token caching via `localStorage`. Automated 5-second polling intervals maintain live surveillance telemetry without full page re-renders.

---

## 3. Backend Architecture
- **Framework**: Flask 3.1.3 running on Python 3.10+.
- **Threading Model**: Multi-threaded process architecture:
  - **Main Thread**: Handles incoming Flask HTTP requests and REST routing.
  - **Camera Worker Threads**: Dedicated background thread per active camera stream executing OpenCV video capture loops (`cv2.VideoCapture`).
  - **Identity Scanner Thread**: Independent asynchronous scanner loop per camera processing facial crops without blocking real-time YOLOv8 frame streaming.
  - **Excel Sync Threads**: Detached daemon threads triggering atomic disk synchronization on check-in events.
- **Computer Vision Pipeline**:
  - **Object & PPE Detection**: Ultralytics YOLOv8 loaded from `D:\Downloads\best.pt` (87.6 MB) classifying 25 industrial hazard and PPE categories.
  - **Face Detection**: YuNet deep convolutional face detector (`face_detection_yunet_2023mar.onnx`, 232 KB) providing 5-point facial landmark coordinates with Haar cascade fallback.
  - **Face Feature Embedding**: SFace deep neural network (`face_recognition_sface_2021dec.onnx`, 38.6 MB) generating 128-dimensional L2-normalized deep embeddings.
- **Safety Intelligence**:
  - Integrated OpenRouter LLM copilot (`deepseek/deepseek-chat` / `anthropic/claude-3.5-sonnet`) with local rule-based fallback analyzing OSHA violations and generating mitigation strategies.

---

## 4. Data Flow Architecture

### Ingest to Verification Lifecycle:
1. **Camera Ingest**: CameraManager polls hardware device `0` via `cv2.CAP_DSHOW`. If unavailable, automatically streams from a verified 114-frame validation cache.
2. **PPE Inference**: YOLOv8 model evaluates full-frame resolution at 30 FPS, generating normalized bounding boxes for workers, hardhats, vests, masks, and gloves.
3. **Face Landmarking & Embedding**: Faces in the frame are detected via YuNet, aligned using 5-point affine landmarks, and converted into 128D embedding vectors via SFace.
4. **Biometric Verification**: Query vectors are matched against decrypted identity centroids using cosine similarity. If similarity yields $\ge 80.0\%$ accuracy, the worker's identity is verified.
5. **Incident Attribution**: Violations are tied to the verified worker name if and only if facial recognition meets the $\ge 80.0\%$ threshold; otherwise, logged strictly as `"Unassigned Worker"`.
6. **Attendance & Storage**: Verified workers are recorded as `Present` in SQLite `attendance_records` and immediately staged and saved to `D:\Downloads\Attandance.xlsx`.

---

## 5. Security & Vault Architecture
- **Authentication**: Bearer token authentication validated against `UserSession` table with expiration timestamps.
- **Password Protection**: Passwords hashed using `argon2-cffi` (Argon2id cryptographic algorithm).
- **Biometric Vault**: Facial feature templates and embeddings are encrypted at rest using AES-256 Fernet encryption (`biometric.key`). The key is strictly excluded from version control.
- **Secret Isolation**: Zero hardcoded API keys. All private keys are sourced via environment variables (`OPENROUTER_API_KEY`, `BIOMETRIC_ENCRYPTION_KEY`).

---

## 6. Architectural Weaknesses & Recommendations
1. **WebSockets vs. Polling**: Current frontend relies on HTTP polling intervals (5-6s) for live stats. Implementing WebSocket streaming (e.g. Socket.IO) will reduce network overhead.
2. **Single-Worker Server**: Flask development server should be configured behind Gunicorn/Waitress for production concurrency.
3. **Multi-Camera Scalability**: Running multiple hardware camera streams simultaneously requires centralized worker pool throttling to balance CPU load.
