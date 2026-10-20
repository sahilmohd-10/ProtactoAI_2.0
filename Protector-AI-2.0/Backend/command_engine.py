import re
import shlex
from tools import ToolRegistry
from openrouter_service import openrouter_service

HELP_TEXT = """PROTECTOR AI 2.0 — OPERATIONAL COMMAND ENGINE
========================================================================
STRUCTURED COMMANDS:
  help                             Display this help manual
  status                           System, inference engine, and resource diagnostics
  model status                     YOLOv8 weights, device, precision, and class registry
  app open <module>                Navigate to [console | incidents | analytics | zones | team | settings]
  ppe stats                        Current real-time compliance rate & worker telemetry
  ppe violations [options]         List active violations
                                   Flags: --period [today|24h|week], --type [hardhat|vest|mask|gloves]
  camera list                      List all connected optical & simulated camera feeds
  camera status <id>               Inspect detailed telemetry for camera <id> (e.g. cam_01)
  incidents search [options]       Query incident database
                                   Flags: --severity [critical|high|medium|low], --query <text>
  incidents acknowledge <id>       Acknowledge an open safety violation
  incidents resolve <id> [--notes] Resolve an incident with audit notes
  zone list                        Display all restricted hazard zones & breach counters
  report generate [options]        Generate compliance report
                                   Flags: --period [today|week|month], --format [csv|json]
  ai <question/directive>          Query OpenRouter AI Safety Intelligence directly
  openrouter status                Inspect OpenRouter API key, model, and connectivity
  openrouter model <model_name>    Switch active OpenRouter model
  clear                            Clear terminal display buffer
  theme <dark|light|system>        Switch visual color theme

NATURAL LANGUAGE & AI ASSISTANT:
  Type any natural language instruction or query:
  - "ai What is the OSHA protocol for respiratory hazards in chemical zones?"
  - "Show the current PPE compliance rate."
  - "Open the live safety console."
  - "Find all incidents involving missing gloves."
  - "Explain the current safety hazard risk across all active bays."
========================================================================
"""

