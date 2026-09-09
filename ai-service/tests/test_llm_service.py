"""
LLM provider abstraction tests — app/services/llm_service.py.

All provider calls are mocked; no real API, no Ollama, no torch model, and no
internet access is required. The normal test suite must stay offline.
"""

import asyncio

import httpx
import pytest

from app.config import settings
from app.services import llm_service

pytestmark = pytest.mark.asyncio


# ============================================
# Helpers
# ============================================

class FakeResponse:
    def __init__(self, status_code, payload=None, json_error=None):
        self.status_code = status_code
        self._payload = payload
        self._json_error = json_error

    def json(self):
        if self._json_error is not None:
            raise self._json_error
        return self._payload


class FakeClient:
    def __init__(self, responses=None, handler=None):
        self._responses = list(responses or [])
        self._handler = handler
        self.calls = 0
        self.last_kwargs = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, headers=None):
        self.calls += 1
        self.last_kwargs = {"url": url, "headers": headers, "json": json}
        if self._handler is not None:
            return self._handler(url=url, json=json, headers=headers)
        if self._responses:
            return self._responses.pop(0)
        raise AssertionError("no mocked response provided")


def install_client(monkeypatch, responses=None, handler=None):
    fake = FakeClient(responses=responses, handler=handler)
    monkeypatch.setattr(llm_service.httpx, "AsyncClient", lambda **kw: fake)
    return fake


def configure_hosted(monkeypatch, key="sk-test", model="test-model"):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "llm_api_key", key)
    monkeypatch.setattr(settings, "llm_model", model)
    monkeypatch.setattr(settings, "llm_base_url", "https://example.test/v1")


