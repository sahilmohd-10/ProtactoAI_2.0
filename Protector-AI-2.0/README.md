# Protector AI 2.0

<div align="center">

[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0%2B-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFFF.svg?logo=ultralytics&logoColor=black)](https://github.com/ultralytics/ultralytics)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Autonomous Industrial Safety Operations Platform & Intelligent Command Terminal**  
*Real-time YOLOv8 computer vision inference, signed backend tool dispatching, and an Apple-inspired operational interface.*

[Key Features](#key-features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [CV Engine](#computer-vision-engine) • [Command Terminal](#command-terminal) • [AI Copilot](#ai-operations-copilot) • [Testing](#testing)

</div>

---

## Overview

**Protector AI 2.0** is an enterprise-grade industrial safety intelligence platform engineered for construction sites, heavy fabrication plants, chemical handling zones, and manufacturing facilities. It pairs continuous optical PPE compliance monitoring with an interactive operational command terminal and an executive AI Operations Copilot.

Transform workplace safety from passive video recording into proactive, real-time hazard detection and automated incident governance.

---

## Key Features

- **Real-Time PPE Detection Engine**: Custom-trained **YOLOv8** model detecting 25 industrial hazard and safety classes (Hardhats, Safety Vests, Masks, Chemical Gloves, Workers, Heavy Machinery, Vehicles, and safety breach classes).
- **Interactive Command Terminal (`Ctrl+K` / `⌘K`)**: macOS-inspired CLI with structured commands, natural-language query processing, audio speech-to-text dictation, and persistent per-user conversation threads.
- **AI Operations Copilot**: Conversational safety assistant connected to a signed backend tool registry (`get_ppe_statistics`, `search_incidents`, `get_system_status`, etc.) with destructive action confirmation guards.
- **Incident & Geofence Governance**: Live incident logging, violation auditing, severity filtering, and restricted hazard perimeter monitoring.
- **Consent-Based People Log**: Privacy-preserving, administrator-only biometric profile management with locally matched, AES-encrypted face templates (`data/biometric.key`).
- **Apple-Grade User Interface**: Crafted with SF Pro and JetBrains Mono typography, frosted glassmorphism, semantic safety accents, and system light/dark theme adaptation.

---

## Architecture

```
Protector-AI-2.0/
├── Backend/
│   ├── app.py                  # Flask 3.1 REST API & MJPEG streaming server
│   ├── config.py               # Centralized configuration & model path resolution
│   ├── models.py               # SQLAlchemy models (Incident, Camera, Zone, User, etc.)
│   ├── database.py             # SQLite database engine (data/protector_ai.db)
│   ├── seed_data.py            # Initializer for cameras, zones, and default users
│   ├── engine.py               # YOLOv8 inference pipeline & frame streamer
│   ├── tools.py                # Typed Backend Tool Registry with security guards
│   ├── command_engine.py       # Terminal parser & natural language intent matcher
│   ├── copilot.py              # AI Operations Copilot (Gemini / OpenAI / Local Reasoner)
│   ├── requirements.txt        # Backend dependencies
│   └── tests/
│       └── test_all.py         # Automated test suite
│
└── Frontend/
    ├── package.json            # React 19 + Vite + TypeScript + Lucide Icons
    ├── index.html              # Shell document & metadata
    └── src/
        ├── App.tsx             # Main workspace shell & keyboard shortcut manager
        ├── index.css           # Design tokens, glassmorphism, and animations
        ├── types.ts            # TypeScript interfaces & API contracts
        ├── services/api.ts     # Typed REST API client
        └── components/
            ├── Header.tsx           # Floating header with live telemetry pills
            ├── Sidebar.tsx          # Collapsible navigation sidebar
            ├── WelcomeHero.tsx      # Executive overview & KPI cards
            ├── LiveConsole.tsx      # Real-time computer vision monitoring workspace
            ├── IncidentManagement.tsx # Incident search, auditing, and resolution
            ├── Analytics.tsx        # Compliance trajectories & risk distribution
            ├── RestrictedZones.tsx  # Geofenced safety zones & breach monitoring
            ├── TeamAccess.tsx       # RBAC permissions matrix & team roster
            ├── SystemHealth.tsx     # Hardware telemetry, GPU/CPU, and diagnostics
            ├── CommandTerminal.tsx  # Interactive CLI terminal
            └── CopilotDrawer.tsx    # Slide-out AI assistant with tool execution badges
```

---

## Quick Start

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: v18 or higher (with npm)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/Protector-AI-2.0.git
cd Protector-AI-2.0
```

### 2. Backend Setup
```bash
cd Backend

# Create and activate a virtual environment (optional but recommended)
python -m venv venv

# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask backend server
python app.py
```
> The backend initializes the SQLite database, seeds initial data, loads the YOLO model, and starts serving on `http://127.0.0.1:5000`.

### 3. Frontend Setup
Open a separate terminal window:
```bash
cd Frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```
> The web interface will launch at `http://localhost:5173`.

---

## Computer Vision Engine

The optical detection pipeline utilizes custom-trained **YOLOv8** weights to monitor industrial environments.

### Supported Classes (25 Total)
| Category | Detected Classes |
|---|---|
| **Compliant PPE** | `Hardhat`, `Safety Vest`, `Mask`, `Gloves` |
| **Violations** | `NO-Hardhat`, `NO-Safety Vest`, `NO-Mask` |
| **Personnel** | `Person` |
| **Machinery & Hazards** | `Excavator`, `Ladder`, `Safety Cone`, `machinery`, `dump truck`, `wheel loader`, `truck`, `bus`, `fire hydrant`, `van`, `sedan`, `SUV`, `semi`, `trailer`, `truck and trailer`, `mini-van`, `vehicle` |

### Video Stream Modes
1. **Physical Camera**: Hardware webcams via `cv2.VideoCapture(0)`.
2. **Synthetic Validation Stream**: Automated cycle through validation test images.
3. **Single-Frame Detection**: REST endpoint via `POST /api/inference/detect`.

---

## Command Terminal

Press **`⌘K` / `Ctrl+K`** or click **Terminal** in the top navigation bar to open the operational CLI.

### Structured Commands
| Command | Arguments / Flags | Description |
|---|---|---|
| `help` | — | View all commands and usage syntax |
| `status` | — | Display kernel, CPU, RAM, and model telemetry |
| `model status` | — | Check YOLOv8 weights path, device accelerator, and loaded classes |
| `app open <module>` | `console`, `incidents`, `analytics`, `zones`, `team`, `settings` | Quick-navigate to any application module |
| `ppe stats` | — | Summary of compliance %, active personnel, and violations |
| `ppe violations` | `--period [today\|24h\|week]`, `--type [hardhat\|vest\|mask\|gloves]` | Query active violations with category filters |
| `camera list` | — | Enumerate connected optical streams and resolution |
| `camera status <id>` | e.g. `cam_01` | Detailed telemetry for a specific camera |
| `incidents search` | `--severity [critical\|high\|medium\|low]`, `--query <text>` | Search incident records |
| `incidents acknowledge <id>` | e.g. `INC-2026-8801` | Mark an incident as acknowledged |
| `incidents resolve <id>` | `--notes "<resolution details>"` | Resolve incident with audit notes |
| `zone list` | — | Display restricted hazard zones and breach count |
| `report generate` | `--period [today\|week]`, `--format [csv\|json]` | Generate compliance audit reports |
| `theme <dark\|light>` | — | Toggle interface color theme |
| `clear` | — | Clear terminal history |

### Natural Language Queries
Type everyday questions directly into the terminal prompt:
- *"Show the current PPE compliance rate."*
- *"Open the live safety console."*
- *"Find all incidents involving missing gloves."*
- *"Check whether the AI model is connected."*
- *"Generate a summary report for today's shifts."*

---

## AI Operations Copilot

The AI Copilot drawer runs alongside your workspace, providing reasoning grounded directly in live database telemetry.

### Registered Tools
- `get_system_status` — Hardware, memory, and model runtime diagnostics.
- `get_ppe_statistics` — Real-time compliance percentage and open violation counts.
- `list_cameras` / `get_camera_status` — Camera fleet health and feed metrics.
- `search_incidents` / `get_incident_details` — Query incident history and resolution states.
- `update_incident_status` / `delete_incident` — State transitions with two-step confirmation safeguards.
- `list_zones` / `update_zone_status` — Hazard perimeter status and breach logs.
- `generate_report` — Export operational summaries in CSV or JSON format.

### LLM Providers
- **Built-in (Zero API keys required)**: Deterministic semantic dispatcher and pattern matcher.
- **Cloud LLMs (Optional)**: Provide a `GEMINI_API_KEY` or `OPENAI_API_KEY` in `Backend/.env` for open-ended conversational reasoning.

---

## Privacy & Security

- **Consent-Based Biometric Enrollment**: Explicit administrator consent is mandatory before enrolling any face profile.
- **Local Template Storage**: Original camera frames are discarded immediately after processing. Biometric embeddings are encrypted locally using AES (`Backend/data/biometric.key`).
- **Audit Trails**: All incident acknowledgments, resolutions, and system modifications are logged with timestamps and user IDs.

---

## Testing & Validation

### Run Backend Automated Tests
```bash
cd Backend
python tests/test_all.py
```
> Validates all 10 core integration tests (Health, PPE stats, CRUD, Camera fleet, Terminal parsing, Copilot guards).

### Frontend Production Build
```bash
cd Frontend
npm run build
```
> Verifies TypeScript types and creates optimized assets in `dist/`.

---

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/SafetyEnhancement`)
3. Commit your Changes (`git commit -m 'Add new safety rule'`)
4. Push to the Branch (`git push origin feature/SafetyEnhancement`)
5. Open a Pull Request

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
