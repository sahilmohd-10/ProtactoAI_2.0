import os
import json
import time
import httpx
import logging
from typing import Dict, Any, Optional, List
import config

logger = logging.getLogger("ProtectorAI.OpenRouter")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_SAFETY_INSTRUCTIONS = """You are Protector AI 2.0 Optical Operations & Industrial Safety Intelligence.
You serve plant managers, safety officers, and automation engineers overseeing hazardous manufacturing, petrochemical, and construction facilities.
OSHA (29 CFR 1910 / 1926) & ISO 45001 standards apply.
Your tone is precise, executive, authoritative, and actionable.
Whenever analyzing scenes or safety queries:
1. Identify immediate human hazard level (CRITICAL, HIGH, MODERATE, LOW).
2. Reference applicable safety regulations (e.g., OSHA 1910.135 for Head Protection, 1910.132 for General PPE, 1910.138 for Hand Protection, 1910.134 for Respiratory Protection).
3. Provide concrete containment actions (e.g. halt line, dispatch floor marshal, sound audible perimeter alarm).
4. Keep answers structured, concise, and formatted with clean markdown bullet points.
"""

class OpenRouterService:
    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None):
        self.api_key = api_key or config.OPENROUTER_API_KEY
        self.default_model = default_model or config.OPENROUTER_DEFAULT_MODEL

    def set_api_key(self, api_key: str):
        if api_key and api_key.strip():
            self.api_key = api_key.strip()
            config.OPENROUTER_API_KEY = self.api_key

    def set_model(self, model: str):
        if model and model.strip():
            self.default_model = model.strip()
            config.OPENROUTER_DEFAULT_MODEL = self.default_model

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
             history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        key = custom_api_key or self.api_key
        selected_model = model or self.default_model
        t0 = time.time()

        if not key:
            return {
                "success": False,
                "error": "OpenRouter API Key is missing. Please configure your sk-or-v1-... key.",
                "response": "OpenRouter API key is not configured. Please supply a valid key in the Console.",
                "model": selected_model
            }

        messages = [
            {"role": "system", "content": SYSTEM_SAFETY_INSTRUCTIONS}
        ]

        if context:
            ctx_summary = (
                f"CURRENT INDUSTRIAL TELEMETRY CONTEXT:\n"
                f"- Active Camera: {context.get('camera_id', 'cam_01')}\n"
                f"- Monitored Workers: {context.get('workers', 'N/A')}\n"
                f"- Compliance Rate: {context.get('compliance_rate', 'N/A')}%\n"
                f"- Active Infractions: {context.get('violations', 'N/A')}\n"
                f"- Detected Classes: {context.get('detected_classes', [])}\n"
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
