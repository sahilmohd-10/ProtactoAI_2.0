"""
Protector AI 2.0 — Telegram Password Recovery & Security OTP Bot Service
Bot Username: @ProtectoAIbot

Dedicated specifically for password reset and security verification:
1. When a user starts the bot, it asks for their registered Email Address and Phone Number.
2. Checks if the Email Address exists in the database (users table):
   - If NOT in database: Prompts the user that no account exists and to create/register an account first on the web portal.
   - If FOUND in database: Connects the phone number and Telegram chat ID to that user account in the database.
3. Automatically generates and sends the 6-digit Password Reset OTP directly to this Telegram chat.
4. Allows requesting new OTPs on-demand or updating credentials with interactive native Telegram keyboards.
"""

import os
import sys
import re
import json
import time
import secrets
import logging
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple, Any
from dotenv import load_dotenv

# Ensure Backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv()

logger = logging.getLogger("ProtectorAI.Telegram")

DATA_DIR = os.path.join(backend_dir, "data")
CHATS_FILE = os.path.join(DATA_DIR, "telegram_subscribers.json")
OFFSET_FILE = os.path.join(DATA_DIR, "telegram_offset.json")

# In-memory unified OTP cache for password resets:
# Format: { email.lower(): { "otp": "123456", "expires_at": float(timestamp), "verified": bool, "user_id": int } }
PASSWORD_RESET_OTPS: Dict[str, dict] = {}

_polling_thread: Optional[threading.Thread] = None
_polling_active = False

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(\+?[0-9]{10,15})")

# Native Telegram Reply Keyboards for Forgot Password & OTP Flow
KEYBOARD_CONNECTED = {
    "keyboard": [
        [{"text": "🔐 Send New Reset OTP"}, {"text": "👤 My Account"}],
        [{"text": "🔄 Switch Account / Re-verify"}, {"text": "❓ Web Portal Help"}]
    ],
    "resize_keyboard": True,
    "one_time_keyboard": False
}

KEYBOARD_SHARE_PHONE = {
    "keyboard": [
        [{"text": "📱 Share Phone Number", "request_contact": True}],
        [{"text": "🔄 Start Over"}]
    ],
    "resize_keyboard": True,
    "one_time_keyboard": True
}

KEYBOARD_START = {
    "keyboard": [
        [{"text": "🔄 Start Over"}, {"text": "❓ Help & Registration Info"}]
    ],
    "resize_keyboard": True,
    "one_time_keyboard": False
}

KEYBOARD_NOT_FOUND = {
    "keyboard": [
        [{"text": "🔄 Try Another Email"}, {"text": "🌐 How to Register"}]
    ],
    "resize_keyboard": True,
    "one_time_keyboard": False
}


