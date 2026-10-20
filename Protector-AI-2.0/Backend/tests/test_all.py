import unittest
import json
import sys
from unittest.mock import patch
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app import app
from tools import ToolRegistry
from command_engine import CommandEngine
from copilot import copilot_instance

class ProtectorAITestSuite(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_01_index_and_health(self):
        res = self.client.get("/api/system/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("status", data)
        self.assertIn("database", data)
        self.assertEqual(data["database"], "connected")

    def test_02_system_status(self):
        res = self.client.get("/api/system/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("cpu_percent", data)
        self.assertIn("model_status", data)
        self.assertEqual(data["model_status"], "online")

    def test_03_ppe_statistics(self):
        res = self.client.get("/api/ppe/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("compliance_rate", data)
        self.assertGreaterEqual(data["compliance_rate"], 0.0)

    def test_04_incidents_crud(self):
        # 1. Fetch incidents
        res = self.client.get("/api/incidents")
        self.assertEqual(res.status_code, 200)
        incidents = res.get_json()
        self.assertIsInstance(incidents, list)

        if len(incidents) == 0:
            from database import SessionLocal
            from models import Incident
            db = SessionLocal()
            inc = Incident(
                id="INC-TEST-001",
                title="Test Incident Verification",
                category="Missing Hardhat",
                severity="High",
                status="Open",
                location="Sector 4",
                camera_id="cam_01",
                worker_id="W-1"
            )
            db.add(inc)
            db.commit()
            db.close()
            res = self.client.get("/api/incidents")
            incidents = res.get_json()

        self.assertGreater(len(incidents), 0)

        # 2. Update status of first incident
        first_id = incidents[0]["id"]
        patch_res = self.client.patch(f"/api/incidents/{first_id}", json={
            "status": "Acknowledged",
            "notes": "Test verification"
        })
        self.assertEqual(patch_res.status_code, 200)
        updated = patch_res.get_json()
        self.assertEqual(updated["status"], "Acknowledged")

    def test_05_camera_fleet(self):
        res = self.client.get("/api/cameras")
        self.assertEqual(res.status_code, 200)
        cams = res.get_json()
        self.assertGreater(len(cams), 0)
        self.assertEqual(cams[0]["id"], "cam_01")

    def test_06_restricted_zones(self):
        res = self.client.get("/api/zones")
        self.assertEqual(res.status_code, 200)
        zones = res.get_json()
        self.assertGreater(len(zones), 0)

    def test_07_command_terminal_structured(self):
        # Test 'status'
        res = CommandEngine.execute("status")
        self.assertEqual(res["type"], "status_card")

        # Test 'ppe stats'
        res = CommandEngine.execute("ppe stats")
        self.assertEqual(res["type"], "metric_card")

        # Test 'app open console'
        res = CommandEngine.execute("app open console")
        self.assertEqual(res["type"], "navigation")
        self.assertEqual(res["target"], "console")

        # Test 'camera list'
        res = CommandEngine.execute("camera list")
        self.assertEqual(res["type"], "table")

    def test_08_command_terminal_natural_language(self):
        # NL: compliance rate query
        res = CommandEngine.execute("Show the current PPE compliance rate.")
        self.assertEqual(res["type"], "metric_card")
        self.assertIn("compliance", res["output"].lower())

        # NL: missing gloves search
        res = CommandEngine.execute("Find all incidents involving missing gloves.")
        self.assertEqual(res["type"], "table")

        # NL: open settings
        res = CommandEngine.execute("Open the settings page.")
        self.assertEqual(res["type"], "navigation")
        self.assertEqual(res["target"], "settings")

    def test_09_copilot_chat(self):
        res = copilot_instance.chat("What is our current safety compliance rate?")
        self.assertIn("compliance", res["message"].lower())
        self.assertGreater(len(res["tools_executed"]), 0)
        self.assertEqual(res["tools_executed"][0]["tool"], "get_ppe_statistics")

    def test_10_destructive_action_confirmation_guard(self):
        # Delete without confirmation should return requires_confirmation
        res = ToolRegistry.execute("delete_incident", {"incident_id": "INC-2026-8801"}, confirmed=False)
        self.assertFalse(res["success"])
        self.assertTrue(res.get("requires_confirmation"))

    # ==========================================
    # AUTHENTICATION & RBAC TESTS
    # ==========================================

    def test_11_auth_valid_login_and_session(self):
        # Test Administrator login
        res = self.client.post("/api/auth/login", json={
            "username_or_email": "admin",
            "password": "admin 123",
            "role": "Administrator"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["role"], "Administrator")
        self.assertTrue(len(data["token"]) >= 32)

        # Test Operator login
        res_op = self.client.post("/api/auth/login", json={
            "username_or_email": "operator",
            "password": "operator 123",
            "role": "Operator"
        })
        self.assertEqual(res_op.status_code, 200)
        data_op = res_op.get_json()
        self.assertTrue(data_op["success"])
        self.assertEqual(data_op["user"]["role"], "Operator")

    def test_12_auth_role_mismatch_prevention(self):
        # Operator attempting to log in selecting Administrator must be rejected (403)
        res = self.client.post("/api/auth/login", json={
            "username_or_email": "operator",
            "password": "operator 123",
            "role": "Administrator"
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Role mismatch", data["error"])

    def test_13_auth_invalid_credentials(self):
        res = self.client.post("/api/auth/login", json={
            "username_or_email": "admin",
            "password": "WrongPassword123!",
            "role": "Administrator"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])
        self.assertIn("Invalid", data["error"])

    def test_terminal_conversations_are_persistent_and_user_scoped(self):
        user = {"id": 987654, "email": "terminal-test@protector.ai", "role": "Operator"}
        headers = {"Authorization": "Bearer terminal-test-token"}
        with patch("app.get_current_user_from_token", return_value=(user, None)):
            create_res = self.client.post("/api/terminal/conversations", headers=headers)
            self.assertEqual(create_res.status_code, 201)
            conversation_id = create_res.get_json()["id"]

            message_res = self.client.post(
                f"/api/terminal/conversations/{conversation_id}/messages",
                json={"command": "status"},
                headers=headers
            )
            self.assertEqual(message_res.status_code, 200)
            self.assertEqual(message_res.get_json()["result"]["type"], "status_card")

            history_res = self.client.get(
                f"/api/terminal/conversations/{conversation_id}/messages",
                headers=headers
            )
            history = history_res.get_json()["history"]
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0]["command"], "status")

        other_user = {"id": 987655, "email": "other-terminal-test@protector.ai", "role": "Operator"}
        with patch("app.get_current_user_from_token", return_value=(other_user, None)):
            forbidden_res = self.client.get(
                f"/api/terminal/conversations/{conversation_id}/messages",
                headers=headers
            )
            self.assertEqual(forbidden_res.status_code, 404)

    def test_terminal_ai_uses_saved_conversation_context(self):
        prior_turns = [
            {"role": "user", "content": "What was the hardhat issue?"},
            {"role": "assistant", "content": "A missing hardhat was reported."}
        ]
        with patch("command_engine.openrouter_service.chat", return_value={
            "success": True,
            "response": "It was reported in the earlier message.",
            "model": "test-model"
        }) as chat:
            result = CommandEngine.execute("ai Where was it reported?", history=prior_turns)

        self.assertEqual(result["type"], "ai_response")
        self.assertEqual(chat.call_args.kwargs["history"], prior_turns)

    def test_face_profiles_require_admin_and_record_consented_visits(self):
        operator = {"id": 987656, "email": "people-operator@protector.ai", "role": "Operator"}
        admin = {"id": 987657, "email": "people-admin@protector.ai", "role": "Administrator"}
        headers = {"Authorization": "Bearer people-test-token"}

        with patch("app.get_current_user_from_token", return_value=(operator, None)):
            self.assertEqual(self.client.get("/api/people", headers=headers).status_code, 403)

        with patch("app.get_current_user_from_token", return_value=(admin, None)):
            missing_consent = self.client.post("/api/people", json={
                "name": "Consenting Person",
                "consent_recorded": False,
                "images": ["frame"]
            }, headers=headers)
            self.assertEqual(missing_consent.status_code, 400)

            with patch("app.face_recognition_service.create_encrypted_templates", return_value="encrypted-template"):
                enrolled = self.client.post("/api/people", json={
                    "name": "Consenting Person",
                    "consent_recorded": True,
                    "images": ["frame-1", "frame-2", "frame-3"]
                }, headers=headers)
            self.assertEqual(enrolled.status_code, 201)
            profile_id = enrolled.get_json()["id"]
            profile_data = self.client.get("/api/people", headers=headers).get_json()[0]
            self.assertNotIn("encrypted_templates", profile_data)

            recognized_match = {
                "profile_id": profile_id,
                "distance": 42.1,
                "box": (10, 10, 100, 100)
            }
            with patch("app.face_recognition_service.decode_image", return_value="decoded-frame"), \
                    patch("app.face_recognition_service.recognize", return_value=[recognized_match]):
                first_scan = self.client.post("/api/people/recognize", json={"image": "frame"}, headers=headers)
                self.assertTrue(first_scan.get_json()["matches"][0]["new_visit"])
                second_scan = self.client.post("/api/people/recognize", json={"image": "frame"}, headers=headers)
                self.assertFalse(second_scan.get_json()["matches"][0]["new_visit"])

            visits = self.client.get("/api/people/logs", headers=headers).get_json()
            person_visits = [v for v in visits if v["person_id"] == profile_id]
            self.assertEqual(len(person_visits), 1)
            self.assertEqual(person_visits[0]["name"], "Consenting Person")

            deleted = self.client.delete(f"/api/people/{profile_id}", headers=headers)
            self.assertEqual(deleted.status_code, 200)
            remaining_profiles = [p for p in self.client.get("/api/people", headers=headers).get_json() if p["id"] == profile_id]
            self.assertEqual(remaining_profiles, [])
            remaining_logs = [v for v in self.client.get("/api/people/logs", headers=headers).get_json() if v["person_id"] == profile_id]
            self.assertEqual(remaining_logs, [])

    def test_14_auth_registration_validation_and_operator_role(self):
        import time
        unique_user = f"worker_{int(time.time())}"
        reg_data = {
            "first_name": "Test",
            "last_name": "Operator",
            "username": unique_user,
            "email": f"{unique_user}@protector.ai",
            "phone_number": f"+1 555-019-{int(time.time()) % 10000:04d}",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        }
        res = self.client.post("/api/auth/register", json=reg_data)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])
        # Public registrations strictly receive the Operator role
        self.assertEqual(data["user"]["role"], "Operator")

    def test_15_auth_duplicate_username_email_phone_rejections(self):
        # 1. Duplicate username
        res = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "User",
            "username": "admin",
            "email": "brand_new_email@protector.ai",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        })
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()["error"], "This username is already taken. Please choose another username.")

        # 2. Duplicate email
        res_email = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "Email",
            "username": "brand_new_user_123",
            "email": "admin@protector.ai",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        })
        self.assertEqual(res_email.status_code, 409)
        self.assertEqual(res_email.get_json()["error"], "An account with this email address already exists.")

        # 3. Duplicate phone
        res_phone = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "Phone",
            "username": "brand_new_user_456",
            "email": "unique_email_789@protector.ai",
            "phone_number": "+1 555-010-0001",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        })
        self.assertEqual(res_phone.status_code, 409)
        self.assertEqual(res_phone.get_json()["error"], "An account with this phone number already exists.")

    def test_16_auth_me_and_logout(self):
        login_res = self.client.post("/api/auth/login", json={
            "username_or_email": "admin",
            "password": "admin 123",
            "role": "Administrator"
        })
        token = login_res.get_json()["token"]

        # Test auth/me
        me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.get_json()
        self.assertTrue(me_data["success"])
        self.assertEqual(me_data["user"]["username"], "admin")

        # Test logout
        logout_res = self.client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(logout_res.status_code, 200)

        # After logout, token should be invalid
        me_after = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_after.status_code, 401)

    # ==========================================
    # PERSISTENT CAMERA WORKER TESTS
    # ==========================================

    def test_17_persistent_camera_monitoring_lifecycle(self):
        import time

        # 1. Start Camera Worker
        start_res = self.client.post("/api/camera/cam_01/start")
        self.assertEqual(start_res.status_code, 200)
        start_data = start_res.get_json()
        self.assertTrue(start_data["success"])

        # 2. Status check
        time.sleep(0.5)
        status_res = self.client.get("/api/camera/cam_01/status")
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.get_json()
        self.assertIn(status_data["status"], ["Starting", "Running"])

        # 3. Stop Camera Worker
        stop_res = self.client.post("/api/camera/cam_01/stop")
        self.assertEqual(stop_res.status_code, 200)
        stop_data = stop_res.get_json()
        self.assertTrue(stop_data["success"])
        self.assertEqual(stop_data["status"]["status"], "Stopped")

if __name__ == "__main__":
    unittest.main()
