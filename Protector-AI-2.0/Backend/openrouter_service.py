import os
import json
import time
import httpx
import logging
from typing import Dict, Any, Optional, List
import config

logger = logging.getLogger("ProtectorAI.OpenRouter")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_SAFETY_INSTRUCTIONS = """You are Protector AI Assistant & Operations Copilot, the intelligent real-time operations, computer vision, and industrial safety assistant for Protector AI 2.0.

APPLICATION PROFILE & ARCHITECTURE:
- Platform: Protector AI 2.0 — Autonomous Optical Safety Surveillance & Workforce Operations Platform.
- Creator & Primary Developer: Mohd Sahil.
- Computer Vision Model: Custom-trained YOLOv8 neural network (best.pt, 25 industrial PPE & hazard classes: Person, Hardhat, Safety Vest, Mask, Gloves, Safety Boots, Heavy Machinery, and Hazard Zones).
- Biometric Face Recognition: YuNet CNN 5-point facial landmark alignment + SFace 128D deep feature embeddings paired with OpenCV LBPH recognition and AES-256 encrypted template vaults (biometric.key).
- Automated Attendance & Excel: Continuous optical biometric identity recognition with strict 24-hour unique person de-duplication, shift duration tracking, punctuality grading (On-Time, Late, Present, Half Day, Full Day, Overtime), automatically synchronized to local Excel at D:\\Downloads\\Attendance.xlsx.
- Telegram Bot: @ProtectoAIbot for real-time security alerts and two-factor authentication (2FA) OTP verification.
- Enrolled Personnel Biometric Registry:
  • Managed dynamically via Face Training Studio (/people). Personnel enrolled with 5-point facial geometry and SFace 128D embeddings are verified and logged in the 24-hour attendance register.
- Workspace Navigation Modules:
  • /dashboard -> Industrial Safety Surveillance Dashboard (Donezo KPI cards, PPE compliance rate, hazard bars).
  • /console -> Live Optical Surveillance Console with real-time video feed (cam_01 / Device 0 hardware camera) and incident snapshots.
  • /incidents -> Incident Management workspace (recorded infractions, severity filters, resolution notes).
  • /attendance -> Biometric Workforce & Excel Register (24h unique logs, live Excel sync, XLSX/CSV export).
  • /people -> Face Training Studio (5-second guided multi-angle face enrollment: Center, Right, Left, Up, Down).
  • /team -> Team Access & RBAC (roles: Operator, Safety Officer, Administrator, and Telegram binding).
  • /analytics -> 3D hazard visualizers and compliance historical trend graphs.
  • /settings -> Hardware diagnostics, CPU/Memory telemetry, and YOLOv8 weights status.
  • Command Terminal -> System CLI and AI operations interface.

CORE ASSISTANT GUIDELINES:
1. Helpful, Conversational & Direct: Answer the user's questions clearly, politely, intelligently, and directly.
2. User Identity Awareness: You know the authenticated user (their name, role, and email). When asked "what is my name", "who am I", or about their profile, answer directly and warmly (e.g. "You are Mohd Sahil, Administrator & Primary Developer...").
3. Application Authority: When asked how to do something (e.g., enroll a worker, sync Excel, check cameras, switch themes), explain clearly and provide the exact command (e.g., `app open people`, `attendance sync`, `camera list`, `theme dark`).
4. Industrial Safety Expertise: When asked about PPE rules or OSHA protocols, provide accurate standards (OSHA 29 CFR 1910.135 Head Protection, 1910.132 General PPE, 1910.138 Hand Protection, 1910.134 Respiratory Protection).
5. NO Robotic Refusals: NEVER output robotic bureaucratic refusal scripts, fake OSHA privacy restrictions, or deny features that exist. Facial recognition, biometrics, and Excel tracking are active core features of this application.
6. Clean Formatting: Format responses with clean markdown headings, bold highlights, and readable bullet points.
"""

CONFIG_FILE = config.DATA_DIR / "openrouter_config.json"

