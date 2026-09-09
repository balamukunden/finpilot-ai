"""
LLM client abstraction for the FinPilot AI service.

Exposes a single provider-agnostic entry point:

    await generate_response(prompt, system=None) -> str

The calling route/business logic never needs to know whether the backing
provider is a hosted API (OpenAI-compatible) or a local Ollama instance.

Security rules:
- The LLM provider secret (`LLM_API_KEY`) lives only here and is never
  logged, returned, or echoed.
- On any provider failure the service raises `LLMUnavailableError`; callers
  turn that into a controlled, honest reply — provider internals are not
  leaked to the frontend.
- Only transient failures are retried (429 / 502 / 503 / 504 / network /
  timeout). 401 / 403 / invalid requests are never retried to avoid burning
  token/API costs.
"""

import asyncio
import logging
import re

import httpx

logger = logging.getLogger("finpilot-ai.llm")

MAX_ATTEMPTS = 3
RETRYABLE_STATUS = {429, 502, 503, 504}


class LLMUnavailableError(Exception):
    """The configured LLM provider could not produce a response.

    Callers must surface this as a controlled, honest reply and must not
    expose provider internals to the frontend.
    """


def _build_messages(system: str, user_prompt: str) -> list:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user_prompt})
    return messages


async def _backoff(attempt: int) -> None:
    await asyncio.sleep(0.25 * (attempt + 1))


async def _post(settings, url: str, payload: dict, timeout: float, headers: dict) -> dict:
    """POST JSON to the provider with limited retry + controlled errors."""
    last_status = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                try:
                    data = response.json()
                except ValueError:
                    raise LLMUnavailableError("LLM provider returned a malformed (non-JSON) response.")
                if not isinstance(data, dict):
                    raise LLMUnavailableError("LLM provider returned a malformed response body.")
                return data

            last_status = response.status_code
            if response.status_code in RETRYABLE_STATUS and attempt < MAX_ATTEMPTS - 1:
                logger.warning("LLM provider transient status %s; retrying", response.status_code)
                await _backoff(attempt)
                continue
            if response.status_code in (401, 403):
                raise LLMUnavailableError(
                    "LLM provider rejected the request: check LLM_API_KEY / provider access."
                )
            if response.status_code in (400, 404, 422):
                raise LLMUnavailableError("LLM provider rejected the request: check LLM_MODEL / URL.")
            raise LLMUnavailableError("LLM provider is temporarily unavailable.")
        except LLMUnavailableError:
            raise
        except httpx.HTTPError as exc:
            logger.warning("LLM provider network error (attempt %d): %s", attempt + 1, type(exc).__name__)
            if attempt >= MAX_ATTEMPTS - 1:
                break
            await _backoff(attempt)

    if last_status is not None:
        raise LLMUnavailableError(f"LLM provider is temporarily unavailable (HTTP {last_status}).")
    raise LLMUnavailableError("LLM provider is unreachable or timed out.")


async def _call_openai_compatible(settings, messages: list) -> str:
    """Hosted OpenAI-compatible /chat/completions call."""
    base = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")
    url = base + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": settings.llm_temperature,
        "max_tokens": settings.llm_max_tokens,
        "stream": False,
    }
    data = await _post(settings, url, payload, timeout=settings.llm_timeout, headers=headers)

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise LLMUnavailableError("LLM provider returned a malformed response (missing message content).")
    if not isinstance(content, str) or not content.strip():
        raise LLMUnavailableError("LLM provider returned an empty response.")
    return content.strip()


async def _call_ollama(settings, messages: list) -> str:
    """Local-development Ollama /api/chat call. Not a production target."""
    url = settings.resolved_ollama_url.rstrip("/") + "/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": settings.ollama_temperature,
            "num_predict": settings.ollama_max_tokens,
        },
    }
    data = await _post(settings, url, payload, timeout=settings.ollama_timeout, headers={"Content-Type": "application/json"})

    try:
        content = data["message"]["content"]
    except (KeyError, TypeError):
        raise LLMUnavailableError("LLM provider returned a malformed response (missing message content).")
    if not isinstance(content, str) or not content.strip():
        raise LLMUnavailableError("LLM provider returned an empty response.")
    content = re.sub(r"\s*thinking.*?/thinking\s*", "", content, flags=re.DOTALL).strip()
    return content


async def generate_response(prompt: str, system: str | None = None) -> str:
    """Request a completion from the configured provider.

    Returns the response text or raises LLMUnavailableError. Never returns
    fabricated content and never exposes provider secrets or internals.
    """
    settings = _settings()
    messages = _build_messages(system, prompt)

    if settings.provider == "openai":
        return await _call_openai_compatible(settings, messages)
    if settings.provider == "ollama":
        return await _call_ollama(settings, messages)
    raise LLMUnavailableError(f"Unsupported AI_PROVIDER={settings.provider!r}.")


def _settings():
    from app.config import settings

    return settings