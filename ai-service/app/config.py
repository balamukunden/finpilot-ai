"""
FinPilot AI Service configuration.

The service talks to a hosted LLM API through a small provider abstraction.
`AI_PROVIDER=openai` (the default) targets any OpenAI-compatible
`/chat/completions` endpoint. Ollama remains supported ONLY as an optional
local-development provider.

The Node backend never learns anything about the LLM provider — it only holds
`AI_SERVICE_URL`/`AI_SERVICE_KEY`. The LLM provider secret (`LLM_API_KEY`)
exists only in this service's environment.
"""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

ALLOWED_AI_PROVIDERS = ("openai", "ollama")
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"

    # ---------------------------------------------------------------
    # LLM provider (hosted, default). `openai` = any OpenAI-compatible
    # /chat/completions API (OpenAI, OpenRouter, Together, Groq, ...).
    # `ollama` = LOCAL DEVELOPMENT ONLY.
    # ---------------------------------------------------------------
    ai_provider: str = "openai"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = DEFAULT_OPENAI_BASE_URL
    llm_timeout: float = 25.0
    llm_temperature: float = 0.7
    llm_max_tokens: int = 500

    # ---------------------------------------------------------------
    # Ollama — LOCAL DEVELOPMENT ONLY. Never required for production.
    # ---------------------------------------------------------------
    ollama_url: str = "http://localhost:11434"
    ollama_base_url: str = ""  # accepted alias; takes precedence over ollama_url
    ollama_model: str = "qwen3:8b"
    ollama_timeout: float = 30.0
    ollama_temperature: float = 0.7
    ollama_max_tokens: int = 500

    # OCR
    ocr_lang: str = "en"
    ocr_gpu: bool = False

    max_upload_size: int = 10 * 1024 * 1024  # 10 MB

    # Shared secret. When set, the API key must be presented in the
    # `X-Ai-Service-Key` header. Required in production.
    ai_service_key: str = ""

    cors_origins: str = "http://localhost:5173,http://localhost:5000"

    @property
    def provider(self) -> str:
        return (self.ai_provider or "openai").strip().lower()

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def resolved_ollama_url(self) -> str:
        """OLLAMA_BASE_URL takes precedence; falls back to OLLAMA_URL."""
        return self.ollama_base_url.strip() or self.ollama_url

    @property
    def hosted_provider_configured(self) -> bool:
        """True when the hosted (openai-compatible) provider has a key + model."""
        return bool(self.llm_api_key) and bool(self.llm_model)

    def validate(self) -> "Settings":
        provider = self.provider
        if provider not in ALLOWED_AI_PROVIDERS:
            raise RuntimeError(
                f"Unsupported AI_PROVIDER={self.ai_provider!r}. "
                f"Allowed values: {', '.join(ALLOWED_AI_PROVIDERS)}."
            )
        if self.is_production:
            # Unknown providers must be rejected loudly so a typo cannot spin up
            # a service that silently falls back on every request.
            if not self.ai_service_key:
                raise RuntimeError(
                    "AI_SERVICE_KEY is required in production. Refusing to start unauthenticated."
                )
            if provider == "ollama":
                url = self.resolved_ollama_url.lower()
                if "localhost" in url or "127.0.0.1" in url or url.startswith("http://"):
                    raise RuntimeError(
                        "AI_PROVIDER=ollama is LOCAL DEVELOPMENT ONLY and is not allowed in "
                        "production, and OLLAMA_URL/OLLAMA_BASE_URL must never be localhost or "
                        "plain HTTP in production. Use a hosted provider (AI_PROVIDER=openai "
                        "with LLM_API_KEY/LLM_MODEL) or an explicitly secured external Ollama "
                        "endpoint over HTTPS."
                    )
            else:
                if not self.llm_api_key:
                    raise RuntimeError(
                        "LLM_API_KEY is required in production when AI_PROVIDER is a hosted "
                        "provider. Refusing to start without it."
                    )
                if not self.llm_model:
                    raise RuntimeError(
                        "LLM_MODEL is required in production when AI_PROVIDER is a hosted "
                        "provider. Refusing to start without it."
                    )
        return self


settings = Settings().validate()