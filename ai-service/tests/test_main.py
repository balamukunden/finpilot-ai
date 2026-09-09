"""
FinPilot AI Service tests.

The OCR engine (EasyOCR/torch) is excluded from the CI dependency set on
purpose; every OCR-backed path is exercised with extract_text_from_array
stubbed, while the pure parsing logic (parse_receipt_text) and real
PDF rasterization (PyMuPDF) are tested for real.
"""

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import app.main as main

client = TestClient(main.app)


# ============================================
# Helpers
# ============================================

def make_png_bytes(width=120, height=60, color=(255, 255, 255)):
    img = Image.new("RGB", (width, height), color)
    draw = ImageDraw.Draw(img)
    draw.text((8, 20), "Total: 450.00", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_pdf_bytes():
    import fitz

    doc = fitz.open()
    page = doc.new_page(width=300, height=120)
    page.insert_text((20, 60), "Grand Total: 999.50")
    data = doc.tobytes()
    doc.close()
    return data


def ocr_stub(text):
    return lambda array: text


# ============================================
# Health
# ============================================

class TestHealth:
    def test_health_ok(self):
        res = client.get("/api/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["service"] == "FinPilot AI"
        assert "ocr" in body
        assert body["llm"]["provider"] == main.settings.provider
        assert "configured" in body["llm"]

    def test_health_reports_hosted_provider_without_probing_llm(self, monkeypatch):
        # Health must never call the provider — it only reflects config.
        monkeypatch.setattr(main.settings, "ai_provider", "openai")
        monkeypatch.setattr(main.settings, "llm_api_key", "")
        monkeypatch.setattr(main.settings, "llm_model", "test-model")
        res = client.get("/api/health")
        body = res.json()
        assert body["status"] == "ok"
        assert body["llm"]["configured"] is False
        assert "missing LLM_API_KEY" in body["llm"]["detail"]


# ============================================
# Shared-secret auth
# ============================================

class TestServiceKeyAuth:
    def test_missing_or_wrong_key_rejected(self, monkeypatch):
        monkeypatch.setattr(main.settings, "ai_service_key", "super-secret-key")
        res = client.post("/api/chat", json={"message": "hi", "userId": "u1", "context": {}})
        assert res.status_code == 401

        res = client.post("/api/chat", json={"message": "hi", "userId": "u1"}, headers={"X-Ai-Service-Key": "wrong"})
        assert res.status_code == 401

    def test_correct_key_accepted(self, monkeypatch):
        monkeypatch.setattr(main.settings, "ai_service_key", "super-secret-key")

        async def fake_chat(message, context={}):
            return "fallback reply"

        monkeypatch.setattr(main, "chat_with_llm", fake_chat)
        res = client.post(
            "/api/chat",
            json={"message": "how do I save more", "userId": "u1", "context": {}},
            headers={"X-Ai-Service-Key": "super-secret-key"},
        )
        assert res.status_code == 200
        assert res.json()["response"] == "fallback reply"

    def test_health_stays_public(self, monkeypatch):
        monkeypatch.setattr(main.settings, "ai_service_key", "super-secret-key")
        assert client.get("/api/health").status_code == 200


# ============================================
# Receipt scanning
# ============================================

class TestScanReceipt:
    def test_rejects_unsupported_content_type(self):
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("receipt.txt", b"plain text", "text/plain")},
        )
        assert res.status_code == 400

    def test_rejects_empty_file(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 10 * 1024 * 1024)
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("empty.png", b"", "image/png")},
        )
        assert res.status_code == 400

    def test_rejects_oversized_file(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 100)
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("big.png", b"x" * 5000, "image/png")},
        )
        assert res.status_code == 413

    def test_rejects_malformed_image(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 10 * 1024 * 1024)
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("bad.jpg", b"this is not an image", "image/jpeg")},
        )
        assert res.status_code == 400

    def test_empty_extraction_when_no_text_detected(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 10 * 1024 * 1024)
        monkeypatch.setattr(main, "extract_text_from_array", ocr_stub(""))
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("blank.png", make_png_bytes(), "image/png")},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["amount"] == 0
        assert body["confidence"] == 0
        assert "No text detected" in body["raw_text"]

    def test_parses_receipt_from_image(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 10 * 1024 * 1024)
        monkeypatch.setattr(
            main,
            "extract_text_from_array",
            ocr_stub("Swiggy\nItems\nTotal: ₹450.00\nGST: 23.5"),
        )
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("receipt.png", make_png_bytes(), "image/png")},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["amount"] == 450.0
        assert body["merchant"] == "Swiggy"
        assert body["category"] == "food"
        assert body["gst"] == 23.5
        assert body["confidence"] == 0.7

    def test_parses_receipt_from_pdf(self, monkeypatch):
        monkeypatch.setattr(main.settings, "max_upload_size", 10 * 1024 * 1024)
        monkeypatch.setattr(main, "extract_text_from_array", ocr_stub("Grand Total: 999.50"))
        res = client.post(
            "/api/scan-receipt",
            files={"file": ("receipt.pdf", make_pdf_bytes(), "application/pdf")},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["amount"] == 999.5
        assert body["confidence"] == 0.7


# ============================================
# Receipt parsing (pure logic)
# ============================================

class TestParseReceiptText:
    def test_amount_from_total(self):
        result = main.parse_receipt_text("My Cafe\nTotal: 320.00\nThanks")
        assert result["amount"] == 320.0

    def test_amount_from_grand(self):
        result = main.parse_receipt_text("Grand Total: ₹1,240.50\nBye")
        assert result["amount"] == 1240.5

    def test_no_amount(self):
        result = main.parse_receipt_text("no numbers here")
        assert result["amount"] == 0
        assert result["confidence"] == 0.3

    def test_date_normalization(self):
        result = main.parse_receipt_text("12/08/2026\nTotal: 100.00")
        assert result["date"] == "2026-08-12"

    def test_category_detection(self):
        assert main.categorize_merchant("zomato order") == "food"
        assert main.categorize_merchant("amazon") == "shopping"
        assert main.categorize_merchant("unknown entity") == "other"

    def test_merchant_first_line(self):
        result = main.parse_receipt_text("BigBasket\nInvoice #12\nTotal: 800.00")
        assert result["merchant"] == "BigBasket"

    def test_gst_extraction(self):
        result = main.parse_receipt_text("CGST 9.0\nSGST 9.0\nGST 18.0")
        assert result["gst"] == 18.0


# ============================================
# Chat
# ============================================

class TestChat:
    def test_chat_returns_response(self, monkeypatch):
        async def fake_chat(message, context={}):
            return "hello!"

        monkeypatch.setattr(main, "chat_with_llm", fake_chat)
        res = client.post("/api/chat", json={"message": "hi", "userId": "u1", "context": {}})
        assert res.status_code == 200
        assert res.json()["response"] == "hello!"

    def test_chat_falls_back_when_provider_unavailable(self, monkeypatch):
        from app.services import llm_service

        async def unavailable_llm(prompt, system=None):
            raise llm_service.LLMUnavailableError("provider down")

        monkeypatch.setattr(llm_service, "generate_response", unavailable_llm)
        res = client.post(
            "/api/chat",
            json={"message": "hi", "userId": "u1", "context": {}},
        )
        assert res.status_code == 200
        reply = res.json()["response"]
        assert "FinPilot" in reply

    def test_fallback_spending_summary(self):
        reply = main.generate_fallback_response(
            "how much did I spend",
            {"monthlyIncome": 100000, "monthlyExpenses": 70000},
        )
        assert "90,000" not in reply
        assert "70,000" in reply
        assert "30.0%" in reply

    def test_fallback_projection_is_honest(self):
        reply = main.generate_fallback_response(
            "where should I invest",
            {"monthlyIncome": 100000, "monthlyExpenses": 60000},
        )
        assert "Illustration only" in reply or "not a guarantee" in reply
        assert "guaranteed" not in reply.lower().replace("not a guarantee", "")

    def test_fallback_savings_tips(self):
        reply = main.generate_fallback_response(
            "help me save",
            {"monthlyIncome": 50000, "monthlyExpenses": 20000},
        )
        assert "60.0%" in reply


# ============================================
# Transaction analysis
# ============================================

class TestAnalyzeTransaction:
    def test_high_spend_insight(self):
        res = client.post(
            "/api/analyze-transaction",
            json={"transaction": {"amount": 6000, "category": "shopping"}, "userId": "u1"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["category"] == "shopping"
        assert len(body["insights"]) == 1
        assert body["score_impact"] == -2

    def test_subscription_insight(self):
        res = client.post(
            "/api/analyze-transaction",
            json={"transaction": {"amount": 199, "category": "subscriptions"}, "userId": "u1"},
        )
        body = res.json()
        assert "Subscription" in body["insights"][0]

    def test_normal_transaction_is_quiet(self):
        res = client.post(
            "/api/analyze-transaction",
            json={"transaction": {"amount": 50, "category": "transport"}, "userId": "u1"},
        )
        body = res.json()
        assert body["insights"] == []
        assert body["score_impact"] == 0


# ============================================
# Production settings validation
# ============================================

class TestSettingsValidation:
    def test_production_requires_key(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "")
        monkeypatch.setenv("AI_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "sk-test")
        monkeypatch.setenv("LLM_MODEL", "test-model")
        with pytest.raises(RuntimeError, match="AI_SERVICE_KEY is required"):
            main.Settings().validate()

    def test_production_requires_llm_api_key(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "k")
        monkeypatch.setenv("AI_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "")
        monkeypatch.setenv("LLM_MODEL", "test-model")
        with pytest.raises(RuntimeError, match="LLM_API_KEY is required"):
            main.Settings().validate()

    def test_production_requires_llm_model(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "k")
        monkeypatch.setenv("AI_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "sk-test")
        monkeypatch.setenv("LLM_MODEL", "")
        with pytest.raises(RuntimeError, match="LLM_MODEL is required"):
            main.Settings().validate()

    def test_invalid_provider_rejected(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "not-a-provider")
        with pytest.raises(RuntimeError, match="Unsupported AI_PROVIDER"):
            main.Settings().validate()

    def test_ollama_dev_config_allowed(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "development")
        monkeypatch.setenv("AI_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_URL", "http://localhost:11434")
        assert main.Settings().validate().provider == "ollama"

    def test_production_rejects_ollama_localhost(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "k")
        monkeypatch.setenv("AI_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_URL", "http://localhost:11434")
        with pytest.raises(RuntimeError, match="localhost"):
            main.Settings().validate()

    def test_production_hosted_provider_ignores_ollama_vars(self, monkeypatch):
        # Hosted production must NOT reject a leftover localhost OLLAMA_URL.
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "k")
        monkeypatch.setenv("AI_PROVIDER", "openai")
        monkeypatch.setenv("LLM_API_KEY", "sk-test")
        monkeypatch.setenv("LLM_MODEL", "test-model")
        monkeypatch.setenv("OLLAMA_URL", "http://localhost:11434")
        s = main.Settings().validate()
        assert s.provider == "openai"
        assert "http://localhost:11434" in s.resolved_ollama_url  # unused, not fatal

    def test_ollama_base_url_alias_takes_precedence(self, monkeypatch):
        monkeypatch.setenv("OLLAMA_URL", "http://old.example.com:11434")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://new.example.com:11434")
        assert main.Settings().resolved_ollama_url == "http://new.example.com:11434"
        monkeypatch.delenv("OLLAMA_BASE_URL")
        assert main.Settings().resolved_ollama_url == "http://old.example.com:11434"

    def test_production_rejects_localhost_via_base_url_alias(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("AI_SERVICE_KEY", "k")
        monkeypatch.setenv("AI_PROVIDER", "ollama")
        monkeypatch.delenv("OLLAMA_URL", raising=False)
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        with pytest.raises(RuntimeError, match="localhost"):
            main.Settings().validate()