"""Boot the AI service with uvicorn, hit /api/health, then shut down.

Requires the runtime (or test) venv:  .venv/Scripts/python scripts/smoke_service.py
Exits 0 when the service boots and answers a health check.
"""

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

PORT = 8001


def wait_for_health(timeout_s=20):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=2) as resp:
                return resp.status, resp.read().decode()
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.25)
    raise RuntimeError("ai-service health endpoint never responded")


def main():
    env = {**os.environ, "PORT": str(PORT)}
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        status, body = wait_for_health()
        print(f"HEALTH_STATUS={status}")
        print(f"HEALTH_BODY={body}")
        return 0 if status == 200 else 1
    except Exception as error:  # noqa: BLE001
        out, _ = proc.communicate(timeout=5)
        print(f"BOOT_LOG={out.decode(errors='replace')[-800:]}")
        print(f"ERROR={error}")
        return 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())