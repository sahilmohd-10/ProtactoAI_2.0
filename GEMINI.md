# Project Memory & Knowledge Base: Protector AI 2.0

## User & Workspace Profile
- **Primary User / Developer**: Mohd Sahil
- **Project Name**: Protector AI 2.0
- **GitHub Repository**: `https://github.com/sahilmohd-10/ProtactoAI_2.0.git`
- **Root Directory**: `d:\Downloads\ProtectoAI`
- **Application Directory**: `d:\Downloads\ProtectoAI\Protector-AI-2.0`

---

## Architecture & Technology Stack
- **Frontend**: React 19, Vite, TypeScript, Lucide React, Apple HIG glassmorphism design system.
  - Runs on `http://localhost:5173` via `npm run dev` in `Protector-AI-2.0/Frontend`.
- **Backend**: Python 3.10+, Flask 3.1, SQLAlchemy, SQLite (`data/protector_ai.db`).
  - Runs on `http://127.0.0.1:5000` via `python app.py` in `Protector-AI-2.0/Backend`.
- **Computer Vision Model**: Custom-trained YOLOv8 weights (`D:\Downloads\best.pt`, 87.6 MB) on 25 industrial hazard & PPE classes.
- **Biometric Face Recognition**: OpenCV Haar Cascades (frontalface + alt2 + CLAHE enhancement) paired with LBPH (`cv2.face.LBPHFaceRecognizer_create`), AES encryption for face templates (`biometric.key`).

---

## Enrolled Personnel & Biometric Registry
Enrolled profiles currently present in `FaceProfile` database:
1. **Mohd Sahil** (ID 1)
2. **Alok** (ID 2)
3. **Faisal** (ID 3)

---

## Critical Rules & Problem-Solving Memory

### 1. Multi-Person Detection & Name Labeling Rule
- **Problem**: Previously, when two people were in frame, only one name was displayed because the secondary cascade was blocked if one face was found, and unenrolled persons were dropped.
- **Rule**:
  - Always run frontal face and `alt2` face cascades concurrently with CLAHE contrast enhancement so all faces in the frame are discovered.
  - Match distance threshold is set to `75.0` to accommodate lighting and side-profile angles.
  - If both people are enrolled, both enrolled names must be displayed (e.g. `Mohd Sahil` and `Alok`).
  - If one person is enrolled and the other is a visitor or unenrolled, both must be explicitly labeled: `[👤 Mohd Sahil]` and `[⚠️ Unregistered Worker]`. No person in frame should be omitted or left nameless.
  - Distinct identity guard: Two faces in the same frame can never be assigned the same enrolled name; the closer match gets the name and the other is marked as `Unregistered Worker`.
  - The dashboard worker count must equal `Math.max(yolo_workers, detected_people_count)` (e.g., showing `2` when 2 people are present).

### 2. Secret Protection & GitHub Rule
- **Rule**: Never hardcode API keys, tokens, or private secrets in code files (e.g. `OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")`).
- GitHub Secret Scanning rejects pushes with hardcoded keys (`GH013`).
- Keep `.pt` models, SQLite `.db` files, biometric keys (`.key`), `node_modules`, and camera snapshot images (`static/snapshots/*`) strictly in `.gitignore`.

### 3. Verification & Build Quality
- Backend test suite: `python tests/test_all.py` (20 test cases, 100% pass required).
- Frontend production build: `npm run build` (TypeScript check with 0 errors required).
