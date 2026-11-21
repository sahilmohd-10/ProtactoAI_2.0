import unittest
import json
import sys
import time
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

        # NL: site dress code & PPE requirements
        res = CommandEngine.execute("what a person should wear in the site")
        self.assertEqual(res["type"], "ai_response")
        self.assertIn("mandatory industrial site ppe protocol", res["output"].lower())

        # NL: greeting
        res = CommandEngine.execute("hi")
        self.assertEqual(res["type"], "ai_response")
        self.assertIn("protector ai 2.0", res["output"].lower())

        # NL / AI directive: autonomous OSHA safety audit (even without OpenRouter key)
        res = CommandEngine.execute("ai Perform an immediate autonomous OSHA safety audit on current active camera feeds, evaluating head protection and active hazard exposure.")
        self.assertEqual(res["type"], "ai_response")
        self.assertIn("osha", res["output"].lower())

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
        rnd = int(time.time())
        # 1. Duplicate username
        res = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "User",
            "username": "admin",
            "email": f"unique_email_{rnd}@protector.ai",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        })
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.get_json()["error"], "This username is already taken. Please choose another username.")

        # 2. Duplicate email
        res_email = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "Email",
            "username": f"unique_user_{rnd}",
            "email": "sahilmohammad512@gmail.com",
            "password": "ValidPassword2026!",
            "confirm_password": "ValidPassword2026!"
        })
        self.assertEqual(res_email.status_code, 409)
        self.assertEqual(res_email.get_json()["error"], "An account with this email address already exists.")

        # 3. Duplicate phone
        res_phone = self.client.post("/api/auth/register", json={
            "first_name": "Dupe",
            "last_name": "Phone",
            "username": f"unique_phone_user_{rnd}",
            "email": f"unique_phone_email_{rnd}@protector.ai",
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

    # ==========================================
    # BIOMETRIC ATTENDANCE & EXCEL REGISTRY TESTS
    # ==========================================

    def test_18_attendance_system_and_excel(self):
        import os
        from pathlib import Path

        # 1. Fetch attendance summary
        res = self.client.get("/api/attendance/summary")
        self.assertEqual(res.status_code, 200)
        summary = res.get_json()
        self.assertIn("total_enrolled", summary)
        self.assertIn("present_today", summary)
        self.assertIn("excel_path", summary)

        # 2. Mark attendance manually
        mark_res = self.client.post("/api/attendance/mark", json={
            "person_name": "Mohd Sahil",
            "status": "Present",
            "notes": "Verified at Gate 1"
        })
        self.assertEqual(mark_res.status_code, 201)
        mark_data = mark_res.get_json()
        self.assertTrue(mark_data["success"])
        self.assertEqual(mark_data["record"]["person_name"], "Mohd Sahil")

        # 3. Query attendance records
        list_res = self.client.get("/api/attendance?name=Sahil")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.get_json()
        self.assertGreaterEqual(list_data["total"], 1)

        # 4. Trigger Excel sync
        sync_res = self.client.post("/api/attendance/sync-excel")
        self.assertEqual(sync_res.status_code, 200)
        sync_data = sync_res.get_json()
        self.assertTrue(sync_data["success"])

        # 5. Export / download Excel
        export_res = self.client.get("/api/attendance/export")
        self.assertEqual(export_res.status_code, 200)
        self.assertEqual(
            export_res.mimetype,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        export_res.close()

        # 6. Check Excel file on disk
        excel_path = Path(summary["excel_path"])
        self.assertTrue(excel_path.exists())

    def test_19_mark_attendance_by_image_processing(self):
        from unittest.mock import patch

        # 1. Missing image returns 400
        res_empty = self.client.post("/api/attendance/process-image", json={})
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn("error", res_empty.get_json())

        # 2. Blank black image returns 400 (no face detected)
        import base64
        import cv2
        import numpy as np

        blank_img = np.zeros((200, 200, 3), dtype=np.uint8)
        _, buf = cv2.imencode(".jpg", blank_img)
        b64_data = f"data:image/jpeg;base64,{base64.b64encode(buf.tobytes()).decode('ascii')}"

        res_blank = self.client.post("/api/attendance/process-image", json={"image": b64_data})
        self.assertEqual(res_blank.status_code, 400)
        err_msg = res_blank.get_json().get("error", "")
        self.assertTrue("No face detected" in err_msg or "No enrolled personnel" in err_msg)

        # 3. Successful match marking attendance
        fake_matches = [{
            "profile_id": 1,
            "name": "Mohd Sahil",
            "distance": 42.5,
            "enrolled": True,
            "box": (10, 10, 100, 100)
        }]

        from database import SessionLocal
        from models import FaceProfile
        from datetime import datetime, timezone
        db_s = SessionLocal()
        p = db_s.query(FaceProfile).filter(FaceProfile.id == 1).first()
        if not p:
            p = FaceProfile(
                id=1,
                name="Mohd Sahil",
                consent_recorded=True,
                consented_at=datetime.now(timezone.utc),
                enrolled_by_user_id=1,
                encrypted_templates="test_tmpl"
            )
            db_s.add(p)
            db_s.commit()
        db_s.close()

        with patch("app.face_recognition_service.recognize_all_matches", return_value=fake_matches):
            res_match = self.client.post("/api/attendance/process-image", json={
                "image": b64_data,
                "camera_source": "Test Camera Optical Stream"
            })
            self.assertEqual(res_match.status_code, 200)
            data = res_match.get_json()
            self.assertTrue(data["success"])
            self.assertIn("Mohd Sahil", data["recognized_workers"])
            self.assertTrue(data["excel_synced"])

            # Verify attendance record exists for today
            rec = data["records"][0]
            self.assertEqual(rec["person_name"], "Mohd Sahil")
            self.assertIn(rec["status"], ["Present", "Half Day", "Full Day"])

    def test_23_oauth_config_and_login(self):
        # 1. Config endpoint
        res_cfg = self.client.get("/api/auth/oauth/config")
        self.assertEqual(res_cfg.status_code, 200)
        cfg_data = res_cfg.get_json()
        self.assertIn("supported_providers", cfg_data)
        self.assertIn("google", cfg_data["supported_providers"])
        self.assertIn("github", cfg_data["supported_providers"])

        # 2. Unsupported provider error
        res_err = self.client.post("/api/auth/oauth/login", json={"provider": "facebook", "email": "fb@test.com"})
        self.assertEqual(res_err.status_code, 400)
        self.assertIn("Unsupported OAuth provider", res_err.get_json()["error"])

        # 3. Missing email error
        res_no_email = self.client.post("/api/auth/oauth/login", json={"provider": "google"})
        self.assertEqual(res_no_email.status_code, 400)
        self.assertIn("Email address is required", res_no_email.get_json()["error"])

        # 4. Google OAuth login
        res_google = self.client.post("/api/auth/oauth/login", json={
            "provider": "google",
            "email": "test.google.user@protecto.ai",
            "name": "Google Test Personnel",
            "role": "Administrator"
        })
        self.assertEqual(res_google.status_code, 200)
        google_data = res_google.get_json()
        self.assertTrue(google_data["success"])
        self.assertIn("token", google_data)
        self.assertTrue(len(google_data["token"]) > 10)
        self.assertEqual(google_data["user"]["email"], "test.google.user@protecto.ai")

        # 5. GitHub OAuth login
        res_github = self.client.post("/api/auth/oauth/login", json={
            "provider": "github",
            "email": "test.github.user@protecto.ai",
            "name": "GitHub Dev",
            "username": "test_github_dev"
        })
        self.assertEqual(res_github.status_code, 200)
        github_data = res_github.get_json()
        self.assertTrue(github_data["success"])
        self.assertIn("token", github_data)
        self.assertEqual(github_data["user"]["email"], "test.github.user@protecto.ai")

if __name__ == "__main__":
    unittest.main()