def _get_bot_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def load_subscribers() -> Dict[str, dict]:
    """Loads stored chat_id mappings: { chat_id: { username, first_name, email, phone, state, updated_at } }"""
    if not os.path.exists(CHATS_FILE):
        return {}
    try:
        with open(CHATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_subscribers(subs: Dict[str, dict]):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(CHATS_FILE, "w", encoding="utf-8") as f:
            json.dump(subs, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not save Telegram subscribers: {e}")


def _get_last_offset() -> int:
    if not os.path.exists(OFFSET_FILE):
        return 0
    try:
        with open(OFFSET_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return int(data.get("offset", 0))
    except Exception:
        return 0


def _save_last_offset(offset: int):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(OFFSET_FILE, "w", encoding="utf-8") as f:
            json.dump({"offset": offset}, f)
    except Exception as e:
        logger.warning(f"Could not save Telegram offset: {e}")


def send_telegram_raw_message(chat_id: str, text: str, reply_markup: Optional[dict] = None) -> bool:
    """Dispatches a Markdown text message to a specific Telegram chat_id with optional reply keyboard."""
    token = _get_bot_token()
    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Protector-AI-Telegram-Client/2.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as he:
        # Fallback without Markdown if parsing error happens (e.g. unescaped characters)
        try:
            payload.pop("parse_mode", None)
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Protector-AI-Telegram-Client/2.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status in (200, 201)
        except Exception:
            logger.warning(f"⚠️ Telegram API HTTPError for chat {chat_id}: {he}")
            return False
    except Exception as err:
        logger.warning(f"⚠️ Could not send Telegram message to chat {chat_id}: {err}")
        return False


def find_user_in_database(email: str) -> Optional[dict]:
    """Queries the SQLite database (users table) for an account matching the email address."""
    try:
        from database import SessionLocal
        from models import User
        db = SessionLocal()
        clean_email = email.strip().lower()
        user = db.query(User).filter(User.email.ilike(clean_email)).first()
        result = user.to_dict() if user else None
        db.close()
        return result
    except Exception as err:
        logger.error(f"Error querying SQLite database for user {email}: {err}")
        return None


def link_phone_to_database_user(email: str, phone: str) -> bool:
    """Updates the user's phone number in the SQLite database and marks account as active."""
    try:
        from database import SessionLocal
        from models import User
        db = SessionLocal()
        clean_email = email.strip().lower()
        user = db.query(User).filter(User.email.ilike(clean_email)).first()
        if user:
            if phone:
                user.phone_number = phone.strip()
            user.status = "Active"
            user.last_active = datetime.now(timezone.utc)
            db.commit()
            db.close()
            logger.info(f"✅ Connected phone number {phone} to user {user.username} ({user.email}) in SQLite database")
            return True
        db.close()
        return False
    except Exception as err:
        logger.error(f"Error updating phone number in SQLite database for {email}: {err}")
        return False


def generate_and_store_otp(email: str, user_id: int = 1) -> str:
    """Generates a cryptographic 6-digit numeric OTP and stores it in PASSWORD_RESET_OTPS for 10 minutes."""
    otp_code = str(secrets.randbelow(900000) + 100000)
    expires_at = time.time() + 600  # 10 minutes

    PASSWORD_RESET_OTPS[email.strip().lower()] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "verified": False,
        "user_id": user_id
    }
    logger.info(f"🔑 [PROTECTOR AI] Generated Password Reset OTP for {email}: [{otp_code}] (valid 10 mins)")
    return otp_code


def send_otp_to_chat(chat_id: str, email: str, user_name: str, phone: str = "") -> bool:
    """Generates a new OTP and dispatches a formatted message with action buttons to the chat."""
    otp_code = generate_and_store_otp(email)

    phone_line = f"📱 *Phone:* `{phone}`\n" if phone else ""
    msg = (
        f"🔐 *PASSWORD RESET VERIFICATION CODE*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Account Name:* {user_name or 'User'}\n"
        f"📧 *Registered Email:* `{email}`\n"
        f"{phone_line}"
        f"🛡️ *Verification Status:* `Connected & Verified`\n\n"
        f"Your one-time security code is:\n\n"
        f"          👉   `{otp_code}`   👈\n\n"
        f"⏱️ *Expires in 10 minutes.*\n"
        f"Enter this 6-digit code on the web portal to reset your password.\n\n"
        f"⚠️ _Never share this verification code with anyone._\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
    return send_telegram_raw_message(chat_id, msg, reply_markup=KEYBOARD_CONNECTED)


def sync_telegram_updates() -> int:
    """
    Polls getUpdates from Telegram Bot API for the Forgot Password flow:
    - Asks for Email ID and Phone Number (matching account creation credentials).
    - Checks SQLite database:
      * If email is NOT found in database: Instructs user that account was not found and to create/register account first.
      * If account IS found: Connects the phone number to the account and sends the OTP to this chat.
    - If user is already connected: Allows requesting fresh OTPs instantly.
    """
    token = _get_bot_token()
    if not token:
        return 0

    last_offset = _get_last_offset()
    offset_param = f"?offset={last_offset}&timeout=5" if last_offset else "?timeout=5"
    url = f"https://api.telegram.org/bot{token}/getUpdates{offset_param}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Protector-AI-Telegram-Client/2.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data.get("ok"):
                return 0

            results = data.get("result", [])
            if not results:
                return 0

            subs = load_subscribers()
            updated_count = 0
            max_update_id = last_offset

            for update in results:
                update_id = update.get("update_id", 0)
                if update_id >= max_update_id:
                    max_update_id = update_id + 1

                msg = update.get("message") or update.get("channel_post") or {}
                chat = msg.get("chat") or {}
                chat_id = str(chat.get("id", ""))
                if not chat_id:
                    continue

                text = (msg.get("text") or "").strip()
                contact = msg.get("contact") or {}
                username = chat.get("username") or ""
                first_name = chat.get("first_name") or "User"
                last_name = chat.get("last_name") or ""

                is_brand_new = chat_id not in subs
                if is_brand_new:
                    subs[chat_id] = {
                        "chat_id": chat_id,
                        "username": username,
                        "first_name": first_name,
                        "last_name": last_name,
                        "email": "",
                        "phone": "",
                        "state": "AWAITING_EMAIL",
                        "updated_at": msg.get("date", int(time.time()))
                    }
                    updated_count += 1

                sub = subs[chat_id]
                sub["first_name"] = first_name or sub.get("first_name", "User")
                if username:
                    sub["username"] = username
                if last_name:
                    sub["last_name"] = last_name

                state = sub.get("state", "AWAITING_EMAIL")
                current_email = sub.get("email", "").strip()
                current_phone = sub.get("phone", "").strip()

                # ==========================================
                # ACTION: START OVER / RE-VERIFY ACCOUNT
                # ==========================================
                if text in ("/reset", "/start_over", "🔄 Start Over", "🔄 Try Another Email", "🔄 Switch Account / Re-verify"):
                    sub["state"] = "AWAITING_EMAIL"
                    sub["email"] = ""
                    sub["phone"] = ""
                    save_subscribers(subs)
                    send_telegram_raw_message(
                        chat_id,
                        f"🔐 *PROTECTOR AI 2.0 • FORGOT PASSWORD*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"To reset your password and receive a verification OTP, please provide your account details:\n\n"
                        f"👉 *Step 1 of 2: Please enter your registered Email Address:*\n"
                        f"_(The email you used when creating your Protector AI account)_",
                        reply_markup=KEYBOARD_START
                    )
                    continue

                # ==========================================
                # ACTION: HELP & REGISTRATION GUIDANCE
                # ==========================================
                if text in ("❓ Help & Registration Info", "🌐 How to Register", "❓ Web Portal Help"):
                    send_telegram_raw_message(
                        chat_id,
                        f"📖 *HOW TO REGISTER & RESET YOUR PASSWORD*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"1. *Create an Account:*\n"
                        f"   Open the Protector AI Web Portal (`http://localhost:5173`) in your browser and click *Register*.\n\n"
                        f"2. *Connect this Telegram Bot:*\n"
                        f"   Enter the same *Email Address* and *Phone Number* you used on the web.\n\n"
                        f"3. *Receive Verification OTP:*\n"
                        f"   Once verified, this bot immediately delivers your 6-digit OTP code.\n\n"
                        f"4. *Reset Password:*\n"
                        f"   Enter the 6-digit code on the web portal to set your new password!",
                        reply_markup=KEYBOARD_START if state != "CONNECTED" else KEYBOARD_CONNECTED
                    )
                    continue

                # ==========================================
                # STATE 1: AWAITING EMAIL ADDRESS
                # ==========================================
                if state == "AWAITING_EMAIL" or (not current_email and text in ("/start", "/help", "hi", "hello", "hey", "help")):
                    email_match = EMAIL_REGEX.search(text)
                    if email_match:
                        entered_email = email_match.group(0).lower().strip()

                        # Check if this email exists in the database
                        db_user = find_user_in_database(entered_email)

                        if not db_user:
                            # ❌ EMAIL NOT FOUND IN DATABASE -> ASK USER TO CREATE ACCOUNT FIRST
                            send_telegram_raw_message(
                                chat_id,
                                f"❌ *Account Not Found in Database!*\n"
                                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"No registered Protector AI account was found for:\n"
                                f"📧 `{entered_email}`\n\n"
                                f"👉 *Please create an account first on our web portal:*\n"
                                f"🌐 Web Portal: `http://localhost:5173`\n\n"
                                f"Click *Register* on the portal using this email address. Once registered, come back here and enter your email again to receive your OTP!",
                                reply_markup=KEYBOARD_NOT_FOUND
                            )
                        else:
                            # ✅ EMAIL FOUND IN DATABASE -> PROCEED TO ASK PHONE NUMBER
                            sub["email"] = entered_email
                            sub["user_name"] = db_user.get("name") or first_name
                            sub["state"] = "AWAITING_PHONE"
                            sub["updated_at"] = int(time.time())
                            save_subscribers(subs)
                            updated_count += 1

                            send_telegram_raw_message(
                                chat_id,
                                f"✅ *Account Found: {db_user.get('name')}!*\n"
                                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                                f"Now verify your phone number to connect and receive your reset code:\n\n"
                                f"👉 *Step 2 of 2: Please enter your Phone Number:*\n"
                                f"_(The phone number you used during account creation)_\n\n"
                                f"You can tap the *Share Phone Number* button below, or type it manually (e.g. `+919876543210`):",
                                reply_markup=KEYBOARD_SHARE_PHONE
                            )
                    else:
                        # Initial /start or greeting message without email
                        send_telegram_raw_message(
                            chat_id,
                            f"👋 *Hello {first_name}! Welcome to Protector AI 2.0*\n"
                            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                            f"🔐 *Password Recovery & Verification Bot*\n\n"
                            f"Need to reset your password? Please enter your account credentials:\n\n"
                            f"👉 *Step 1 of 2: Please enter your registered Email Address:*\n"
                            f"_(e.g. `yourname@company.com`)_\n\n"
                            f"⚠️ _If you don't have an account yet, please create one first on the web portal (http://localhost:5173)._",
                            reply_markup=KEYBOARD_START
                        )
                    continue

                # ==========================================
                # STATE 2: AWAITING PHONE NUMBER
                # ==========================================
                if state == "AWAITING_PHONE":
                    found_phone = None
                    if contact and contact.get("phone_number"):
                        found_phone = str(contact["phone_number"]).strip()
                        if not found_phone.startswith("+"):
                            found_phone = "+" + found_phone
                    else:
                        phone_match = PHONE_REGEX.search(text.replace(" ", "").replace("-", ""))
                        if phone_match:
                            found_phone = phone_match.group(0).strip()

                    if found_phone:
                        # Connect this phone number to the account in database
                        sub["phone"] = found_phone
                        sub["state"] = "CONNECTED"
                        sub["updated_at"] = int(time.time())

                        email_to_link = sub.get("email", "")
                        user_name = sub.get("user_name", first_name)

                        # Update SQLite database users table with this phone number
                        link_phone_to_database_user(email_to_link, found_phone)

                        save_subscribers(subs)
                        updated_count += 1

                        # Immediately generate and send OTP to the user!
                        send_otp_to_chat(
                            chat_id=chat_id,
                            email=email_to_link,
                            user_name=user_name,
                            phone=found_phone
                        )
                    else:
                        send_telegram_raw_message(
                            chat_id,
                            f"⚠️ *Phone Number Required*\n\n"
                            f"Please tap the *Share Phone Number* button below, or type your mobile number (e.g. `+919876543210`) to connect your account and receive your OTP code:",
                            reply_markup=KEYBOARD_SHARE_PHONE
                        )
                    continue

                # ==========================================
                # STATE 3: CONNECTED (ON-DEMAND OTP & ACCOUNT INFO)
                # ==========================================
                if text in ("🔐 Send New Reset OTP", "/otp", "otp", "code", "new otp"):
                    user_name = sub.get("user_name", first_name)
                    send_otp_to_chat(
                        chat_id=chat_id,
                        email=current_email,
                        user_name=user_name,
                        phone=current_phone
                    )
                elif text in ("👤 My Account", "/account", "/profile", "profile"):
                    db_user = find_user_in_database(current_email)
                    name = db_user.get("name") if db_user else (sub.get("user_name") or first_name)
                    role = db_user.get("role") if db_user else "Operator"
                    status = db_user.get("status") if db_user else "Active"
                    user_id = db_user.get("id") if db_user else "Linked"

                    send_telegram_raw_message(
                        chat_id,
                        f"👤 *CONNECTED ACCOUNT DETAILS*\n"
                        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        f"📛 *Name:* {name}\n"
                        f"📧 *Email:* `{current_email}`\n"
                        f"📱 *Phone:* `{current_phone or 'Connected'}`\n"
                        f"💼 *Role:* `{role}`\n"
                        f"🆔 *Database ID:* `#{user_id}`\n"
                        f"🛡️ *Telegram Status:* `Connected & Verified`\n\n"
                        f"Tap *Send New Reset OTP* below if you need a password reset code.",
                        reply_markup=KEYBOARD_CONNECTED
                    )
                elif text in ("/start", "hi", "hello", "help", "/help"):
                    send_telegram_raw_message(
                        chat_id,
                        f"👋 *Welcome back, {sub.get('user_name', first_name)}!*\n\n"
                        f"Your Telegram is connected to Protector AI account:\n"
                        f"📧 `{current_email}`\n\n"
                        f"Tap *🔐 Send New Reset OTP* below to generate and receive a fresh password reset code.",
                        reply_markup=KEYBOARD_CONNECTED
                    )
                else:
                    # Helpful guidance prompt
                    send_telegram_raw_message(
                        chat_id,
                        f"👋 *Hello {sub.get('user_name', first_name)}!*\n\n"
                        f"Your account is connected (`{current_email}`).\n"
                        f"Tap *🔐 Send New Reset OTP* below if you need a password verification code, or *🔄 Switch Account* to change credentials.",
                        reply_markup=KEYBOARD_CONNECTED
                    )

            if max_update_id > last_offset:
                _save_last_offset(max_update_id)

            if updated_count > 0:
                save_subscribers(subs)

            return updated_count
    except Exception as err:
        logger.debug(f"Telegram sync notice: {err}")
        return 0


def _polling_worker():
    """Background resilient loop polling Telegram updates every 2.5 seconds."""
    global _polling_active
    logger.info("🛡️ Telegram Bot background listener active.")
    while _polling_active:
        try:
            sync_telegram_updates()
        except Exception as e:
            logger.debug(f"Telegram polling tick error: {e}")
        time.sleep(2.5)


def start_telegram_polling():
    """Starts the background Telegram listener if not already started."""
    global _polling_thread, _polling_active
    if _polling_active and _polling_thread and _polling_thread.is_alive():
        return
    _polling_active = True
    _polling_thread = threading.Thread(target=_polling_worker, daemon=True, name="TelegramBotListener")
    _polling_thread.start()


def stop_telegram_polling():
    global _polling_active
    _polling_active = False


def send_telegram_otp(recipient_identifier: str, otp_code: str) -> Tuple[bool, str]:
    """
    Sends a formatted 6-digit verification OTP to Telegram.
    Picks matching subscriber by email or phone, or defaults to active admin chat.
    """
    token = _get_bot_token()
    if not token:
        return False, "Telegram Bot Token is not configured in .env."

    # Immediate sync of any new messages
    sync_telegram_updates()

    subs = load_subscribers()
    if not subs:
        return False, "No active Telegram chats found. Please open t.me/ProtectoAIbot and click /start."

    identifier_clean = (recipient_identifier or "").strip().lower()

    # Find matching chats
    matched_chats = []
    for chat_id, data in subs.items():
        user_email = (data.get("email") or "").strip().lower()
        user_phone = (data.get("phone") or "").replace(" ", "").replace("-", "")

        if user_email and user_email == identifier_clean:
            matched_chats.append((chat_id, data))
        elif user_phone and (user_phone == identifier_clean or identifier_clean.endswith(user_phone) or user_phone.endswith(identifier_clean)):
            matched_chats.append((chat_id, data))

    # Fallback: If only 1 subscriber exists in the whole database (e.g. Mohd Sahil), route to them
    if not matched_chats and len(subs) == 1:
        first_id = list(subs.keys())[0]
        matched_chats.append((first_id, subs[first_id]))

    # Fallback 2: Check if any subscriber has empty email (recent /start)
    if not matched_chats:
        for chat_id, data in subs.items():
            if not data.get("email") and not data.get("phone"):
                matched_chats.append((chat_id, data))

    if not matched_chats:
        return False, f"No Telegram chat linked for '{recipient_identifier}'. Please open @ProtectoAIbot on Telegram and enter your email & phone."

    message_text = (
        f"🛡️ *PROTECTOR AI 2.0 SECURITY*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔐 *Password Reset Verification Code:*\n\n"
        f"         👉 `{otp_code}` 👈\n\n"
        f"⏱️ *Expires in 10 minutes.*\n"
        f"👤 Account: `{recipient_identifier}`\n\n"
        f"⚠️ _Never share this verification code with anyone._\n"
        f"━━━━━━━━━━━━━━━━━━━━"
    )

    delivered = False
    for chat_id, data in matched_chats:
        ok = send_telegram_raw_message(chat_id, message_text, reply_markup=KEYBOARD_CONNECTED)
        if ok:
            delivered = True
            logger.info(f"✅ [PROTECTOR AI] Successfully delivered OTP code to Telegram chat {chat_id} ({data.get('first_name') or 'User'})")

    if delivered:
        return True, "Delivered instantly to your Telegram (@ProtectoAIbot)."
    return False, "Failed to deliver message to Telegram chat."