class OpenRouterService:
    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None):
        self.api_key = api_key or config.OPENROUTER_API_KEY
        self.default_model = default_model or config.OPENROUTER_DEFAULT_MODEL
        if not self.api_key and CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if saved.get("api_key"):
                        self.api_key = saved["api_key"]
                        config.OPENROUTER_API_KEY = self.api_key
                    if saved.get("model"):
                        self.default_model = saved["model"]
                        config.OPENROUTER_DEFAULT_MODEL = self.default_model
            except Exception as e:
                logger.warning(f"Could not load persisted OpenRouter config: {e}")

    def set_api_key(self, api_key: str):
        if api_key and api_key.strip():
            self.api_key = api_key.strip()
            config.OPENROUTER_API_KEY = self.api_key
            self._save_config()

    def set_model(self, model: str):
        if model and model.strip():
            self.default_model = model.strip()
            config.OPENROUTER_DEFAULT_MODEL = self.default_model
            self._save_config()

    def _save_config(self):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump({"api_key": self.api_key, "model": self.default_model}, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not persist OpenRouter config: {e}")

    def get_status(self) -> Dict[str, Any]:
        has_key = bool(self.api_key and self.api_key.startswith("sk-or-v1-"))
        masked_key = ""
        if has_key:
            masked_key = f"{self.api_key[:12]}...{self.api_key[-6:]}"

        return {
            "provider": "OpenRouter AI",
            "connected": has_key,
            "masked_key": masked_key,
            "active_model": self.default_model,
            "available_models": [
                {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini (Fast & Intelligent)", "tier": "Low Latency"},
                {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B Instruct", "tier": "High Precision"},
                {"id": "deepseek/deepseek-chat", "name": "DeepSeek Chat V3", "tier": "Advanced Reasoning"}
            ]
        }

    def chat(self, prompt: str, context: Optional[Dict[str, Any]] = None,
             model: Optional[str] = None, custom_api_key: Optional[str] = None,
             history: Optional[List[Dict[str, str]]] = None,
             user_profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        key = custom_api_key or self.api_key
        selected_model = model or self.default_model
        t0 = time.time()

        if not key:
            return {
                "success": False,
                "api_key_missing": True,
                "error": "OpenRouter API Key is missing. Please configure your sk-or-v1-... key.",
                "response": "OpenRouter API key is not configured. Please supply a valid key in the Console.",
                "model": selected_model
            }

        messages = [
            {"role": "system", "content": SYSTEM_SAFETY_INSTRUCTIONS}
        ]

        if user_profile:
            u_name = user_profile.get("name") or "Mohd Sahil"
            u_role = user_profile.get("role") or "Administrator"
            u_email = user_profile.get("email") or "admin@protector.ai"
            user_summary = (
                f"CURRENT AUTHENTICATED USER CONTEXT:\n"
                f"- Name: {u_name}\n"
                f"- Role: {u_role}\n"
                f"- Email: {u_email}\n"
                f"- Authority: Full administrative, optical surveillance, and workforce command access.\n"
            )
            messages.append({"role": "system", "content": user_summary})

        if context:
            ctx_summary = (
                f"CURRENT INDUSTRIAL TELEMETRY CONTEXT:\n"
                f"- Active Camera: {context.get('camera_id', 'cam_01 (Device 0 Hardware Camera)')}\n"
                f"- Monitored Workers: {context.get('workers', context.get('active_workers_monitored', 3))}\n"
                f"- Compliance Rate: {context.get('compliance_rate', 98.4)}%\n"
                f"- Active Infractions: {context.get('violations', context.get('active_violations', 0))}\n"
                f"- Enrolled Personnel: {context.get('enrolled_personnel', 'Configured dynamically in Face Training Studio')}\n"
                f"- Live Excel Mirror: D:\\Downloads\\Attendance.xlsx (Auto-Synchronized)\n"
            )
            messages.append({"role": "system", "content": ctx_summary})

        if history:
            for message in history[-20:]:
                role = message.get("role")
                content = message.get("content")
                if role in ("user", "assistant") and isinstance(content, str):
                    messages.append({"role": role, "content": content[:4000]})

        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Protector AI 2.0 Platform"
        }

        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 800
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                res = client.post(OPENROUTER_URL, headers=headers, json=payload)

            if res.status_code == 200:
                data = res.json()
                choice = data.get("choices", [{}])[0]
                content = choice.get("message", {}).get("content", "")
                elapsed_ms = round((time.time() - t0) * 1000, 1)

                return {
                    "success": True,
                    "response": content,
                    "model": data.get("model", selected_model),
                    "tokens": data.get("usage", {}).get("total_tokens", 0),
                    "elapsed_ms": elapsed_ms,
                    "provider": "OpenRouter AI"
                }
            else:
                logger.error(f"OpenRouter returned {res.status_code}: {res.text}")
                return {
                    "success": False,
                    "error": f"OpenRouter API returned HTTP {res.status_code}",
                    "details": res.text,
                    "model": selected_model
                }

        except Exception as e:
            logger.error(f"Failed to query OpenRouter: {e}")
            return {
                "success": False,
                "error": str(e),
                "model": selected_model
            }

    def analyze_scene(self, camera_id: str, telemetry: Dict[str, Any],
                      model: Optional[str] = None, custom_api_key: Optional[str] = None) -> Dict[str, Any]:
        """Conduct an automated optical safety audit on the current camera scene."""
        prompt = (
            f"Perform an immediate autonomous safety inspection for Camera Bay '{camera_id}'.\n"
            f"Current Sensor Data:\n"
            f"- Workers in bay: {telemetry.get('workers', 1)}\n"
            f"- Active Violations: {telemetry.get('violations', 0)}\n"
            f"- Compliance Rate: {telemetry.get('compliance_rate', 100.0)}%\n"
            f"- Detected Objects/PPE: {telemetry.get('detected_classes', ['Person', 'Hardhat'])}\n\n"
            f"Deliver an urgent executive safety assessment covering:\n"
            f"1. RISK TIER (CRITICAL / ELEVATED / SAFE)\n"
            f"2. OSHA CITATION EXPOSURE\n"
            f"3. IMMEDIATE MARSHAL DIRECTIVE (Step-by-step action)\n"
            f"4. SENSOR CALIBRATION NOTE"
        )
        return self.chat(prompt, context=telemetry, model=model, custom_api_key=custom_api_key)

openrouter_service = OpenRouterService()
