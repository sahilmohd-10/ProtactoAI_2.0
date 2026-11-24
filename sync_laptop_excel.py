"""
Protector AI 2.0 - Laptop Excel Two-Way Synchronization Utility
Synchronizes D:\\Downloads\\Attendance.xlsx and OneDrive with the cloud deployment
running on Hugging Face and Vercel.
"""

import os
import sys
import time
import shutil
import tempfile
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from datetime import datetime

CLOUD_BACKEND_URL = os.getenv("PROTECTOR_AI_BACKEND", "https://sahilmohammad512-protecto-ai-backend.hf.space")
LOCAL_BACKEND_URL = "http://127.0.0.1:5000"

# Target local locations on this laptop
PRIMARY_FILE = Path(r"D:\Downloads\Attendance.xlsx")
ONEDRIVE_FILE = Path(r"C:\Users\sahil\OneDrive\Documents\Attendance.xlsx")
USER_DOWNLOADS_FILE = Path(os.path.expanduser(r"~\Downloads\Attendance.xlsx"))

CANDIDATES = [PRIMARY_FILE, ONEDRIVE_FILE, USER_DOWNLOADS_FILE]


def get_active_backend() -> str:
    # Test if local backend is running first
    try:
        req = urllib.request.Request(f"{LOCAL_BACKEND_URL}/api/health", headers={"User-Agent": "ProtectorAI-Sync"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                return LOCAL_BACKEND_URL
    except Exception:
        pass
    return CLOUD_BACKEND_URL


def pull_attendance_from_cloud(backend_url: str) -> bool:
    export_url = f"{backend_url}/api/attendance/export"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching latest attendance workbook from: {backend_url}...")
    try:
        req = urllib.request.Request(export_url, headers={"User-Agent": "ProtectorAI-LaptopSync/2.0"})
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status != 200:
                print(f"[ERROR] Failed to fetch workbook: HTTP {response.status}")
                return False
            data = response.read()

        if len(data) < 500:
            print(f"[WARN] Received suspiciously small file ({len(data)} bytes). Skipping write.")
            return False

        # Atomic temp write
        temp_fd, temp_path_str = tempfile.mkstemp(suffix=".xlsx")
        os.close(temp_fd)
        temp_path = Path(temp_path_str)
        temp_path.write_bytes(data)

        updated_targets = 0
        for target in CANDIDATES:
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(temp_path, target)
                updated_targets += 1
                print(f"  [OK] Synchronized -> {target}")
            except PermissionError:
                companion = target.parent / f"{target.stem}_Live{target.suffix}"
                try:
                    shutil.copy2(temp_path, companion)
                    print(f"  [NOTE] {target.name} is open in Excel. Synced to -> {companion}")
                    updated_targets += 1
                except Exception as comp_err:
                    print(f"  [WARN] Could not write companion file: {comp_err}")
            except Exception as ex:
                print(f"  [WARN] Could not write to {target}: {ex}")

        temp_path.unlink(missing_ok=True)
        return updated_targets > 0
    except Exception as e:
        print(f"[ERROR] Synchronization error: {e}")
        return False


def push_local_to_cloud(backend_url: str, file_path: Path) -> bool:
    if not file_path.exists():
        print(f"[ERROR] Local file does not exist: {file_path}")
        return False

    import mimetypes
    boundary = f"----WebKitFormBoundary{int(time.time()*1000)}"
    file_bytes = file_path.read_bytes()

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n")
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        f"{backend_url}/api/attendance/import-excel",
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "ProtectorAI-LaptopSync/2.0"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            print(f"[OK] Uploaded {file_path.name} to cloud: {content}")
            return True
    except Exception as e:
        print(f"[ERROR] Failed to push local Excel: {e}")
        return False


def main():
    print("=" * 65)
    print("   PROTECTOR AI 2.0 - LAPTOP EXCEL AUTOMATIC SYNCHRONIZER")
    print("=" * 65)
    backend = get_active_backend()
    print(f"Connected Backend: {backend}")
    print(f"Primary Target:    {PRIMARY_FILE}")
    print(f"OneDrive Target:   {ONEDRIVE_FILE}")
    print("=" * 65)

    mode = "loop"
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if "push" in arg:
            mode = "push"
        elif "pull" in arg or "once" in arg:
            mode = "pull"

    if mode == "push":
        push_local_to_cloud(backend, PRIMARY_FILE)
        return

    if mode == "pull":
        pull_attendance_from_cloud(backend)
        return

    print("Running in continuous background sync mode (every 20s).")
    print("Press Ctrl+C at any time to exit.\n")
    
    while True:
        try:
            backend = get_active_backend()
            pull_attendance_from_cloud(backend)
            time.sleep(20)
        except KeyboardInterrupt:
            print("\nSync stopped by user.")
            break
        except Exception as e:
            print(f"[ERROR] Loop iteration exception: {e}")
            time.sleep(10)


if __name__ == "__main__":
    main()
