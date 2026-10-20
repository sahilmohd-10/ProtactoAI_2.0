import json
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(50), nullable=False, default="")
    last_name = Column(String(50), nullable=False, default="")
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    phone_number = Column(String(30), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False, default="")
    role = Column(String(50), default="Operator")  # Administrator, Operator
    avatar = Column(String(255), default="")
    status = Column(String(20), default="Active")  # Active, Inactive
    last_active = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "name": self.name,
            "email": self.email,
            "phone_number": self.phone_number,
            "role": self.role,
            "avatar": self.avatar,
            "status": self.status,
            "last_active": self.last_active.isoformat() if self.last_active else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    user_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String(50), default="127.0.0.1")
    user_agent = Column(String(255), default="")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "ip_address": self.ip_address
        }


class TerminalConversation(Base):
    __tablename__ = "terminal_conversations"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, nullable=False, index=True)
    title = Column(String(100), nullable=False, default="New chat")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class TerminalMessage(Base):
    __tablename__ = "terminal_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String(36), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FaceProfile(Base):
    __tablename__ = "face_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    consent_recorded = Column(Boolean, nullable=False, default=False)
    consented_at = Column(DateTime, nullable=False)
    enrolled_by_user_id = Column(Integer, nullable=False)
    encrypted_templates = Column(Text, nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FaceVisitLog(Base):
    __tablename__ = "face_visit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, nullable=False, index=True)
    recognized_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    match_distance = Column(Float, nullable=False)
    camera_source = Column(String(80), nullable=False, default="People scanner")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    stream_source = Column(String(100), default="0")  # '0' for webcam, or synthetic ID
    status = Column(String(20), default="online")  # online, offline, maintenance
    resolution = Column(String(30), default="1280x720")
    fps = Column(Float, default=30.0)
    current_workers = Column(Integer, default=0)
    current_violations = Column(Integer, default=0)
    current_compliance = Column(Float, default=100.0)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "stream_source": self.stream_source,
            "status": self.status,
            "resolution": self.resolution,
            "fps": self.fps,
            "current_workers": self.current_workers,
            "current_violations": self.current_violations,
            "current_compliance": self.current_compliance,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None
        }

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), default="")
    required_ppe = Column(Text, default="[]")  # JSON array string: ["Hardhat", "Safety Vest"]
    risk_level = Column(String(20), default="Medium")  # Critical, High, Medium, Low
    status = Column(String(20), default="Normal")  # Normal, Warning, Breach
    active_workers = Column(Integer, default=0)
    breach_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        try:
            req_ppe = json.loads(self.required_ppe)
        except Exception:
            req_ppe = []
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "required_ppe": req_ppe,
            "risk_level": self.risk_level,
            "status": self.status,
            "active_workers": self.active_workers,
            "breach_count": self.breach_count,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(50), primary_key=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # Missing Hardhat, Missing Vest, Missing Mask, Missing Gloves, Zone Breach
    severity = Column(String(20), default="High")  # Critical, High, Medium, Low
    status = Column(String(20), default="Open")  # Open, In Review, Acknowledged, Resolved
    location = Column(String(100), nullable=False)
    camera_id = Column(String(50), default="cam_01")
    worker_id = Column(String(50), default="W-409")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    snapshot_url = Column(String(255), default="")
    bounding_boxes = Column(Text, default="[]")  # JSON string of detected coordinates
    assigned_to = Column(String(100), default="Unassigned")
    resolution_notes = Column(Text, default="")
    resolved_at = Column(DateTime, nullable=True)

    def to_dict(self):
        try:
            boxes = json.loads(self.bounding_boxes)
        except Exception:
            boxes = []
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "severity": self.severity,
            "status": self.status,
            "location": self.location,
            "camera_id": self.camera_id,
            "worker_id": self.worker_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "snapshot_url": self.snapshot_url,
            "bounding_boxes": boxes,
            "assigned_to": self.assigned_to,
            "resolution_notes": self.resolution_notes,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_email = Column(String(120), default="system@protector.ai")
    action = Column(String(100), nullable=False)
    details = Column(Text, default="")
    ip_address = Column(String(50), default="127.0.0.1")

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user_email": self.user_email,
            "action": self.action,
            "details": self.details,
            "ip_address": self.ip_address
        }

class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(20), unique=True, nullable=False)  # YYYY-MM-DD
    compliance_rate = Column(Float, default=94.5)
    total_workers = Column(Integer, default=42)
    total_violations = Column(Integer, default=5)
    critical_count = Column(Integer, default=1)
    high_count = Column(Integer, default=2)
    medium_count = Column(Integer, default=2)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date,
            "compliance_rate": self.compliance_rate,
            "total_workers": self.total_workers,
            "total_violations": self.total_violations,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count
        }
