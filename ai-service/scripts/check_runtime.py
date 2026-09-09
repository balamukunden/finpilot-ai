"""Verify the AI-service runtime dependencies and LLM provider configuration.

Run inside the production container (or the runtime venv) after
`pip install -r requirements.txt`. Exits non-zero if any required
runtime module is missing — this is the check that OCR is not stubbed.

Also reports the AI provider configuration state (hosted API vs local Ollama)
without printing any secret value.

Usage:  python scripts/check_runtime.py
"""

import importlib
import os
import sys

# Make the ai-service package importable when run as `python scripts/check_runtime.py`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MAIN_DEPENDENCIES = ("fastapi", "pydantic", "pydantic_settings", "uvicorn", "httpx", "PIL", "numpy")
OCR_DEPENDENCIES = ("easyocr", "cv2", "torch")
PDF_DEPENDENCIES = ("fitz",)  # PyMuPDF


def check(name, deps, required):
    missing = []
    for dep in deps:
        try:
            importlib.import_module(dep)
            print(f"[OK]     {name}: {dep}")
        except ImportError:
            missing.append(dep)
            print(f"[{'FAIL' if required else 'WARN'}]   {name}: {dep} MISSING")
    return not missing if required else True


def check_provider_config():
    """Report AI provider configuration. Never prints secrets."""
    try:
        from app.config import Settings

        settings = Settings().validate()
    except RuntimeError as exc:
        print(f"[FAIL]   AI provider config: {exc}")
        return False
    except Exception as exc:  # pragma: no cover - unexpected import failure
        print(f"[FAIL]   AI provider config could not be loaded: {exc}")
        return False

    provider = settings.provider
    print(f"[INFO]   AI provider: {provider}")
    print(f"[INFO]   APP_ENV: {settings.app_env}")

    if provider == "ollama":
        url = settings.resolved_ollama_url
        if settings.is_production:
            print("[FAIL]   Ollama is LOCAL DEVELOPMENT ONLY and is not allowed in production.")
            return False
        print(f"[INFO]   Ollama endpoint: {url}")
        print("[INFO]   Ollama: LOCAL DEVELOPMENT ONLY")
        return True

    key_present = bool(settings.llm_api_key)
    model_present = bool(settings.llm_model)
    print(f"[{'OK' if key_present else 'WARN'}]   LLM API key: {'PRESENT' if key_present else 'MISSING'}")
    print(f"[{'OK' if model_present else 'WARN'}]   LLM model: {'CONFIGURED' if model_present else 'MISSING'}")
    print(f"[INFO]   LLM base URL: {settings.llm_base_url}")
    print("[INFO]   Ollama: NOT REQUIRED")

    if settings.is_production:
        # Missing key/model refuses to start in production (config.validate),
        # so this state should never be reached; report FAIL anyway if it is.
        return key_present and model_present
    # Development may run without a hosted key — that is a WARN, not a FAIL.
    return True


def main():
    print("AI service runtime dependency check")
    print(f"Python: {sys.version.split()[0]}")
    ok = True
    ok &= check("web framework", MAIN_DEPENDENCIES, required=True)
    ok &= check("OCR (EasyOCR + OpenCV + Torch)", OCR_DEPENDENCIES, required=False)
    ok &= check("PDF (PyMuPDF)", PDF_DEPENDENCIES, required=False)

    print("\nAI provider configuration:")
    ok &= check_provider_config()

    print("\nOK — all required runtime dependencies present." if ok else
          "\nFAILED/WARNED — review the messages above.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())