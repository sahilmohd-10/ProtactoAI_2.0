import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

# Database configuration
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "protector_ai.db"
DATABASE_URI = os.getenv("DATABASE_URI", f"sqlite:///{DB_PATH}")

# Model configuration
# Check common locations for the best.pt weights
CANDIDATE_MODEL_PATHS = [
    Path(r"D:\Downloads\best.pt"),
    Path(r"D:\Data\my_model\train\weights\best.pt"),
    BASE_DIR / "models" / "best.pt",
    BASE_DIR / "best.pt"
]

MODEL_PATH = None
for p in CANDIDATE_MODEL_PATHS:
    if p.exists():
        MODEL_PATH = str(p)
        break

if not MODEL_PATH:
    MODEL_PATH = "yolov8n.pt"  # Ultralytics fallback

# Static and Snapshot storage
STATIC_DIR = BASE_DIR / "static"
SNAPSHOTS_DIR = STATIC_DIR / "snapshots"
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Dataset validation images for synthetic / backup feed
DATASET_SAMPLE_DIR = Path(r"D:\1\valid\images")

# Server Config
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 5000))
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1")

# Secret keys
SECRET_KEY = os.getenv("SECRET_KEY", "protector-ai-2.0-secure-secret-key-2026")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_DEFAULT_MODEL = os.getenv("OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")

# PPE Class groupings from the 25 trained classes
PPE_CLASSES = {
    0: 'Excavator', 1: 'Gloves', 2: 'Hardhat', 3: 'Ladder', 4: 'Mask',
    5: 'NO-Hardhat', 6: 'NO-Mask', 7: 'NO-Safety Vest', 8: 'Person',
    9: 'SUV', 10: 'Safety Cone', 11: 'Safety Vest', 12: 'bus',
    13: 'dump truck', 14: 'fire hydrant', 15: 'machinery', 16: 'mini-van',
    17: 'sedan', 18: 'semi', 19: 'trailer', 20: 'truck and trailer',
    21: 'truck', 22: 'van', 23: 'vehicle', 24: 'wheel loader'
}

COMPLIANT_CLASSES = {'Hardhat', 'Mask', 'Safety Vest', 'Gloves'}
VIOLATION_CLASSES = {'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest'}
HAZARD_CLASSES = {'Excavator', 'Ladder', 'Safety Cone', 'machinery', 'dump truck', 'truck', 'wheel loader'}