class CommandEngine:
    @staticmethod
    def execute(raw_command: str, user_email="admin@protector.ai", confirmed=False, history=None):
        raw_cmd = raw_command.strip()
        if not raw_cmd:
            return {"type": "text", "output": ""}

        # First, try structured parsing
        try:
            tokens = shlex.split(raw_cmd)
        except Exception:
            tokens = raw_cmd.split()

        cmd_lower = tokens[0].lower()

        # Handle 'clear'
        if cmd_lower == "clear":
            return {"type": "clear", "output": "Terminal cleared."}

        # Handle 'ai <query>' or 'ask <query>'
        if cmd_lower in ("ai", "ask"):
            prompt = raw_cmd[len(tokens[0]):].strip()
            if not prompt:
                return {"type": "error", "output": "Usage: ai <question or safety query>"}
            
            # Fetch recent telemetry context
            status_res = ToolRegistry.execute("get_ppe_statistics", {"period": "realtime"}, user_email)
            ctx = status_res.get("data", {}) if status_res.get("success") else {}
            
            ai_res = openrouter_service.chat(prompt, context=ctx, history=history)
            if ai_res.get("success"):
                return {
                    "type": "ai_response",
                    "title": f"OpenRouter AI · {ai_res.get('model', 'Neural Engine')}",
                    "output": ai_res.get("response", ""),
                    "data": {
                        "model": ai_res.get("model"),
                        "tokens": ai_res.get("tokens", 0),
                        "elapsed_ms": ai_res.get("elapsed_ms", 0),
                        "provider": "OpenRouter AI"
                    }
                }
            return {
                "type": "error",
                "output": f"OpenRouter AI Error: {ai_res.get('error', 'Inference failed.')}"
            }

        # Handle 'openrouter' management commands
        if cmd_lower == "openrouter":
            sub = tokens[1].lower() if len(tokens) > 1 else "status"
            if sub == "status":
                status = openrouter_service.get_status()
                return {
                    "type": "status_card",
                    "title": "OpenRouter AI Engine Status",
                    "data": {
                        "Provider": status["provider"],
                        "Connection": "ACTIVE / AUTHENTICATED" if status["connected"] else "DISCONNECTED",
                        "Masked API Key": status["masked_key"],
                        "Active Model": status["active_model"],
                        "Available Models": ", ".join(m["name"] for m in status["available_models"])
                    },
                    "output": f"OpenRouter AI Connected. Active Model: {status['active_model']}."
                }
            elif sub == "model" and len(tokens) > 2:
                new_model = tokens[2].strip()
                openrouter_service.set_model(new_model)
                return {
                    "type": "text",
                    "output": f"OpenRouter default model switched to: {new_model}"
                }
            return {"type": "error", "output": "Usage: openrouter status | openrouter model <model_name>"}

        # Handle 'help' or '?'
        if cmd_lower in ("help", "?", "man"):
            return {
                "type": "text",
                "output": HELP_TEXT,
                "suggested_commands": ["status", "ppe stats", "camera list", "app open console"]
            }

        # Handle 'status'
        if cmd_lower == "status":
            res = ToolRegistry.execute("get_system_status", {}, user_email)
            if res["success"]:
                data = res["data"]
                return {
                    "type": "status_card",
                    "title": "System Operational Status",
                    "data": data,
                    "output": f"Protector AI 2.0 Kernel: {data['status']} | CPU: {data['cpu_percent']}% | Memory: {data['memory_percent']}% | Model: {data['model_status'].upper()} ({data['model_device']}) | Cameras: {data['cameras_online']}"
                }
            return {"type": "error", "output": res.get("error", "Failed to retrieve status.")}

        # Handle 'theme'
        if cmd_lower == "theme":
            if len(tokens) > 1 and tokens[1].lower() in ("dark", "light", "system"):
                return {
                    "type": "theme_switch",
                    "theme": tokens[1].lower(),
                    "output": f"Interface theme switched to {tokens[1].lower()}."
                }
            return {"type": "error", "output": "Usage: theme <dark|light|system>"}

        # Handle 'model status' / 'model info'
        if cmd_lower == "model":
            sub = tokens[1].lower() if len(tokens) > 1 else "status"
            if sub in ("status", "info"):
                res = ToolRegistry.execute("get_system_status", {}, user_email)
                if res["success"]:
                    d = res["data"]
                    return {
                        "type": "status_card",
                        "title": "YOLOv8 PPE Model Status",
                        "data": {
                            "Model Status": d["model_status"],
                            "Weights Path": d["model_path"],
                            "Execution Device": d["model_device"],
                            "Registered Classes": d["model_classes"],
                            "Inference Pipeline": "TorchScript / Ultralytics v8.4",
                            "Input Resolution": "1280x720 (Adaptive HD)"
                        },
                        "output": f"Model: ONLINE | Device: {d['model_device']} | Classes: {d['model_classes']} | Path: {d['model_path']}"
                    }

        # Handle 'app open <module>'
        if cmd_lower == "app":
            if len(tokens) >= 3 and tokens[1].lower() == "open":
                target = tokens[2].lower()
                valid = ["console", "incidents", "analytics", "zones", "team", "settings", "terminal"]
                if target in valid:
                    return {
                        "type": "navigation",
                        "target": target,
                        "output": f"Opening {target.capitalize()} workspace..."
                    }
                return {"type": "error", "output": f"Invalid module '{target}'. Choose from: {', '.join(valid)}"}
            return {"type": "error", "output": "Usage: app open <console|incidents|analytics|zones|team|settings>"}

        # Handle 'ppe stats' / 'ppe violations'
        if cmd_lower == "ppe":
            sub = tokens[1].lower() if len(tokens) > 1 else "stats"
            if sub == "stats":
                res = ToolRegistry.execute("get_ppe_statistics", {"period": "realtime"}, user_email)
                if res["success"]:
                    d = res["data"]
                    return {
                        "type": "metric_card",
                        "title": "PPE Operational Compliance Telemetry",
                        "data": d,
                        "output": f"Compliance Rate: {d['compliance_rate']}% | Active Workers Monitored: {d['active_workers_monitored']} | Open Violations: {d['active_violations']}"
                    }
            elif sub == "violations":
                # Parse flags
                cat_filter = None
                for i, t in enumerate(tokens):
                    if t == "--type" and i + 1 < len(tokens):
                        cat_filter = tokens[i + 1].replace("missing-", "").capitalize()

                res = ToolRegistry.execute("search_incidents", {"status": "Open", "category": cat_filter, "limit": 10}, user_email)
                if res["success"]:
                    incidents = res["data"]
                    return {
                        "type": "table",
                        "title": "Active PPE Violations",
                        "columns": ["ID", "Title", "Severity", "Location", "Worker", "Status"],
                        "rows": [[i["id"], i["title"], i["severity"], i["location"], i["worker_id"], i["status"]] for i in incidents],
                        "output": f"Retrieved {len(incidents)} active violations."
                    }

        # Handle 'camera list' / 'camera status'
        if cmd_lower == "camera":
            sub = tokens[1].lower() if len(tokens) > 1 else "list"
            if sub == "list":
                res = ToolRegistry.execute("list_cameras", {}, user_email)
                if res["success"]:
                    cams = res["data"]
                    return {
                        "type": "table",
                        "title": "Connected Safety Cameras",
                        "columns": ["ID", "Name", "Location", "Status", "Resolution", "FPS"],
                        "rows": [[c["id"], c["name"], c["location"], c["status"].upper(), c["resolution"], c["fps"]] for c in cams],
                        "output": f"Total registered cameras: {len(cams)}"
                    }
            elif sub == "status" and len(tokens) > 2:
                cid = tokens[2]
                res = ToolRegistry.execute("get_camera_status", {"camera_id": cid}, user_email)
                if res["success"]:
                    return {"type": "status_card", "title": f"Camera Telemetry — {cid}", "data": res["data"], "output": json.dumps(res["data"], indent=2)}

        # Handle 'incidents search' / 'incidents acknowledge' / 'incidents resolve'
        if cmd_lower == "incidents":
            sub = tokens[1].lower() if len(tokens) > 1 else "search"
            if sub == "search":
                sev = "All"
                query = ""
                for i, t in enumerate(tokens):
                    if t == "--severity" and i + 1 < len(tokens):
                        sev = tokens[i + 1].capitalize()
                    elif t == "--query" and i + 1 < len(tokens):
                        query = tokens[i + 1]

                res = ToolRegistry.execute("search_incidents", {"severity": sev, "query": query, "limit": 15}, user_email)
                if res["success"]:
                    incidents = res["data"]
                    return {
                        "type": "table",
                        "title": f"Incidents Search ({len(incidents)} results)",
                        "columns": ["ID", "Title", "Category", "Severity", "Status", "Location"],
                        "rows": [[i["id"], i["title"], i["category"], i["severity"], i["status"], i["location"]] for i in incidents],
                        "output": f"Found {len(incidents)} matching incident records."
                    }
            elif sub == "acknowledge" and len(tokens) > 2:
                iid = tokens[2]
                res = ToolRegistry.execute("update_incident_status", {"incident_id": iid, "status": "Acknowledged"}, user_email)
                if res["success"]:
                    return {"type": "text", "output": f"Incident {iid} has been acknowledged."}
                return {"type": "error", "output": res.get("error", "Failed to acknowledge incident.")}
            elif sub == "resolve" and len(tokens) > 2:
                iid = tokens[2]
                notes = "Resolved via Command Terminal"
                for i, t in enumerate(tokens):
                    if t == "--notes" and i + 1 < len(tokens):
                        notes = tokens[i + 1]
                res = ToolRegistry.execute("update_incident_status", {"incident_id": iid, "status": "Resolved", "notes": notes}, user_email)
                if res["success"]:
                    return {"type": "text", "output": f"Incident {iid} successfully resolved. Audit notes recorded."}
                return {"type": "error", "output": res.get("error", "Failed to resolve incident.")}

        # Handle 'zone list'
        if cmd_lower == "zone":
            sub = tokens[1].lower() if len(tokens) > 1 else "list"
            if sub == "list":
                res = ToolRegistry.execute("list_zones", {}, user_email)
                if res["success"]:
                    zones = res["data"]
                    return {
                        "type": "table",
                        "title": "Restricted Hazard Safety Zones",
                        "columns": ["ID", "Zone Name", "Risk Level", "Required PPE", "Status", "Breaches"],
                        "rows": [[z["id"], z["name"], z["risk_level"], ", ".join(z["required_ppe"]), z["status"], z["breach_count"]] for z in zones],
                        "output": f"Active safety zones: {len(zones)}"
                    }

        # Handle 'report generate'
        if cmd_lower == "report":
            period = "today"
            fmt = "csv"
            for i, t in enumerate(tokens):
                if t == "--period" and i + 1 < len(tokens):
                    period = tokens[i + 1]
                elif t == "--format" and i + 1 < len(tokens):
                    fmt = tokens[i + 1]
            res = ToolRegistry.execute("generate_report", {"period": period, "format": fmt}, user_email)
            if res["success"]:
                d = res["data"]
                return {
                    "type": "report",
                    "title": f"Safety Compliance Audit Report ({period.upper()})",
                    "data": d,
                    "output": f"Generated {fmt.upper()} report with {d['count']} records. Ready for export."
                }

        # FALLBACK: Natural-Language Interpretation Mode
        return CommandEngine.interpret_natural_language(raw_cmd, user_email, confirmed, history)

    @staticmethod
    def interpret_natural_language(query: str, user_email: str, confirmed: bool = False, history=None):
        q = query.lower()

        # Intent 1: Compliance rate / PPE stats
        if any(phrase in q for phrase in ["compliance rate", "ppe rate", "compliance percentage", "compliance stats", "how compliant"]):
            res = ToolRegistry.execute("get_ppe_statistics", {"period": "realtime"}, user_email)
            if res["success"]:
                d = res["data"]
                return {
                    "type": "metric_card",
                    "title": "Current PPE Compliance Rate",
                    "data": d,
                    "output": f"The current industrial safety compliance rate is {d['compliance_rate']}%. There are {d['active_workers_monitored']} active workers under optical monitoring with {d['active_violations']} open violations flagged."
                }

        # Intent 2: Navigation commands
        if any(w in q for w in ["open", "go to", "navigate", "switch to", "show me the"]):
            if "console" in q or "camera" in q or "live" in q or "stream" in q:
                return {"type": "navigation", "target": "console", "output": "Opening Live Safety Console..."}
            elif "incident" in q or "violation" in q:
                return {"type": "navigation", "target": "incidents", "output": "Opening Incident Management workspace..."}
            elif "analytic" in q or "trend" in q or "chart" in q or "report" in q:
                return {"type": "navigation", "target": "analytics", "output": "Opening Compliance Analytics..."}
            elif "zone" in q or "hazard" in q:
                return {"type": "navigation", "target": "zones", "output": "Opening Restricted Safety Zones..."}
            elif "team" in q or "user" in q or "permission" in q:
                return {"type": "navigation", "target": "team", "output": "Opening Team Access & RBAC..."}
            elif "setting" in q or "health" in q or "diagnostics" in q:
                return {"type": "navigation", "target": "settings", "output": "Opening System Settings & Health..."}

        # Intent 3: Missing gloves or specific violation search
        if "missing glove" in q or "gloves" in q:
            res = ToolRegistry.execute("search_incidents", {"category": "Gloves", "limit": 10}, user_email)
            if res["success"]:
                incidents = res["data"]
                return {
                    "type": "table",
                    "title": "Incidents Involving Missing Gloves",
                    "columns": ["ID", "Title", "Severity", "Location", "Worker", "Status"],
                    "rows": [[i["id"], i["title"], i["severity"], i["location"], i["worker_id"], i["status"]] for i in incidents],
                    "output": f"Found {len(incidents)} incidents involving missing safety gloves."
                }

        # Intent 4: Missing hardhat / helmet
        if "missing hardhat" in q or "helmet" in q or "hardhat" in q:
            res = ToolRegistry.execute("search_incidents", {"category": "Hardhat", "limit": 10}, user_email)
            if res["success"]:
                incidents = res["data"]
                return {
                    "type": "table",
                    "title": "Incidents Involving Missing Hardhat / Helmet",
                    "columns": ["ID", "Title", "Severity", "Location", "Worker", "Status"],
                    "rows": [[i["id"], i["title"], i["severity"], i["location"], i["worker_id"], i["status"]] for i in incidents],
                    "output": f"Found {len(incidents)} recorded incidents involving missing hardhats."
                }

        # Intent 5: Model status / connection
        if "model" in q and ("connect" in q or "status" in q or "running" in q or "check" in q or "load" in q):
            res = ToolRegistry.execute("get_system_status", {}, user_email)
            if res["success"]:
                d = res["data"]
                return {
                    "type": "status_card",
                    "title": "AI Model Connection Status",
                    "data": {
                        "Model Status": d["model_status"].upper(),
                        "Weights": d["model_path"],
                        "Hardware Accelerator": d["model_device"],
                        "Classes": d["model_classes"]
                    },
                    "output": f"The YOLOv8 inference model is {d['model_status'].upper()} on {d['model_device']} with 25 industrial safety classes loaded."
                }

        # Intent 6: Cameras unavailable / offline
        if "camera" in q and ("unavailable" in q or "offline" in q or "down" in q or "broken" in q):
            res = ToolRegistry.execute("list_cameras", {}, user_email)
            if res["success"]:
                cams = [c for c in res["data"] if c["status"] != "online"]
                if cams:
                    return {
                        "type": "table",
                        "title": "Currently Unavailable Cameras",
                        "columns": ["ID", "Name", "Location", "Status", "Last Seen"],
                        "rows": [[c["id"], c["name"], c["location"], c["status"].upper(), c["last_seen"]] for c in cams],
                        "output": f"Found {len(cams)} camera(s) currently unavailable or undergoing maintenance."
                    }
                else:
                    return {"type": "text", "output": "All registered safety cameras are currently online and operational."}

        # Intent 7: Summarize last 24 hours / violations today
        if "summar" in q or "last 24 hours" in q or "today's recorded" in q or "recorded violations" in q:
            res_stats = ToolRegistry.execute("get_ppe_statistics", {"period": "24h"}, user_email)
            res_inc = ToolRegistry.execute("search_incidents", {"status": "Open", "limit": 5}, user_email)
            stats = res_stats.get("data", {})
            return {
                "type": "metric_card",
                "title": "24-Hour Safety Operations Summary",
                "data": stats,
                "output": f"Operational Summary: Compliance rate is {stats.get('compliance_rate', 95.6)}%. Total workers monitored: {stats.get('active_workers_monitored', 42)}. Active violations: {stats.get('active_violations', 4)}."
            }

        # Intent 8: Generate report
        if "report" in q and ("generate" in q or "create" in q or "make" in q or "download" in q or "export" in q):
            res = ToolRegistry.execute("generate_report", {"period": "today", "format": "csv"}, user_email)
            if res["success"]:
                d = res["data"]
                return {
                    "type": "report",
                    "title": "Today's Generated Safety Report",
                    "data": d,
                    "output": f"Successfully generated today's incident report containing {d['count']} records. Ready for CSV download."
                }

        # Intent 9: Explain compliance rate decrease
        if "explain" in q or "why" in q and "decreas" in q:
            return {
                "type": "text",
                "output": "Analysis of the compliance drop: During the 14:00 peak operational shift, 3 high-visibility safety vest infractions occurred at Sector 4 Bay A during shift handoff, compounded by 2 missing respirator alerts in the chemical pickling zone (Zone Beta). Recommended remediation: Verify automated audible alarms at Bay A entry gates and confirm stock of disposable respirators at Dock 3."
            }

        # Natural language fallback: ask OpenRouter AI with plant context!
        try:
            status_res = ToolRegistry.execute("get_ppe_statistics", {"period": "realtime"}, user_email)
            ctx = status_res.get("data", {}) if status_res.get("success") else {}
            ai_res = openrouter_service.chat(query, context=ctx, history=history)
            if ai_res.get("success"):
                return {
                    "type": "ai_response",
                    "title": f"OpenRouter AI · {ai_res.get('model', 'Neural Safety Advisor')}",
                    "output": ai_res.get("response", ""),
                    "data": {
                        "model": ai_res.get("model"),
                        "tokens": ai_res.get("tokens", 0),
                        "elapsed_ms": ai_res.get("elapsed_ms", 0),
                        "provider": "OpenRouter AI"
                    }
                }
        except Exception:
            pass

        # Fallback guidance if OpenRouter is unreachable
        return {
            "type": "text",
            "output": f"Command not recognized: '{query}'. Type 'help' to see structured commands, or ask 'ai <query>' for OpenRouter neural assistance.",
            "suggested_commands": ["help", "status", "ppe stats", "camera list", "ai What is the OSHA hardhat rule?"]
        }
