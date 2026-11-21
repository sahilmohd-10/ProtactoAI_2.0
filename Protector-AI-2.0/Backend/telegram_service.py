"""
Protector AI 2.0 — Telegram Notification & OTP Service
Delivers instant, 100% free security OTPs and system alerts directly via Telegram Bot (@ProtectoAIbot).
"""

import os
import json
import logging
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

def _get_bot_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

def load_subscribers() -> Dict[str, dict]:
    """Loads stored chat_id mappings: { chat_id: { username, first_name, email } }"""
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

def sync_telegram_updates() -> int:
    """
    Polls getUpdates from Telegram Bot API to automatically discover any users
    who clicked /start or messaged @ProtectoAIbot.
    Returns number of newly discovered subscribers.
    """
    token = _get_bot_token()
    if not token:
        return 0

    url = f"https://api.telegram.org/bot{token}/getUpdates"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Protector-AI-Telegram-Client/2.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data.get("ok"):
                return 0

            results = data.get("result", [])
            subs = load_subscribers()
            new_count = 0

            for update in results:
                msg = update.get("message") or update.get("channel_post") or {}
                chat = msg.get("chat") or {}
                chat_id = str(chat.get("id", ""))
                if not chat_id:
                    continue

                text = (msg.get("text") or "").strip()
                username = chat.get("username") or ""
                first_name = chat.get("first_name") or ""

                if chat_id not in subs:
                    subs[chat_id] = {
                        "chat_id": chat_id,
                        "username": username,
                        "first_name": first_name,
                        "email": "",
                        "updated_at": msg.get("date")
                    }
                    new_count += 1
                    # Send friendly welcome reply to newly discovered chat
                    send_telegram_raw_message(
                        chat_id,
                        f"👋 Hello {first_name or 'Operator'}!\n\n"
                        f"🛡️ *Protector AI 2.0 Security Bot is active!*\n"
                        f"Your account is now linked to receive real-time verification OTPs, security passkeys, and safety alerts."
                    )

                # If user typed an email address, bind it
                if "@" in text and "." in text:
                    candidate_email = text.lower().strip()
                    subs[chat_id]["email"] = candidate_email

            if new_count > 0 or any(update for update in results):
                save_subscribers(subs)

            return new_count
    except Exception as err:
        logger.warning(f"⚠️ Telegram getUpdates notice: {err}")
        return 0

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

def send_telegram_otp(recipient_email: str, otp_code: str) -> Tuple[bool, str]:
    """
    Sends a formatted 6-digit verification OTP to Telegram.
    Picks matching subscriber by email, or broadcasts to active chats if single-tenant workspace.
    """
    token = _get_bot_token()
    if not token:
        return False, "Telegram Bot Token is not configured in .env."

    # First sync any recent /start messages from bot
    sync_telegram_updates()

    subs = load_subscribers()
    if not subs:
        return False, "No active Telegram chats found. Please open t.me/ProtectoAIbot and click /start."

    message_text = (
        f"🛡️ *PROTECTOR AI 2.0 SECURITY*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔐 *Password Reset Verification Code:*\n\n"
        f"      `{otp_code}`\n\n"
        f"⏱️ *Expires in 10 minutes.*\n"
        f"👤 Account: `{recipient_email}`\n\n"
        f"⚠️ _Never share this verification code with anyone._\n"
        f"━━━━━━━━━━━━━━━━━━━━"
    )

    # Deliver to matching chat by email or all registered admins
    delivered = False
    for chat_id, data in subs.items():
        # Match email if set, or deliver to active chats
        if not data.get("email") or data.get("email").lower() == recipient_email.lower() or len(subs) <= 3:
            ok = send_telegram_raw_message(chat_id, message_text)
            if ok:
                delivered = True
                logger.info(f"✅ [PROTECTOR AI] Successfully delivered OTP code to Telegram chat {chat_id} (@{data.get('username') or 'User'})")

    if delivered:
        return True, "Delivered instantly to your Telegram (@ProtectoAIbot)."
    return False, "Failed to deliver message to Telegram chat."
