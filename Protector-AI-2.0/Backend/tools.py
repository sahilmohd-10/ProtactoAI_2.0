import json
import logging
import psutil
import time
from datetime import datetime, timezone, timedelta
from database import SessionLocal
from models import Incident, Camera, Zone, User, DailyMetric, AuditLog
from engine import engine_instance

logger = logging.getLogger("ProtectorAI.Tools")

# TOOL REGISTRY DEFINITIONS
TOOL_DEFINITIONS = {
    "get_system_status": {
        "name": "get_system_status",
        "description": "Retrieve live operational status of the inference engine, database, and hardware metrics (CPU, RAM, GPU).",
        "parameters": {},
        "is_mutation": False,
        "requires_confirmation": False
    },
    "get_ppe_statistics": {
        "name": "get_ppe_statistics",
        "description": "Fetch real-time PPE compliance rate, active detected workers, and violation breakdown.",
        "parameters": {
            "period": {"type": "string", "enum": ["realtime", "today", "24h", "week"], "default": "realtime"}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "list_cameras": {
        "name": "list_cameras",
        "description": "List all registered safety cameras, their connection state, resolution, and current metrics.",
        "parameters": {},
        "is_mutation": False,
        "requires_confirmation": False
    },
    "get_camera_status": {
        "name": "get_camera_status",
        "description": "Retrieve detailed telemetry and health for a specific camera ID.",
        "parameters": {
            "camera_id": {"type": "string", "required": True}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "search_incidents": {
        "name": "search_incidents",
        "description": "Search and filter recorded PPE incidents and safety violations.",
        "parameters": {
            "query": {"type": "string", "required": False},
            "severity": {"type": "string", "enum": ["Critical", "High", "Medium", "Low", "All"], "default": "All"},
            "status": {"type": "string", "enum": ["Open", "In Review", "Acknowledged", "Resolved", "All"], "default": "All"},
            "category": {"type": "string", "required": False},
            "limit": {"type": "integer", "default": 10}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "get_incident_details": {
        "name": "get_incident_details",
        "description": "Fetch comprehensive details, bounding box annotations, and audit history for an incident ID.",
        "parameters": {
            "incident_id": {"type": "string", "required": True}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "update_incident_status": {
        "name": "update_incident_status",
        "description": "Update status of an incident (e.g. Acknowledge, In Review, or Resolve with notes).",
        "parameters": {
            "incident_id": {"type": "string", "required": True},
            "status": {"type": "string", "enum": ["Open", "In Review", "Acknowledged", "Resolved"], "required": True},
            "notes": {"type": "string", "required": False},
            "assigned_to": {"type": "string", "required": False}
        },
        "is_mutation": True,
        "requires_confirmation": False
    },
    "delete_incident": {
        "name": "delete_incident",
        "description": "Permanently delete an incident record from the database. Destructive action.",
        "parameters": {
            "incident_id": {"type": "string", "required": True}
        },
        "is_mutation": True,
        "requires_confirmation": True
    },
    "get_analytics": {
        "name": "get_analytics",
        "description": "Retrieve compliance trends, category breakdowns, and time-based comparisons.",
        "parameters": {
            "days": {"type": "integer", "default": 7}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "list_zones": {
        "name": "list_zones",
        "description": "List all restricted safety zones, required PPE gear, risk ratings, and current breach status.",
        "parameters": {},
        "is_mutation": False,
        "requires_confirmation": False
    },
    "update_zone_status": {
        "name": "update_zone_status",
        "description": "Update a safety zone status (Normal, Warning, Breach) or worker count.",
        "parameters": {
            "zone_id": {"type": "string", "required": True},
            "status": {"type": "string", "enum": ["Normal", "Warning", "Breach"], "required": True}
        },
        "is_mutation": True,
        "requires_confirmation": False
    },
    "get_user_permissions": {
        "name": "get_user_permissions",
        "description": "Retrieve role-based permissions matrix and team roster.",
        "parameters": {},
        "is_mutation": False,
        "requires_confirmation": False
    },
    "generate_report": {
        "name": "generate_report",
        "description": "Generate an operational safety report in CSV or structured JSON format.",
        "parameters": {
            "period": {"type": "string", "enum": ["today", "week", "month"], "default": "today"},
            "format": {"type": "string", "enum": ["csv", "json"], "default": "csv"}
        },
        "is_mutation": False,
        "requires_confirmation": False
    },
    "navigate_to_module": {
        "name": "navigate_to_module",
        "description": "Direct the UI to navigate to a target module (console, incidents, analytics, zones, team, settings, terminal).",
        "parameters": {
            "module": {"type": "string", "enum": ["console", "incidents", "analytics", "zones", "team", "settings", "terminal"], "required": True}
        },
        "is_mutation": False,
        "requires_confirmation": False
    }
}

class ToolRegistry:
    @staticmethod
    def get_definitions():
        return list(TOOL_DEFINITIONS.values())

    @staticmethod
    def execute(tool_name: str, args: dict, user_email="system@protector.ai", confirmed=False):
        if tool_name not in TOOL_DEFINITIONS:
            return {
                "success": False,
                "error": f"Tool '{tool_name}' is not recognized in the secure tool registry."
            }

        definition = TOOL_DEFINITIONS[tool_name]

        # Check confirmation for destructive actions
        if definition["requires_confirmation"] and not confirmed:
            return {
                "success": False,
                "requires_confirmation": True,
                "confirmation_prompt": f"Action '{tool_name}' with arguments {args} is destructive. Explicit confirmation is required to proceed.",
                "tool_name": tool_name,
                "args": args
            }

        db = SessionLocal()
        try:
            handler = getattr(ToolRegistry, f"_tool_{tool_name}", None)
            if not handler:
                return {"success": False, "error": f"Tool handler for '{tool_name}' is not implemented."}

            result = handler(db, args, user_email)
            return {"success": True, "tool": tool_name, "data": result}
        except Exception as e:
            logger.error(f"Error executing tool '{tool_name}': {e}", exc_info=True)
            return {"success": False, "tool": tool_name, "error": str(e)}
        finally:
            db.close()

    # Tool Implementations
    @staticmethod
    def _tool_get_system_status(db, args, user_email):
        cpu_usage = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        model_info = engine_instance.get_model_info()

        active_cameras = db.query(Camera).filter(Camera.status == "online").count()
        total_cameras = db.query(Camera).count()
        open_incidents = db.query(Incident).filter(Incident.status.in_(["Open", "In Review"])).count()

        return {
            "system": "Protector AI 2.0 Kernel",
            "status": "Operational",
            "uptime_seconds": round(time.time() - psutil.boot_time(), 0),
            "cpu_percent": cpu_usage,
            "memory_percent": mem.percent,
            "memory_used_gb": round((mem.total - mem.available) / (1024 ** 3), 2),
            "memory_total_gb": round(mem.total / (1024 ** 3), 2),
            "model_status": model_info["status"],
            "model_path": model_info["model_path"],
            "model_device": model_info["device"],
            "model_classes": model_info["classes_count"],
            "cameras_online": f"{active_cameras}/{total_cameras}",
            "open_incidents_count": open_incidents
        }

    @staticmethod
    def _tool_get_ppe_statistics(db, args, user_email):
        period = args.get("period", "realtime")
        now = datetime.now(timezone.utc)

        # Retrieve today's metrics
        today_metric = db.query(DailyMetric).order_by(DailyMetric.id.desc()).first()
        base_rate = today_metric.compliance_rate if today_metric else 95.6
        total_workers = today_metric.total_workers if today_metric else 42
        total_violations = today_metric.total_violations if today_metric else 4

        # Real-time incident breakdown
        recent_incidents = db.query(Incident).filter(Incident.status.in_(["Open", "In Review"])).all()
        breakdown = {
            "missing_hardhat": 0,
            "missing_vest": 0,
            "missing_mask": 0,
            "missing_gloves": 0,
            "zone_breach": 0
        }
        for inc in recent_incidents:
            cat = inc.category.lower()
            if "hardhat" in cat:
                breakdown["missing_hardhat"] += 1
            elif "vest" in cat:
                breakdown["missing_vest"] += 1
            elif "mask" in cat:
                breakdown["missing_mask"] += 1
            elif "gloves" in cat:
                breakdown["missing_gloves"] += 1
            elif "zone" in cat:
                breakdown["zone_breach"] += 1

        return {
            "period": period,
            "compliance_rate": base_rate,
            "active_workers_monitored": total_workers,
            "active_violations": total_violations,
            "open_incidents_breakdown": breakdown,
            "target_ppe": ["Hardhat", "Safety Vest", "Mask", "Gloves"]
        }

    @staticmethod
    def _tool_list_cameras(db, args, user_email):
        cams = db.query(Camera).all()
        return [c.to_dict() for c in cams]

    @staticmethod
    def _tool_get_camera_status(db, args, user_email):
        cid = args.get("camera_id")
        cam = db.query(Camera).filter(Camera.id == cid).first()
        if not cam:
            return {"error": f"Camera with ID '{cid}' not found."}
        return cam.to_dict()

    @staticmethod
    def _tool_search_incidents(db, args, user_email):
        query = args.get("query")
        severity = args.get("severity", "All")
        status = args.get("status", "All")
        category = args.get("category")
        limit = args.get("limit", 1000)
        try:
            limit = int(limit)
        except Exception:
            limit = 1000

        q = db.query(Incident)

        if severity and severity != "All":
            q = q.filter(Incident.severity == severity)
        if status and status != "All":
            q = q.filter(Incident.status == status)
        if category:
            q = q.filter(Incident.category.ilike(f"%{category}%"))
        if query:
            q = q.filter(
                (Incident.worker_id.ilike(f"%{query}%")) |
                (Incident.title.ilike(f"%{query}%")) |
                (Incident.location.ilike(f"%{query}%")) |
                (Incident.assigned_to.ilike(f"%{query}%")) |
                (Incident.id.ilike(f"%{query}%")) |
                (Incident.category.ilike(f"%{query}%"))
            )

        q = q.order_by(Incident.timestamp.desc())
        if limit and limit > 0:
            q = q.limit(limit)
        incidents = q.all()
        return [i.to_dict() for i in incidents]

    @staticmethod
    def _tool_get_incident_details(db, args, user_email):
        inc_id = args.get("incident_id")
        inc = db.query(Incident).filter(Incident.id == inc_id).first()
        if not inc:
            return {"error": f"Incident '{inc_id}' not found."}
        return inc.to_dict()

    @staticmethod
    def _tool_update_incident_status(db, args, user_email):
        inc_id = args.get("incident_id")
        new_status = args.get("status")
        notes = args.get("notes")
        assigned_to = args.get("assigned_to")

        inc = db.query(Incident).filter(Incident.id == inc_id).first()
        if not inc:
            return {"error": f"Incident '{inc_id}' not found."}

        inc.status = new_status
        if notes:
            inc.resolution_notes = (inc.resolution_notes + "\n" + notes).strip()
        if assigned_to:
            inc.assigned_to = assigned_to
        if new_status == "Resolved":
            inc.resolved_at = datetime.now(timezone.utc)

        # Record audit log
        audit = AuditLog(
            user_email=user_email,
            action="UPDATE_INCIDENT",
            details=f"Incident {inc_id} updated to status {new_status}."
        )
        db.add(audit)
        db.commit()

        return inc.to_dict()

    @staticmethod
    def _tool_delete_incident(db, args, user_email):
        inc_id = args.get("incident_id")
        inc = db.query(Incident).filter(Incident.id == inc_id).first()
        if not inc:
            return {"error": f"Incident '{inc_id}' not found."}

        db.delete(inc)
        audit = AuditLog(
            user_email=user_email,
            action="DELETE_INCIDENT",
            details=f"Incident {inc_id} was deleted by {user_email}."
        )
        db.add(audit)
        db.commit()

        return {"deleted": True, "incident_id": inc_id}

    @staticmethod
    def _tool_get_analytics(db, args, user_email):
        days = args.get("days", 7)
        metrics = db.query(DailyMetric).order_by(DailyMetric.date.asc()).limit(days).all()

        category_counts = {
            "Missing Hardhat": 14,
            "Missing Safety Vest": 9,
            "Missing Mask": 5,
            "Missing Gloves": 7,
            "Zone Breach": 3
        }

        hourly_distribution = [
            {"hour": "06:00", "count": 1},
            {"hour": "08:00", "count": 4},
            {"hour": "10:00", "count": 6},
            {"hour": "12:00", "count": 3},
            {"hour": "14:00", "count": 7},
            {"hour": "16:00", "count": 5},
            {"hour": "18:00", "count": 2},
            {"hour": "20:00", "count": 0}
        ]

        return {
            "historical_metrics": [m.to_dict() for m in metrics],
            "category_distribution": category_counts,
            "hourly_distribution": hourly_distribution,
            "average_compliance": round(sum(m.compliance_rate for m in metrics) / len(metrics), 1) if metrics else 95.0
        }

    @staticmethod
    def _tool_list_zones(db, args, user_email):
        zones = db.query(Zone).all()
        return [z.to_dict() for z in zones]

    @staticmethod
    def _tool_update_zone_status(db, args, user_email):
        zid = args.get("zone_id")
        status = args.get("status")
        zone = db.query(Zone).filter(Zone.id == zid).first()
        if not zone:
            return {"error": f"Zone '{zid}' not found."}

        zone.status = status
        db.commit()
        return zone.to_dict()

    @staticmethod
    def _tool_get_user_permissions(db, args, user_email):
        users = db.query(User).all()
        matrix = {
            "Admin": ["view_console", "acknowledge_incidents", "resolve_incidents", "delete_incidents", "manage_zones", "manage_team", "terminal_exec", "export_reports"],
            "Safety Manager": ["view_console", "acknowledge_incidents", "resolve_incidents", "manage_zones", "export_reports"],
            "Site Supervisor": ["view_console", "acknowledge_incidents", "view_zones", "export_reports"],
            "Auditor": ["view_console", "view_incidents", "view_analytics", "export_reports"]
        }
        return {
            "users": [u.to_dict() for u in users],
            "permission_matrix": matrix
        }

    @staticmethod
    def _tool_generate_report(db, args, user_email):
        period = args.get("period", "today")
        fmt = args.get("format", "csv")
        incidents = db.query(Incident).order_by(Incident.timestamp.desc()).all()

        if fmt == "csv":
            lines = ["Incident ID,Title,Category,Severity,Status,Location,Worker ID,Timestamp,Assigned To"]
            for i in incidents:
                lines.append(f'"{i.id}","{i.title}","{i.category}","{i.severity}","{i.status}","{i.location}","{i.worker_id}","{i.timestamp}","{i.assigned_to}"')
            csv_content = "\n".join(lines)
            return {
                "period": period,
                "format": "csv",
                "filename": f"safety_report_{period}_{int(time.time())}.csv",
                "content": csv_content,
                "count": len(incidents)
            }
        else:
            return {
                "period": period,
                "format": "json",
                "count": len(incidents),
                "data": [i.to_dict() for i in incidents]
            }

    @staticmethod
    def _tool_navigate_to_module(db, args, user_email):
        mod = args.get("module")
        return {
            "action": "NAVIGATE",
            "target": mod,
            "message": f"Navigating to {mod.capitalize()} module."
        }
