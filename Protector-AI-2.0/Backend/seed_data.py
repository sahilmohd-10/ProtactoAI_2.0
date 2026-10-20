import json
from datetime import datetime, timezone
from database import SessionLocal, init_db
from models import User, Camera, Zone, AuditLog

def seed_all():
    init_db()
    db = SessionLocal()

    from argon2 import PasswordHasher
    ph = PasswordHasher()
    admin_pw = ph.hash("admin 123")
    operator_pw = ph.hash("operator 123")

    # 1. Seed original users if empty
    if db.query(User).count() == 0:
        now = datetime.now(timezone.utc)
        admin = User(
            username="admin",
            first_name="Admin",
            last_name="User",
            name="Administrator",
            email="admin@protector.ai",
            phone_number="+1 555-010-0001",
            password_hash=admin_pw,
            role="Administrator",
            status="Active",
            last_active=now
        )
        operator = User(
            username="operator",
            first_name="Operator",
            last_name="User",
            name="Operator",
            email="operator@protector.ai",
            phone_number="+1 555-010-0002",
            password_hash=operator_pw,
            role="Operator",
            status="Active",
            last_active=now
        )
        db.add_all([admin, operator])
        db.commit()

    # 2. Seed original real camera (Hardware Device 0)
    if db.query(Camera).count() == 0:
        now = datetime.now(timezone.utc)
        real_camera = Camera(
            id="cam_01",
            name="Real Camera — Live WebCam",
            location="Physical Device 0 (Local Hardware)",
            stream_source="0",
            status="online",
            resolution="1280x720",
            fps=30.0,
            current_workers=1,
            current_violations=0,
            current_compliance=100.0,
            last_seen=now
        )
        db.add(real_camera)
        db.commit()

    # 3. Seed real factory zones
    if db.query(Zone).count() == 0:
        zones = [
            Zone(
                id="zone_alpha",
                name="Overhead Crane Heavy Lift Corridor",
                description="Active overhead crane transit line. High falling object and impact hazard.",
                required_ppe=json.dumps(["Hardhat", "Safety Vest"]),
                risk_level="Critical",
                status="Normal",
                active_workers=1,
                breach_count=0
            ),
            Zone(
                id="zone_beta",
                name="Chemical Processing & Acid Pickling",
                description="Corrosive liquid and aerosol exposure zone. Mandatory respiratory and hand shielding.",
                required_ppe=json.dumps(["Mask", "Gloves", "Safety Vest"]),
                risk_level="High",
                status="Normal",
                active_workers=0,
                breach_count=0
            ),
            Zone(
                id="zone_gamma",
                name="Autonomous Transporter & Forklift Path",
                description="Rapid vehicular traffic zone. High visibility vest and hardhat required at all times.",
                required_ppe=json.dumps(["Hardhat", "Safety Vest"]),
                risk_level="Medium",
                status="Normal",
                active_workers=0,
                breach_count=0
            )
        ]
        db.add_all(zones)
        db.commit()

    # 4. Initial audit log if empty
    if db.query(AuditLog).count() == 0:
        audit = AuditLog(
            user_email="admin@protector.ai",
            action="SYSTEM_INITIALIZED",
            details="Original system baseline initialized with real camera and admin account.",
            ip_address="127.0.0.1"
        )
        db.add(audit)
        db.commit()

    db.close()

if __name__ == "__main__":
    seed_all()
