FROM python:3.12-slim

# System deps for EasyOCR (libgomp) and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user. HOME points at the app dir so runtime caches (e.g. EasyOCR
# model downloads at first OCR use) remain writable.
RUN useradd --create-home --shell /usr/sbin/nologin appuser
ENV HOME=/app

WORKDIR /app

# Application dependencies only. No Ollama, no model runtime, no model weights.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3) or exit(1)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]