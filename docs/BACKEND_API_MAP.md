# Backend API Map: Protector AI 2.0
**Document Version**: 2.0.0  
**Date**: November 2026  
**Auditor**: Principal API Architect  

---

## 1. Authentication & Session Management

### `POST /api/auth/login`
- **Description**: Authenticate operator or administrator credentials.
- **Request Body**:
  ```json
  {
    "username_or_email": "admin@protector.ai",
    "password": "SecurePassword123",
    "role": "Administrator"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "token": "d748f2a9c3e...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@protector.ai",
      "role": "Administrator"
    }
  }
  ```
- **Error Codes**: 400 (Bad Request), 401 (Invalid Credentials).

### `POST /api/auth/register`
- **Description**: Self-registration for platform operators (Admin required for elevated permissions).
- **Request Body**: `{ "username", "email", "password", "first_name", "last_name", "role" }`
- **Response** (201 Created): `{ "token", "user" }`

### `POST /api/auth/logout`
- **Description**: Revoke active session token.
- **Headers**: `Authorization: Bearer <token>`
- **Response** (200 OK): `{ "success": true, "message": "Logged out successfully" }`

### `GET /api/auth/me`
- **Description**: Validate session token and retrieve current user profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response** (200 OK): `{ "user": { ... } }`

---

## 2. Cameras & Surveillance Feeds

### `GET /api/cameras`
- **Description**: List all configured camera streams and hardware status.
- **Response** (200 OK): `[ { "id": "cam_01", "name": "Main Entrance", "status": "online", "fps": 30.0, ... } ]`

### `GET /api/cameras/<id>/feed`
- **Description**: Live MJPEG video stream with bounding boxes and biometric HUD overlay.
- **Response**: `multipart/x-mixed-replace; boundary=frame`

### `GET /api/cameras/<id>/metrics`
- **Description**: Real-time telemetry (active workers, PPE violations, recognized personnel, compliance rate).
- **Response** (200 OK):
  ```json
  {
    "fps": 28.5,
    "workers": 3,
    "violations": 1,
    "compliance_rate": 88.5,
    "recognized_workers": ["Mohd Sahil", "Prakhar"],
    "recognized_worker": "Mohd Sahil, Prakhar"
  }
  ```

---

## 3. Biometric Personnel & Facial Recognition

### `GET /api/people`
- **Description**: Retrieve enrolled personnel profiles (Admin only).
- **Response** (200 OK): `[ { "id": 1, "name": "Mohd Sahil", "created_at": "...", "last_seen_at": "..." } ]`

### `POST /api/people`
- **Description**: Enroll a new worker profile with facial biometric templates.
- **Request Body**:
  ```json
  {
    "name": "Mohd Sahil",
    "consent_recorded": true,
    "images": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."]
  }
  ```
- **Response** (201 Created): `{ "id": 1, "name": "Mohd Sahil", "created_at": "..." }`

### `DELETE /api/people/<id>`
- **Description**: Permanently delete biometric profile and associated identity models.
- **Response** (200 OK): `{ "success": true, "message": "Profile deleted" }`

### `POST /api/people/recognize`
- **Description**: One-shot facial recognition on a base64 image payload.
- **Request Body**: `{ "image": "data:image/jpeg;base64,..." }`
- **Response** (200 OK):
  ```json
  {
    "matches": [
      {
        "box": [100, 80, 120, 120],
        "profile_id": 1,
        "name": "Mohd Sahil",
        "distance": 0.08,
        "accuracy": 96.5,
        "enrolled": true
      }
    ]
  }
  ```

---

## 4. Attendance & Shift Management

### `GET /api/attendance`
- **Description**: Query attendance records with date, name, and status filters.
- **Query Params**: `date` (YYYY-MM-DD), `name` (string), `status` (Present/Full Day/Half Day), `limit` (int).
- **Response** (200 OK): `{ "records": [ { "id", "date", "person_name", "shift", "punctuality", "total_hours", "overtime_hours", ... } ], "total": 42 }`

### `GET /api/attendance/summary`
- **Description**: Real-time executive dashboard KPIs, punctuality score, weekly trend, and Excel sync status.
- **Response** (200 OK):
  ```json
  {
    "date": "2026-11-21",
    "total_enrolled": 7,
    "present_today": 3,
    "absent_today": 4,
    "attendance_rate": 42.9,
    "punctuality_rate": 100.0,
    "active_on_site_now": 2,
    "total_overtime_hours": 0.0,
    "weekly_trend": [ ... ],
    "excel_path": "D:\\Downloads\\Attandance.xlsx",
    "excel_exists": true
  }
  ```

### `POST /api/attendance/mark`
- **Description**: Manual administrator check-in or status adjustment.
- **Request Body**: `{ "person_name": "Alok", "status": "Present", "notes": "Approved offsite inspection" }`
- **Response** (200 OK): `{ "success": true, "record": { ... } }`

### `POST /api/attendance/sync-excel`
- **Description**: Force immediate disk synchronization to `D:\Downloads\Attandance.xlsx`.
- **Response** (200 OK): `{ "success": true, "message": "Attendance workbook saved...", "excel_path": "..." }`

### `GET /api/attendance/export`
- **Description**: Download the live multi-tab Excel workbook.
- **Response**: Binary file `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`Attandance.xlsx`).

### `GET /api/attendance/export-csv`
- **Description**: Download the complete attendance register in RFC-4180 CSV format.
- **Response**: Binary file `text/csv` (`attendance_YYYYMMDD.csv`).

---

## 5. Safety Incidents & Violation Intelligence

### `GET /api/incidents`
- **Description**: List logged safety violations with category and severity filters.
- **Response** (200 OK): `[ { "id": "INC-001", "title": "Missing Hardhat", "severity": "High", "status": "Open", "assigned_to": "Mohd Sahil", ... } ]`

### `PATCH /api/incidents/<id>`
- **Description**: Update incident resolution status and add corrective action notes.
- **Request Body**: `{ "status": "Resolved", "resolution_notes": "Hardhat issued at Gate 1" }`
- **Response** (200 OK): `{ "incident": { ... } }`

---

## 6. AI Safety Copilot & Industrial Terminal

### `POST /api/copilot/chat`
- **Description**: Conversational safety assistant providing OSHA compliance analysis.
- **Request Body**: `{ "message": "Summarize today's PPE violations and suggest corrective steps." }`
- **Response** (200 OK): `{ "response": "..." }`

### `POST /api/terminal/execute`
- **Description**: Industrial CLI command executor for operational actions and safety audits.
- **Request Body**: `{ "command": "run osha-audit --zone all" }`
- **Response** (200 OK): `{ "output": "...", "status": "completed" }`