def configure_ollama(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ollama_url", "http://localhost:11434")
    monkeypatch.setattr(settings, "ollama_base_url", "")
    monkeypatch.setattr(settings, "ollama_model", "test-model")


# ============================================
# Hosted (openai-compatible) provider
# ============================================

class TestHostedProvider:
    async def test_success(self, monkeypatch):
        configure_hosted(monkeypatch)
        fake = install_client(
            monkeypatch,
            handler=lambda **kw: FakeResponse(
                200, {"choices": [{"message": {"content": "42"}}]}
            ),
        )
        assert await llm_service.generate_response("What is 6*7?") == "42"
        assert fake.calls == 1
        assert fake.last_kwargs["url"] == "https://example.test/v1/chat/completions"
        assert fake.last_kwargs["headers"]["Authorization"] == "Bearer sk-test"
        assert fake.last_kwargs["json"]["model"] == "test-model"

    async def test_timeout_retries_then_controlled_error(self, monkeypatch):
        configure_hosted(monkeypatch)
        async def no_backoff(attempt):  # keep the test fast
            return None
        monkeypatch.setattr(llm_service, "_backoff", no_backoff)
        fake = install_client(
            monkeypatch,
            handler=lambda **kw: (_ for _ in ()).throw(httpx.TimeoutException("slow")),
        )
        with pytest.raises(llm_service.LLMUnavailableError, match="unreachable or timed out"):
            await llm_service.generate_response("hi")
        # limited retries, not unbounded
        assert fake.calls == llm_service.MAX_ATTEMPTS

    async def test_429_retries_then_succeeds(self, monkeypatch):
        configure_hosted(monkeypatch)
        async def no_backoff(attempt):
            return None
        monkeypatch.setattr(llm_service, "_backoff", no_backoff)
        fake = install_client(monkeypatch, responses=[
            FakeResponse(429, {}),
            FakeResponse(200, {"choices": [{"message": {"content": "ok"}}]}),
        ])
        assert await llm_service.generate_response("hi") == "ok"
        assert fake.calls == 2

    async def test_429_exhausted_is_controlled_error(self, monkeypatch):
        configure_hosted(monkeypatch)
        async def no_backoff(attempt):
            return None
        monkeypatch.setattr(llm_service, "_backoff", no_backoff)
        fake = install_client(monkeypatch, responses=[
            FakeResponse(429, {}),
            FakeResponse(429, {}),
            FakeResponse(429, {}),
        ])
        with pytest.raises(llm_service.LLMUnavailableError, match="temporarily unavailable"):
            await llm_service.generate_response("hi")
        assert fake.calls == llm_service.MAX_ATTEMPTS

    async def test_500_not_retried_and_controlled_error(self, monkeypatch):
        configure_hosted(monkeypatch)
        fake = install_client(monkeypatch, responses=[FakeResponse(500, {})])
        with pytest.raises(llm_service.LLMUnavailableError, match="temporarily unavailable"):
            await llm_service.generate_response("hi")
        assert fake.calls == 1  # never multiply costs on server errors

    async def test_401_not_retried(self, monkeypatch):
        configure_hosted(monkeypatch)
        fake = install_client(monkeypatch, responses=[FakeResponse(401, {})])
        with pytest.raises(llm_service.LLMUnavailableError, match="LLM_API_KEY"):
            await llm_service.generate_response("hi")
        assert fake.calls == 1

    async def test_403_not_retried(self, monkeypatch):
        configure_hosted(monkeypatch)
        fake = install_client(monkeypatch, responses=[FakeResponse(403, {})])
        with pytest.raises(llm_service.LLMUnavailableError, match="LLM_API_KEY"):
            await llm_service.generate_response("hi")
        assert fake.calls == 1

    async def test_malformed_response_no_choices(self, monkeypatch):
        configure_hosted(monkeypatch)
        install_client(monkeypatch, responses=[FakeResponse(200, {"choices": []})])
        with pytest.raises(llm_service.LLMUnavailableError, match="malformed response"):
            await llm_service.generate_response("hi")

    async def test_malformed_non_json_body(self, monkeypatch):
        configure_hosted(monkeypatch)
        install_client(monkeypatch, responses=[FakeResponse(200, json_error=ValueError("bad json"))])
        with pytest.raises(llm_service.LLMUnavailableError, match="malformed"):
            await llm_service.generate_response("hi")

    async def test_empty_content_is_controlled_error(self, monkeypatch):
        configure_hosted(monkeypatch)
        install_client(
            monkeypatch,
            responses=[FakeResponse(200, {"choices": [{"message": {"content": "   "}}]})],
        )
        with pytest.raises(llm_service.LLMUnavailableError, match="empty response"):
            await llm_service.generate_response("hi")


# ============================================
# Ollama (LOCAL DEVELOPMENT ONLY) provider
# ============================================

class TestOllamaProvider:
    async def test_success(self, monkeypatch):
        configure_ollama(monkeypatch)
        fake = install_client(
            monkeypatch,
            responses=[FakeResponse(200, {"message": {"content": "hello"}})],
        )
        assert await llm_service.generate_response("hi") == "hello"
        assert fake.calls == 1
        assert fake.last_kwargs["url"] == "http://localhost:11434/api/chat"

    async def test_strips_thinking_tags(self, monkeypatch):
        configure_ollama(monkeypatch)
        install_client(
            monkeypatch,
            responses=[FakeResponse(200, {"message": {"content": "thinking\nlong reasoning\n/thinking\nfinal answer"}})],
        )
        assert await llm_service.generate_response("hi") == "final answer"


# ============================================
# Provider selection
# ============================================

class TestProviderSelection:
    async def test_unsupported_provider_is_controlled_error(self, monkeypatch):
        monkeypatch.setattr(settings, "ai_provider", "bogus")
        with pytest.raises(llm_service.LLMUnavailableError, match="Unsupported AI_PROVIDER"):
            await llm_service.generate_response("hi")

    async def test_provider_selection_uses_configured_provider(self, monkeypatch):
        # openai must never send an Ollama-style payload
        configure_hosted(monkeypatch)
        fake = install_client(
            monkeypatch,
            responses=[FakeResponse(200, {"choices": [{"message": {"content": "x"}}]})],
        )
        await llm_service.generate_response("hi", system="be helpful")
        assert fake.last_kwargs["json"]["messages"][0]["role"] == "system"
        assert "options" not in fake.last_kwargs["json"]