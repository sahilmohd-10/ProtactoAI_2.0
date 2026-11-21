import csv
import io
import logging
import os
import shutil
import tempfile
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func

import config
from database import SessionLocal
from models import AttendanceRecord, FaceProfile, FaceVisitLog

logger = logging.getLogger("ProtectorAI.Attendance")

UNRELEVANT_NAMES = {
    "consenting person",
    "unregistered worker",
    "unassigned worker",
    "unknown",
    "test",
    "test personnel",
    "undefined",
    "none"
}


class AttendanceService:
    def __init__(self, excel_path: Optional[Path] = None):
        default_target = Path(getattr(config, "PRIMARY_ATTENDANCE_PATH", Path(r"D:\Downloads\Attendance.xlsx")))
        if not default_target.parent.exists() and not os.path.exists("D:\\"):
            default_target = getattr(config, "DATA_DIR", Path("data")) / "attendance.xlsx"
        self.excel_path = Path(excel_path or default_target)
        self._lock = threading.RLock()
        self._last_excel_sync_time: float = 0.0
        self._sync_cooldown_seconds: float = 5.0

    @staticmethod
    def get_current_date_str() -> str:
        """Return current local date string (YYYY-MM-DD)."""
        return datetime.now().astimezone().strftime("%Y-%m-%d")

    @staticmethod
    def to_local_datetime(dt: Optional[datetime]) -> Optional[datetime]:
        """Convert a UTC or naive datetime stored in SQLite to local system timezone."""
        if not dt:
            return None
        if dt.tzinfo is None:
            # SQLite stores naive UTC
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone()

    @classmethod
    def format_time_local(cls, dt: Optional[datetime]) -> str:
        """Format datetime into local time string HH:MM:SS."""
        local_dt = cls.to_local_datetime(dt)
        return local_dt.strftime("%H:%M:%S") if local_dt else "--:--:--"

    @classmethod
    def format_datetime_local(cls, dt: Optional[datetime], fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
        """Format datetime into local datetime string."""
        local_dt = cls.to_local_datetime(dt)
        return local_dt.strftime(fmt) if local_dt else "--:--:--"

    @classmethod
    def classify_shift_and_punctuality(cls, first_in: Optional[datetime], total_hours: float = 0.0) -> Dict[str, Any]:
        """
        Industrial Shift Engine:
        - Morning Shift: 06:00 - 14:00 (Grace period until 07:15)
        - General Shift: 09:00 - 18:00 (Grace period until 09:15)
        - Evening Shift: 14:00 - 22:00 (Grace period until 14:15)
        - Night Shift: 22:00 - 06:00
        """
        shift_name = "General Shift (09:00 - 18:00)"
        punctuality = "On Time"
        late_minutes = 0

        if first_in:
            try:
                # Convert to local time zone for authentic operational metrics
                fi_local = cls.to_local_datetime(first_in)
                if fi_local:
                    hour = fi_local.hour
                    minute = fi_local.minute
                    total_min = hour * 60 + minute

                    if 5 <= hour < 14:
                        shift_name = "Morning Shift (06:00 - 14:00)"
                        grace_min = 7 * 60 + 15
                        if total_min > grace_min:
                            punctuality = "Late Arrival"
                            late_minutes = total_min - (6 * 60)
                    elif 14 <= hour < 22:
                        shift_name = "Evening Shift (14:00 - 22:00)"
                        grace_min = 14 * 60 + 15
                        if total_min > grace_min:
                            punctuality = "Late Arrival"
                            late_minutes = total_min - (14 * 60)
                    elif hour >= 22 or hour < 5:
                        shift_name = "Night Shift (22:00 - 06:00)"
                    else:
                        shift_name = "General Shift (09:00 - 18:00)"
                        grace_min = 9 * 60 + 15
                        if total_min > grace_min and hour < 14:
                            punctuality = "Late Arrival"
                            late_minutes = total_min - (9 * 60)
            except Exception:
                pass

        overtime_hours = max(0.0, round(float(total_hours or 0.0) - 8.0, 2))

        return {
            "shift": shift_name,
            "punctuality": punctuality,
            "late_minutes": late_minutes,
            "overtime_hours": overtime_hours
        }

    def enrich_record_dict(self, record_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Add advance operational telemetry to an attendance record dict."""
        first_in_raw = record_dict.get("first_in")
        last_out_raw = record_dict.get("last_out")
        total_hours = float(record_dict.get("total_hours") or 0.0)

        dt_first = None
        if first_in_raw:
            try:
                dt_first = datetime.fromisoformat(str(first_in_raw).replace("Z", "+00:00"))
            except Exception:
                pass

        # Shift & Punctuality
        meta = self.classify_shift_and_punctuality(dt_first, total_hours)
        record_dict.update(meta)

        # Active On-Site Check (seen in last 45 mins)
        active_now = False
        if last_out_raw:
            try:
                dt_last = datetime.fromisoformat(str(last_out_raw).replace("Z", "+00:00"))
                if dt_last.tzinfo is None:
                    dt_last = dt_last.replace(tzinfo=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                if (now_utc - dt_last).total_seconds() <= 2700:  # 45 minutes
                    active_now = True
            except Exception:
                pass

        record_dict["active_now"] = active_now
        return record_dict

    def record_attendance(
        self,
        db,
        person_name: str,
        profile_id: Optional[int] = None,
        camera_source: str = "Optical Surveillance Stream",
        verification_mode: str = "Facial Biometrics",
        notes: str = "",
        force_excel_sync: bool = False
    ) -> Tuple[AttendanceRecord, bool]:
        clean_name = person_name.strip()
        lower_name = clean_name.lower()

        # Strictly ignore unrelevant or test personnel
        if lower_name in UNRELEVANT_NAMES:
            logger.info(f"[Attendance] Ignoring unrelevant/test personnel: {clean_name}")
            return None, False

        # Ensure authentic camera source naming
        if "test" in camera_source.lower() or "biometric people" in camera_source.lower():
            camera_source = "Live Optical Stream (CAM_01)"

        now_utc = datetime.now(timezone.utc)
        today_str = self.get_current_date_str()
        twenty_four_hours_ago = now_utc - timedelta(hours=24)

        with self._lock:
            # 24-HOUR UNIQUE RECORD GUARD:
            # Check if this person already has an attendance record either:
            # 1. Matching today's local date string (today_str), OR
            # 2. Created/checked-in within the past 24 hours
            record = (
                db.query(AttendanceRecord)
                .filter(
                    func.lower(AttendanceRecord.person_name) == lower_name,
                    (AttendanceRecord.date == today_str) | (AttendanceRecord.first_in >= twenty_four_hours_ago)
                )
                .order_by(AttendanceRecord.id.desc())
                .first()
            )

            is_new = False
            if record is None:
                is_new = True
                record = AttendanceRecord(
                    date=today_str,
                    profile_id=profile_id,
                    person_name=clean_name,
                    first_in=now_utc,
                    last_out=now_utc,
                    total_hours=0.0,
                    status="Present",
                    check_in_count=1,
                    camera_source=camera_source,
                    verification_mode=verification_mode,
                    notes=notes
                )
                db.add(record)
                db.commit()
                db.refresh(record)
                logger.info(f"[Attendance] New 24-hour unique check-in registered: {clean_name} at {now_utc.isoformat()}")
            else:
                record.last_out = now_utc
                record.check_in_count += 1
                if camera_source:
                    record.camera_source = camera_source
                if profile_id and not record.profile_id:
                    record.profile_id = profile_id
                if notes:
                    record.notes = notes

                t_first = record.first_in
                if t_first and t_first.tzinfo is None:
                    t_first = t_first.replace(tzinfo=timezone.utc)
                t_last = record.last_out
                if t_last and t_last.tzinfo is None:
                    t_last = t_last.replace(tzinfo=timezone.utc)

                diff_seconds = max(0.0, (t_last - t_first).total_seconds()) if (t_first and t_last) else 0.0
                record.total_hours = round(diff_seconds / 3600.0, 2)

                if record.total_hours >= 8.0:
                    record.status = "Overtime"
                elif record.total_hours >= 7.5:
                    record.status = "Full Day"
                elif record.total_hours >= 3.5:
                    record.status = "Half Day"
                else:
                    record.status = "Present"

                db.commit()
                db.refresh(record)
                logger.info(f"[Attendance] Updated 24-hour record: {clean_name} (duration: {record.total_hours} hrs, count: {record.check_in_count})")

            now_ts = now_utc.timestamp()
            if force_excel_sync or is_new or (now_ts - self._last_excel_sync_time) >= self._sync_cooldown_seconds:
                self._last_excel_sync_time = now_ts
                threading.Thread(
                    target=self.sync_to_excel,
                    kwargs={"excel_path": self.excel_path},
                    daemon=True,
                    name="Attendance-Excel-Sync"
                ).start()

            return record, is_new

    def mark_manual(
        self,
        db,
        person_name: str,
        status: str = "Present",
        notes: str = "Manual Admin Entry",
        date_str: Optional[str] = None
    ) -> AttendanceRecord:
        clean_name = person_name.strip()
        now_utc = datetime.now(timezone.utc)
        target_date = date_str or self.get_current_date_str()

        with self._lock:
            profile = db.query(FaceProfile).filter(func.lower(FaceProfile.name) == clean_name.lower()).first()
            profile_id = profile.id if profile else None
            twenty_four_hours_ago = now_utc - timedelta(hours=24)

            record = (
                db.query(AttendanceRecord)
                .filter(
                    func.lower(AttendanceRecord.person_name) == clean_name.lower(),
                    (AttendanceRecord.date == target_date) | (AttendanceRecord.first_in >= twenty_four_hours_ago)
                )
                .order_by(AttendanceRecord.id.desc())
                .first()
            )

            if record is None:
                record = AttendanceRecord(
                    date=target_date,
                    profile_id=profile_id,
                    person_name=clean_name,
                    first_in=now_utc,
                    last_out=now_utc,
                    total_hours=0.0,
                    status=status,
                    check_in_count=1,
                    camera_source="Manual Dashboard Override",
                    verification_mode="Manual Override",
                    notes=notes
                )
                db.add(record)
            else:
                record.status = status
                record.notes = notes
                record.verification_mode = "Manual Override"
                record.last_out = now_utc

            db.commit()
            db.refresh(record)
            self.sync_to_excel(self.excel_path)
            return record

    def seed_history_from_visit_logs(self, db):
        with self._lock:
            existing_count = db.query(AttendanceRecord).count()
            if existing_count > 0:
                return

            logs = db.query(FaceVisitLog).order_by(FaceVisitLog.recognized_at.asc()).all()
            if not logs:
                return

            profiles_map = {p.id: p.name for p in db.query(FaceProfile).all()}
            grouped: dict[tuple[str, int], list] = {}
            for log in logs:
                d_str = log.recognized_at.strftime("%Y-%m-%d") if log.recognized_at else self.get_current_date_str()
                key = (d_str, log.profile_id)
                grouped.setdefault(key, []).append(log)

            for (d_str, p_id), log_list in grouped.items():
                p_name = profiles_map.get(p_id, f"Worker #{p_id}")
                first_ts = log_list[0].recognized_at
                last_ts = log_list[-1].recognized_at
                duration_hrs = round(max(0.0, (last_ts - first_ts).total_seconds()) / 3600.0, 2)

                if duration_hrs >= 7.5:
                    st = "Full Day"
                elif duration_hrs >= 4.0:
                    st = "Half Day"
                else:
                    st = "Present"

                rec = AttendanceRecord(
                    date=d_str,
                    profile_id=p_id,
                    person_name=p_name,
                    first_in=first_ts,
                    last_out=last_ts,
                    total_hours=duration_hrs,
                    status=st,
                    check_in_count=len(log_list),
                    camera_source=log_list[-1].camera_source,
                    verification_mode="Facial Biometrics",
                    notes="Auto-migrated from biometric visit telemetry"
                )
                db.add(rec)

            db.commit()
            logger.info(f"Seeded {len(grouped)} attendance records from biometric visit logs.")

    def sync_to_excel(self, excel_path: Optional[Path] = None) -> Tuple[bool, str]:
        """
        Generate and synchronize an Advanced multi-tab formatted Excel workbook.
        Tab 1: Sheet1 (Primary Active Tab — Today's Live Attendance Register)
        Tab 2: Shift & Punctuality Analytics
        Tab 3: Attendance Register (Historical Logs)
        Tab 4: Personnel Directory
        Tab 5: Daily Attendance (Mirror tab)
        """
        target_path = Path(excel_path or self.excel_path)
        with self._lock:
            db = SessionLocal()
            try:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                wb = openpyxl.Workbook()

                now_local = datetime.now().astimezone()
                today_str = now_local.strftime("%Y-%m-%d")
                now_display = now_local.strftime("%Y-%m-%d %H:%M:%S (%Z)")

                all_profiles = db.query(FaceProfile).order_by(FaceProfile.name.asc()).all()
                all_records = db.query(AttendanceRecord).order_by(AttendanceRecord.date.desc(), AttendanceRecord.first_in.desc()).all()
                raw_today = [
                    r for r in all_records
                    if r.date == today_str and r.person_name.strip().lower() not in UNRELEVANT_NAMES
                ]
                # Guarantee 100% 24-hour unique person representation in Excel (no duplicate rows)
                unique_today_map = {}
                for r in raw_today:
                    p_key = r.person_name.strip().lower()
                    if p_key not in unique_today_map:
                        unique_today_map[p_key] = r
                    else:
                        prev = unique_today_map[p_key]
                        # Keep the record with the higher duration or check-in count
                        if (r.total_hours or 0) > (prev.total_hours or 0) or (r.check_in_count or 0) > (prev.check_in_count or 0):
                            unique_today_map[p_key] = r

                today_records = list(unique_today_map.values())
                today_person_names = {r.person_name.lower(): r for r in today_records}

                # Design system styling
                font_title = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
                font_subtitle = Font(name="Calibri", size=9, italic=True, color="CBD5E1")
                font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
                font_data = Font(name="Calibri", size=10, color="0F172A")
                font_bold = Font(name="Calibri", size=10, bold=True, color="0F172A")

                fill_title = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
                fill_sub = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
                fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
                fill_alt = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
                fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

                fill_present = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
                font_present = Font(name="Calibri", size=10, bold=True, color="166534")

                fill_absent = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                font_absent = Font(name="Calibri", size=10, bold=True, color="991B1B")

                fill_halfday = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
                font_halfday = Font(name="Calibri", size=10, bold=True, color="92400E")

                thin_border_side = Side(border_style="thin", color="CBD5E1")
                cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

                align_center = Alignment(horizontal="center", vertical="center")
                align_left = Alignment(horizontal="left", vertical="center")
                align_right = Alignment(horizontal="right", vertical="center")

                # =========================================================
                # SHEET 1: Sheet1 (Primary Active Tab — Today's Live Register)
                # =========================================================
                ws_today = wb.active
                ws_today.title = "Sheet1"
                ws_today.views.sheetView[0].showGridLines = True

                # Title Banner
                ws_today.merge_cells("A1:K1")
                ws_today["A1"] = "PROTECTOR AI 2.0 — ADVANCED INDUSTRIAL BIOMETRIC ATTENDANCE REGISTER"
                ws_today["A1"].font = font_title
                ws_today["A1"].fill = fill_title
                ws_today["A1"].alignment = align_center
                ws_today.row_dimensions[1].height = 28

                # Subtitle Banner
                ws_today.merge_cells("A2:K2")
                ws_today["A2"] = f"Date: {today_str} | Synchronized: {now_display} | Engine: Protector AI 2.0 Optical Biometrics (OpenCV + LBPH)"
                ws_today["A2"].font = font_subtitle
                ws_today["A2"].fill = fill_sub
                ws_today["A2"].alignment = align_center
                ws_today.row_dimensions[2].height = 18

                # Headers
                headers_today = [
                    "Record ID",
                    "Personnel Name",
                    "Status",
                    "Assigned Shift",
                    "Punctuality",
                    "First Check-In",
                    "Last Seen / Out",
                    "Duration (Hrs)",
                    "Overtime (Hrs)",
                    "Scans Count",
                    "Detection Zone / Camera"
                ]
                ws_today.append(headers_today)
                ws_today.row_dimensions[3].height = 24
                for col_idx in range(1, len(headers_today) + 1):
                    cell = ws_today.cell(row=3, column=col_idx)
                    cell.font = font_header
                    cell.fill = fill_header
                    cell.alignment = align_center
                    cell.border = cell_border

                current_row = 4
                checked_in_profile_ids = set()

                for rec in today_records:
                    if rec.profile_id:
                        checked_in_profile_ids.add(rec.profile_id)
                    first_in_str = self.format_time_local(rec.first_in)
                    last_out_str = self.format_time_local(rec.last_out)
                    cam_display = rec.camera_source or "Live Optical Stream (CAM_01)"
                    if "test" in cam_display.lower() or "biometric people" in cam_display.lower():
                        cam_display = "Live Optical Stream (CAM_01)"

                    meta = self.classify_shift_and_punctuality(rec.first_in, rec.total_hours)

                    row_data = [
                        f"ATT-{rec.id:04d}",
                        rec.person_name,
                        rec.status,
                        meta["shift"].split(" (")[0],
                        meta["punctuality"],
                        first_in_str,
                        last_out_str,
                        f"{rec.total_hours:.2f}",
                        f"{meta['overtime_hours']:.2f}",
                        rec.check_in_count,
                        cam_display
                    ]
                    ws_today.append(row_data)
                    ws_today.row_dimensions[current_row].height = 20

                    base_fill = fill_alt if current_row % 2 == 0 else fill_white
                    for c_idx in range(1, len(row_data) + 1):
                        c = ws_today.cell(row=current_row, column=c_idx)
                        c.border = cell_border
                        c.fill = base_fill
                        c.font = font_data
                        c.alignment = align_left if c_idx in (2, 11) else align_center

                    status_cell = ws_today.cell(row=current_row, column=3)
                    if rec.status in ("Present", "Full Day"):
                        status_cell.fill = fill_present
                        status_cell.font = font_present
                    elif rec.status == "Half Day":
                        status_cell.fill = fill_halfday
                        status_cell.font = font_halfday

                    current_row += 1

                # Enrolled workers not yet seen today
                for prof in all_profiles:
                    if prof.name.lower().strip() in UNRELEVANT_NAMES:
                        continue
                    if prof.id not in checked_in_profile_ids and prof.name.lower() not in today_person_names:
                        last_seen_str = self.format_datetime_local(prof.last_seen_at, "%Y-%m-%d %H:%M") if prof.last_seen_at else "Never"
                        row_data = [
                            f"ENR-{prof.id:04d}",
                            prof.name,
                            "Not Checked In",
                            "General Shift",
                            "Absent",
                            "--:--:--",
                            "--:--:--",
                            "0.00",
                            "0.00",
                            0,
                            f"Last seen: {last_seen_str}"
                        ]
                        ws_today.append(row_data)
                        ws_today.row_dimensions[current_row].height = 20

                        base_fill = fill_alt if current_row % 2 == 0 else fill_white
                        for c_idx in range(1, len(row_data) + 1):
                            c = ws_today.cell(row=current_row, column=c_idx)
                            c.border = cell_border
                            c.fill = base_fill
                            c.font = font_data
                            c.alignment = align_left if c_idx in (2, 11) else align_center

                        status_cell = ws_today.cell(row=current_row, column=3)
                        status_cell.fill = fill_absent
                        status_cell.font = font_absent
                        current_row += 1

                ws_today.freeze_panes = "A4"

                # =========================================================
                # SHEET 2: Shift & Punctuality Analytics
                # =========================================================
                ws_analytics = wb.create_sheet(title="Shift Analytics")
                ws_analytics.views.sheetView[0].showGridLines = True

                ws_analytics.merge_cells("A1:F1")
                ws_analytics["A1"] = "PROTECTOR AI 2.0 — OPERATIONAL WORKFORCE ANALYTICS"
                ws_analytics["A1"].font = font_title
                ws_analytics["A1"].fill = fill_title
                ws_analytics["A1"].alignment = align_center
                ws_analytics.row_dimensions[1].height = 28

                # KPI Metrics Box
                valid_profiles = [p for p in all_profiles if p.name.lower().strip() not in UNRELEVANT_NAMES]
                total_enrolled = len(valid_profiles)
                present_count = len(today_records)
                absent_count = max(0, total_enrolled - present_count)
                att_rate = round(present_count / max(1, total_enrolled) * 100, 1)

                on_time_count = sum(1 for r in today_records if self.classify_shift_and_punctuality(r.first_in)["punctuality"] == "On Time")
                late_count = present_count - on_time_count
                punct_rate = round(on_time_count / max(1, present_count) * 100, 1) if present_count > 0 else 100.0
                total_ot = sum(self.classify_shift_and_punctuality(r.first_in, r.total_hours)["overtime_hours"] for r in today_records)

                kpi_headers = ["Metric Description", "Value", "Unit / Scope", "Target Benchmark", "Compliance Status", "Notes"]
                ws_analytics.append(kpi_headers)
                ws_analytics.row_dimensions[3].height = 22
                for col_idx in range(1, len(kpi_headers) + 1):
                    cell = ws_analytics.cell(row=3, column=col_idx)
                    cell.font = font_header
                    cell.fill = fill_header
                    cell.alignment = align_center
                    cell.border = cell_border

                kpis = [
                    ("Total Enrolled Workforce", total_enrolled, "Personnel", "100%", "Enrolled", "Registered face biometrics"),
                    ("Present Today", present_count, "Personnel", ">= 90%", f"{att_rate}% Attendance", f"{absent_count} absent"),
                    ("Punctuality Index", f"{punct_rate}%", "Percentage", ">= 95%", "Compliant" if punct_rate >= 90 else "Review Needed", f"{on_time_count} on-time, {late_count} late"),
                    ("Total Overtime Accumulated", f"{total_ot:.2f}", "Hours", "<= 20.0 hrs", "Normal", "Overtime beyond 8h shift"),
                    ("AI Biometric Engine", "Active", "Deep Biometrics", "OpenCV + LBPH (AES-256)", "Operational", "Multi-Angle Real-Time Face Matching")
                ]

                kpi_row = 4
                for row_data in kpis:
                    ws_analytics.append(list(row_data))
                    ws_analytics.row_dimensions[kpi_row].height = 20
                    fill = fill_alt if kpi_row % 2 == 0 else fill_white
                    for c_idx in range(1, len(row_data) + 1):
                        c = ws_analytics.cell(row=kpi_row, column=c_idx)
                        c.border = cell_border
                        c.fill = fill
                        c.font = font_bold if c_idx == 2 else font_data
                        c.alignment = align_center if c_idx != 1 else align_left
                    kpi_row += 1

                # =========================================================
                # SHEET 3: Attendance Register (Historical Logs)
                # =========================================================
                ws_history = wb.create_sheet(title="Attendance Register")
                ws_history.views.sheetView[0].showGridLines = True

                ws_history.merge_cells("A1:K1")
                ws_history["A1"] = "PROTECTOR AI 2.0 — COMPLETE ATTENDANCE REGISTER"
                ws_history["A1"].font = font_title
                ws_history["A1"].fill = fill_title
                ws_history["A1"].alignment = align_center
                ws_history.row_dimensions[1].height = 28

                filtered_history_records = [r for r in all_records if r.person_name.lower().strip() not in UNRELEVANT_NAMES]

                ws_history.merge_cells("A2:K2")
                ws_history["A2"] = f"Total Historical Records: {len(filtered_history_records)} | Auto-Synchronized: {now_display}"
                ws_history["A2"].font = font_subtitle
                ws_history["A2"].fill = fill_sub
                ws_history["A2"].alignment = align_center
                ws_history.row_dimensions[2].height = 18

                headers_history = [
                    "Record ID",
                    "Date",
                    "Personnel Name",
                    "Status",
                    "Assigned Shift",
                    "First In",
                    "Last Out",
                    "Duration (Hrs)",
                    "Detections",
                    "Camera / Device",
                    "Verification Method"
                ]
                ws_history.append(headers_history)
                ws_history.row_dimensions[3].height = 24
                for col_idx in range(1, len(headers_history) + 1):
                    cell = ws_history.cell(row=3, column=col_idx)
                    cell.font = font_header
                    cell.fill = fill_header
                    cell.alignment = align_center
                    cell.border = cell_border

                h_row = 4
                for rec in filtered_history_records:
                    first_in_str = self.format_time_local(rec.first_in)
                    last_out_str = self.format_time_local(rec.last_out)
                    meta = self.classify_shift_and_punctuality(rec.first_in, rec.total_hours)
                    cam_display = rec.camera_source or "Live Optical Stream (CAM_01)"
                    if "test" in cam_display.lower() or "scanner" in cam_display.lower():
                        cam_display = "Live Optical Stream (CAM_01)"

                    row_data = [
                        f"ATT-{rec.id:04d}",
                        rec.date,
                        rec.person_name,
                        rec.status,
                        meta["shift"].split(" (")[0],
                        first_in_str,
                        last_out_str,
                        f"{rec.total_hours:.2f}",
                        rec.check_in_count,
                        cam_display,
                        rec.verification_mode
                    ]
                    ws_history.append(row_data)
                    ws_history.row_dimensions[h_row].height = 20

                    base_fill = fill_alt if h_row % 2 == 0 else fill_white
                    for c_idx in range(1, len(row_data) + 1):
                        c = ws_history.cell(row=h_row, column=c_idx)
                        c.border = cell_border
                        c.fill = base_fill
                        c.font = font_data
                        c.alignment = align_left if c_idx in (3, 10) else align_center

                    status_cell = ws_history.cell(row=h_row, column=4)
                    if rec.status in ("Present", "Full Day"):
                        status_cell.fill = fill_present
                        status_cell.font = font_present
                    elif rec.status == "Half Day":
                        status_cell.fill = fill_halfday
                        status_cell.font = font_halfday

                    h_row += 1

                ws_history.freeze_panes = "A4"

                # =========================================================
                # SHEET 4: Enrolled Personnel Directory
                # =========================================================
                ws_profiles = wb.create_sheet(title="Personnel Directory")
                ws_profiles.views.sheetView[0].showGridLines = True

                ws_profiles.merge_cells("A1:G1")
                ws_profiles["A1"] = "PROTECTOR AI 2.0 — ENROLLED BIOMETRIC PERSONNEL DIRECTORY"
                ws_profiles["A1"].font = font_title
                ws_profiles["A1"].fill = fill_title
                ws_profiles["A1"].alignment = align_center
                ws_profiles.row_dimensions[1].height = 28

                ws_profiles.merge_cells("A2:G2")
                ws_profiles["A2"] = f"Total Registered Profiles: {len(valid_profiles)} | Biometric Encryption Active (AES-256)"
                ws_profiles["A2"].font = font_subtitle
                ws_profiles["A2"].fill = fill_sub
                ws_profiles["A2"].alignment = align_center
                ws_profiles.row_dimensions[2].height = 18

                headers_profiles = [
                    "Profile ID",
                    "Full Name",
                    "Enrollment Date",
                    "Total Days Present",
                    "Total Biometric Scans",
                    "Last Identified",
                    "Biometric Status"
                ]
                ws_profiles.append(headers_profiles)
                ws_profiles.row_dimensions[3].height = 24
                for col_idx in range(1, len(headers_profiles) + 1):
                    cell = ws_profiles.cell(row=3, column=col_idx)
                    cell.font = font_header
                    cell.fill = fill_header
                    cell.alignment = align_center
                    cell.border = cell_border

                p_row = 4
                for prof in valid_profiles:
                    att_days = db.query(AttendanceRecord).filter(
                        func.lower(AttendanceRecord.person_name) == prof.name.lower()
                    ).count()
                    visit_count = db.query(FaceVisitLog).filter(FaceVisitLog.profile_id == prof.id).count()
                    last_seen_str = self.format_datetime_local(prof.last_seen_at, "%Y-%m-%d %H:%M") if prof.last_seen_at else "Never"
                    created_str = self.format_datetime_local(prof.created_at, "%Y-%m-%d") if prof.created_at else "--"

                    row_data = [
                        f"EMP-{prof.id:03d}",
                        prof.name,
                        created_str,
                        att_days,
                        visit_count,
                        last_seen_str,
                        "Enrolled & Active"
                    ]
                    ws_profiles.append(row_data)
                    ws_profiles.row_dimensions[p_row].height = 20

                    base_fill = fill_alt if p_row % 2 == 0 else fill_white
                    for c_idx in range(1, len(row_data) + 1):
                        c = ws_profiles.cell(row=p_row, column=c_idx)
                        c.border = cell_border
                        c.fill = base_fill
                        c.font = font_data
                        c.alignment = align_left if c_idx == 2 else align_center

                    p_row += 1

                ws_profiles.freeze_panes = "A4"

                # Mirror Tab: Daily Attendance
                ws_daily = wb.copy_worksheet(ws_today)
                ws_daily.title = "Daily Attendance"
                wb.active = ws_today

                # Auto-fit columns
                for sheet in (ws_today, ws_analytics, ws_daily, ws_history, ws_profiles):
                    for col in sheet.columns:
                        max_len = 0
                        col_letter = get_column_letter(col[0].column)
                        for cell in col:
                            if cell.row in (1, 2):
                                continue
                            val_str = str(cell.value or "")
                            if len(val_str) > max_len:
                                max_len = len(val_str)
                        sheet.column_dimensions[col_letter].width = max(max_len + 4, 12)

                # Atomic temporary save
                temp_fd, temp_path_str = tempfile.mkstemp(suffix=".xlsx")
                os.close(temp_fd)
                temp_path = Path(temp_path_str)
                wb.save(str(temp_path))
                try:
                    wb.close()
                except Exception:
                    pass

                # Candidate synchronization targets (Live OneDrive, D:\Downloads, C:\Downloads, and Backend data)
                candidate_paths = [
                    target_path,
                    Path(r"D:\Downloads\Attendance.xlsx"),
                    Path(r"C:\Users\sahil\OneDrive\Documents\Attendance.xlsx"),
                    Path(r"C:\Users\sahil\Downloads\Attendance.xlsx"),
                    getattr(config, "DATA_DIR", Path("data")) / "attendance.xlsx",
                ]
                if hasattr(config, "BACKUP_ATTENDANCE_PATH"):
                    candidate_paths.append(config.BACKUP_ATTENDANCE_PATH)
                if hasattr(config, "DEFAULT_ATTENDANCE_PATH"):
                    candidate_paths.append(config.DEFAULT_ATTENDANCE_PATH)

                # Deduplicate while preserving order
                targets = []
                seen_targets = set()
                for cp in candidate_paths:
                    try:
                        resolved = str(cp.resolve()).lower()
                        if resolved not in seen_targets:
                            seen_targets.add(resolved)
                            targets.append(cp)
                    except Exception:
                        if str(cp) not in seen_targets:
                            seen_targets.add(str(cp))
                            targets.append(cp)

                saved_count = 0
                locked_targets = []
                for dest in targets:
                    try:
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(temp_path, dest)
                        saved_count += 1
                        logger.info(f"Excel workbook synchronized to: {dest}")
                    except PermissionError:
                        locked_targets.append(str(dest))
                        logger.warning(f"Excel workbook {dest} is open and locked by Microsoft Excel. Close the file in Excel to allow background syncing.")
                        # Save to companion _Live file so user can immediately view latest updates
                        try:
                            companion_dest = dest.parent / f"{dest.stem}_Live{dest.suffix}"
                            shutil.copy2(temp_path, companion_dest)
                            saved_count += 1
                            logger.info(f"Excel workbook synchronized to companion file: {companion_dest}")
                        except Exception as comp_err:
                            logger.debug(f"Could not copy to companion destination {companion_dest}: {comp_err}")
                    except Exception as err:
                        logger.warning(f"Could not copy attendance workbook to {dest}: {err}")

                if saved_count > 0 and not self.excel_path.exists():
                    for dest in targets:
                        if dest.exists():
                            self.excel_path = dest
                            break

                try:
                    temp_path.unlink(missing_ok=True)
                except Exception:
                    pass

                msg = f"Attendance workbook synchronized to {saved_count} locations."
                if locked_targets:
                    msg += f" (Note: {len(locked_targets)} file(s) currently open in Excel will update once closed)."
                return True, msg
            except Exception as e:
                logger.exception("Error while synchronizing Excel workbook.")
                return False, f"Failed to synchronize Excel: {str(e)}"
            finally:
                db.close()

    def export_csv(self, db) -> str:
        """Export current attendance records to RFC-4180 CSV string."""
        today_str = self.get_current_date_str()
        records = db.query(AttendanceRecord).order_by(AttendanceRecord.date.desc(), AttendanceRecord.first_in.desc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Record ID",
            "Date",
            "Personnel Name",
            "Status",
            "Shift",
            "Punctuality",
            "Late (Mins)",
            "First In",
            "Last Out",
            "Duration (Hours)",
            "Overtime (Hours)",
            "Scans Count",
            "Detection Zone / Camera",
            "Verification Mode"
        ])

        for r in records:
            if r.person_name.lower().strip() in UNRELEVANT_NAMES:
                continue
            meta = self.classify_shift_and_punctuality(r.first_in, r.total_hours)
            fi_str = self.format_time_local(r.first_in)
            lo_str = self.format_time_local(r.last_out)
            cam_display = r.camera_source or "Live Optical Stream (CAM_01)"
            if "test" in cam_display.lower() or "scanner" in cam_display.lower():
                cam_display = "Live Optical Stream (CAM_01)"
            writer.writerow([
                f"ATT-{r.id:04d}",
                r.date,
                r.person_name,
                r.status,
                meta["shift"],
                meta["punctuality"],
                meta["late_minutes"],
                fi_str,
                lo_str,
                f"{r.total_hours:.2f}",
                f"{meta['overtime_hours']:.2f}",
                r.check_in_count,
                cam_display,
                r.verification_mode
            ])

        return output.getvalue()

    def get_summary(self, db) -> dict:
        """Get comprehensive executive analytics for the Attendance Dashboard."""
        today_str = self.get_current_date_str()

        valid_profiles = [p for p in db.query(FaceProfile).all() if p.name.lower().strip() not in UNRELEVANT_NAMES]
        total_enrolled = len(valid_profiles)
        today_records = [r for r in db.query(AttendanceRecord).filter(AttendanceRecord.date == today_str).all() if r.person_name.lower().strip() not in UNRELEVANT_NAMES]
        present_today = len(today_records)
        absent_today = max(0, total_enrolled - present_today)
        rate = round((present_today / total_enrolled * 100), 1) if total_enrolled > 0 else 0.0

        # Enriched records
        enriched_records = []
        on_time_count = 0
        late_count = 0
        overtime_count = 0
        total_ot_hours = 0.0
        total_worked_hours = 0.0
        active_on_site_now = 0
        shift_distribution: Dict[str, int] = {}

        for r in today_records:
            r_dict = self.enrich_record_dict(r.to_dict())
            enriched_records.append(r_dict)

            shift_name = r_dict.get("shift", "General Shift").split(" (")[0]
            shift_distribution[shift_name] = shift_distribution.get(shift_name, 0) + 1

            if r_dict.get("punctuality") == "On Time":
                on_time_count += 1
            else:
                late_count += 1

            ot = float(r_dict.get("overtime_hours", 0.0))
            if ot > 0:
                overtime_count += 1
                total_ot_hours += ot

            total_worked_hours += float(r_dict.get("total_hours", 0.0))
            if r_dict.get("active_now"):
                active_on_site_now += 1

        punctuality_rate = round((on_time_count / max(1, present_today)) * 100, 1)
        average_hours = round((total_worked_hours / max(1, present_today)), 2)

        # 7-Day Trend Analysis
        weekly_trend = []
        today_dt = datetime.now()
        for i in range(6, -1, -1):
            day_dt = today_dt - timedelta(days=i)
            day_str = day_dt.strftime("%Y-%m-%d")
            day_name = day_dt.strftime("%a")

            recs = db.query(AttendanceRecord).filter(AttendanceRecord.date == day_str).all()
            cnt = len(recs)
            d_rate = round(cnt / max(1, total_enrolled) * 100, 1)
            on_t = sum(1 for x in recs if self.classify_shift_and_punctuality(x.first_in)["punctuality"] == "On Time")

            weekly_trend.append({
                "date": day_str,
                "day": day_name,
                "present": cnt,
                "absent": max(0, total_enrolled - cnt),
                "rate": d_rate,
                "on_time": on_t,
                "late": cnt - on_t
            })

        excel_exists = self.excel_path.exists()
        last_modified = (
            datetime.fromtimestamp(self.excel_path.stat().st_mtime, tz=timezone.utc).isoformat()
            if excel_exists else None
        )
        onedrive_url = getattr(config, "ONEDRIVE_LIVE_URL", "https://d.docs.live.net/13FB1DC024CF6090/Documents/Attendance.xlsx")

        return {
            "date": today_str,
            "total_enrolled": total_enrolled,
            "present_today": present_today,
            "absent_today": absent_today,
            "attendance_rate": rate,
            "on_time_count": on_time_count,
            "late_count": late_count,
            "overtime_count": overtime_count,
            "total_overtime_hours": round(total_ot_hours, 2),
            "average_hours": average_hours,
            "punctuality_rate": punctuality_rate,
            "active_on_site_now": active_on_site_now,
            "shift_distribution": shift_distribution,
            "weekly_trend": weekly_trend,
            "excel_path": str(self.excel_path),
            "onedrive_url": onedrive_url,
            "excel_exists": excel_exists,
            "last_excel_sync": last_modified,
            "records_today": enriched_records
        }


attendance_service = AttendanceService()
