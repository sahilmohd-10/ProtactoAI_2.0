import re
import secrets
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from models import User, UserSession, AuditLog
from database import SessionLocal

ph = PasswordHasher()

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_REGEX = re.compile(r"^\+?[0-9\s\-\(\)\.]{7,25}$")

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(hash_str: str, password: str) -> bool:
    try:
        return ph.verify(hash_str, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception:
        return False

def validate_password_policy(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must include at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must include at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must include at least one numerical digit."
    if not any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?/" for c in password):
        return False, "Password must include at least one special character."
    return True, ""

def validate_registration_data(data: dict) -> tuple[bool, str, str]:
    """Returns (is_valid, error_message, field_name)"""
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone_number") or "").strip()
    password = data.get("password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not first_name:
        return False, "First Name is required.", "first_name"
    if not last_name:
        return False, "Last Name is required.", "last_name"
    if not username or len(username) < 3:
        return False, "Username must be at least 3 characters.", "username"
    if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
        return False, "Username can only contain alphanumeric characters, dots, and underscores.", "username"
    if not email or not EMAIL_REGEX.match(email):
        return False, "Please enter a valid email address.", "email"
    if phone and not PHONE_REGEX.match(phone):
        return False, "Please enter a valid phone number.", "phone_number"
    if not password:
        return False, "Password is required.", "password"
    
    pw_ok, pw_err = validate_password_policy(password)
    if not pw_ok:
        return False, pw_err, "password"
        
    if password != confirm_password:
        return False, "Passwords do not match.", "confirm_password"

    return True, "", ""

def get_current_user_from_token(token: str) -> tuple[User | None, str | None]:
    if not token:
        return None, "Missing authentication token"

    db = SessionLocal()
    try:
        session = db.query(UserSession).filter(UserSession.token == token).first()
        if not session:
            return None, "Invalid or expired session"
        
        # Check expiry
        now = datetime.now(timezone.utc)
        session_expires = session.expires_at
        if session_expires.tzinfo is None:
            session_expires = session_expires.replace(tzinfo=timezone.utc)

        if session_expires < now:
            db.delete(session)
            db.commit()
            return None, "Session has expired. Please log in again."

        user = db.query(User).filter(User.id == session.user_id).first()
        if not user or user.status != "Active":
            return None, "User account is suspended or inactive"

        user_dict = user.to_dict()
        return user_dict, None
    finally:
        db.close()

def create_user_session(user_id: int, ip_address="127.0.0.1", user_agent="", db=None) -> str:
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    try:
        token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        session = UserSession(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent[:250] if user_agent else ""
        )
        db.add(session)
        db.commit()
        return token
    finally:
        if close_db:
            db.close()

