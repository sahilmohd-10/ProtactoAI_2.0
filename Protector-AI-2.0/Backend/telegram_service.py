"""
Protector AI 2.0 — Telegram Notification & OTP Service
Delivers instant, 100% free security OTPs and system alerts directly via Telegram Bot (@ProtectoAIbot).
Allows any team member to link their account by typing their email or phone number in Telegram.
"""

import os
import re
import json
import time
import logging
import threading
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
load_dotenv()

logger = logging.getLogger("ProtectorAI.Telegram")

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
CHATS_FILE = os.path.join(DATA_DIR, "telegram_subscribers.json")
OFFSET_FILE = os.path.join(DATA_DIR, "telegram_offset.json")

_polling_thread: Optional[threading.Thread] = None
_polling_active = False

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(\+?[0-9]{10,14})")


def _get_bot_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def load_subscribers() -> Dict[str, dict]:
    """Loads stored chat_id mappings: { chat_id: { username, first_name, email, phone, updated_at } }"""
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


def send_telegram_raw_message(chat_id: str, text: str) -> bool:
    """Dispatches a Markdown text message to a specific Telegram chat_id."""
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
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Protector-AI-Telegram-Client/2.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            return resp.status in (200, 201)
    except Exception as err:
        logger.warning(f"⚠️ Could not send Telegram message to chat {chat_id}: {err}")
        return False


def sync_telegram_updates() -> int:
    """
    Polls getUpdates from Telegram Bot API to automatically discover any users
    who clicked /start, or typed their email / phone number into @ProtectoAIbot.
    Returns number of newly discovered or updated subscribers.
    """
    token = _get_bot_token()
    if not token:
        return 0

    last_offset = _get_last_offset()
    offset_param = f"?offset={last_offset}&timeout=3" if last_offset else "?timeout=3"
    url = f"https://api.telegram.org/bot{token}/getUpdates{offset_param}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Protector-AI-Telegram-Client/2.0"})
        with urllib.request.urlopen(req, timeout=7) as resp:
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
                username = chat.get("username") or ""
                first_name = chat.get("first_name") or ""

                is_new = chat_id not in subs
                if is_new:
                    subs[chat_id] = {
                        "chat_id": chat_id,
                        "username": username,
                        "first_name": first_name,
                        "email": "",
                        "phone": "",
                        "updated_at": msg.get("date", int(time.time()))
                    }
                    updated_count += 1

                # Check if the message contains an email or phone number
                found_email = None
                found_phone = None

                email_match = EMAIL_REGEX.search(text)
                if email_match:
                    found_email = email_match.group(0).lower().strip()

                phone_match = PHONE_REGEX.search(text.replace(" ", "").replace("-", ""))
                if phone_match and not found_email:
                    found_phone = phone_match.group(0).strip()

                if found_email:
                    subs[chat_id]["email"] = found_email
                    subs[chat_id]["updated_at"] = int(time.time())
                    updated_count += 1
                    # Acknowledge user on Telegram
                    send_telegram_raw_message(
                        chat_id,
                        f"✅ *Account Linked Successfully!*\n\n"
                        f"👤 *Name:* {first_name or 'Operator'}\n"
                        f"📧 *Linked Email:* `{found_email}`\n"
                        f"🆔 *Chat ID:* `{chat_id}`\n\n"
                        f"🛡️ *Protector AI 2.0 is connected.* All your verification codes, OTPs, and security alerts will be sent directly to this chat in real time!"
                    )
                elif found_phone:
                    subs[chat_id]["phone"] = found_phone
                    subs[chat_id]["updated_at"] = int(time.time())
                    updated_count += 1
                    # Acknowledge user on Telegram
                    send_telegram_raw_message(
                        chat_id,
                        f"✅ *Phone Number Linked Successfully!*\n\n"
                        f"👤 *Name:* {first_name or 'Operator'}\n"
                        f"📱 *Linked Phone:* `{found_phone}`\n"
                        f"🆔 *Chat ID:* `{chat_id}`\n\n"
                        f"🛡️ *Protector AI 2.0 is connected.* All verification codes and security alerts will be sent here in real time!"
                    )
                elif is_new or text in ("/start", "/help"):
                    # Send friendly guidance prompt asking to type email or phone
                    existing_email = subs[chat_id].get("email")
                    existing_phone = subs[chat_id].get("phone")

                    status_line = ""
                    if existing_email:
                        status_line = f"Currently linked to: `{existing_email}`"
                    elif existing_phone:
                        status_line = f"Currently linked to: `{existing_phone}`"
                    else:
                        status_line = "_Not linked yet._"

                    send_telegram_raw_message(
                        chat_id,
                        f"👋 *Hello {first_name or 'Operator'}!*\n\n"
                        f"🛡️ *Welcome to Protector AI 2.0 Security Bot!*\n\n"
                        f"Status: {status_line}\n\n"
                        f"To link your account (or change it), simply reply to this message with your *registered Email Address* or *Phone Number*:\n\n"
                        f"👉 *Example:* `sahil@example.com` or `+919876543210`"
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
    """Background loop polling Telegram updates every 3 seconds."""
    global _polling_active
    logger.info("🛡️ Telegram Bot background listener active.")
    while _polling_active:
        try:
            sync_telegram_updates()
        except Exception:
            pass
        time.sleep(3.0)


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
        return False, f"No Telegram chat linked for '{recipient_identifier}'. Please send your email to @ProtectoAIbot on Telegram."

    message_text = (
        f"🛡️ *PROTECTOR AI 2.0 SECURITY*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔐 *Password Reset Verification Code:*\n\n"
        f"      `{otp_code}`\n\n"
        f"⏱️ *Expires in 10 minutes.*\n"
        f"👤 Account: `{recipient_identifier}`\n\n"
        f"⚠️ _Never share this verification code with anyone._\n"
        f"━━━━━━━━━━━━━━━━━━━━"
    )

    delivered = False
    for chat_id, data in matched_chats:
        ok = send_telegram_raw_message(chat_id, message_text)
        if ok:
            delivered = True
            logger.info(f"✅ [PROTECTOR AI] Successfully delivered OTP code to Telegram chat {chat_id} ({data.get('first_name') or 'User'})")

    if delivered:
        return True, "Delivered instantly to your Telegram (@ProtectoAIbot)."
    return False, "Failed to deliver message to Telegram chat."
