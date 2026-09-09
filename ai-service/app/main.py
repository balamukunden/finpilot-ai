"""
FinPilot AI Service — FastAPI backend.

Provides OCR-based receipt scanning (with PDF support), a financial chat
assistant backed by a hosted LLM API (or a local Ollama instance during
development), and lightweight transaction analysis.

The service talks to an external LLM provider through a small provider
abstraction (app/services/llm_service.py); no model is packaged, downloaded,
or run inside this service. The Node backend only ever knows
AI_SERVICE_URL/AI_SERVICE_KEY — never LLM credentials.

All heavy dependencies (EasyOCR/torch, PyMuPDF) are imported lazily so the
service can boot without them; the /api/health endpoint reports what is
actually available.
"""

import io
import logging
import os
import re
import secrets
from datetime import datetime
from typing import Optional

import numpy as np
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

from app.config import Settings, settings
from app.services import llm_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("finpilot-ai")


# ============================================
# Configuration (see app/config.py)
# ============================================

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

app = FastAPI(
    title="FinPilot AI Service",
    description="AI-powered financial analysis, OCR, and chat",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Authentication
# ============================================

def verify_service_key(request: Request) -> None:
    """Require the shared X-Ai-Service-Key header when one is configured."""
    if not settings.ai_service_key:
        return
    provided = request.headers.get("x-ai-service-key", "")
    if not secrets.compare_digest(provided, settings.ai_service_key):
        raise HTTPException(status_code=401, detail="Invalid or missing AI service key.")


# ============================================
# Models
# ============================================

class ChatRequest(BaseModel):
    message: str
    userId: str
    context: Optional[dict] = {}


class TransactionAnalysis(BaseModel):
    transaction: dict
    userId: str


# ============================================
# Exception handling — keep error JSON consistent
# ============================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )


# ============================================
# OCR Service (lazy loaded — EasyOCR single engine)
# ============================================

_ocr_reader = None
_ocr_failed = None


def get_ocr():
    global _ocr_reader, _ocr_failed
    if _ocr_reader is not None:
        return _ocr_reader
    if _ocr_failed is not None:
        return None
    try:
        import easyocr

        _ocr_reader = easyocr.Reader([settings.ocr_lang], gpu=settings.ocr_gpu)
        logger.info("EasyOCR loaded (lang=%s)", settings.ocr_lang)
        return _ocr_reader
    except Exception as exc:  # pragma: no cover - depends on environment
        _ocr_failed = str(exc)
        logger.error("EasyOCR unavailable: %s", exc)
        return None


def extract_text_from_array(array) -> str:
    """Run OCR on an RGB numpy array and return detected text."""
    reader = get_ocr()
    if reader is None:
        return ""

    try:
        lines = reader.readtext(array, detail=0)
        return "\n".join(str(line).strip() for line in lines if str(line).strip())
    except Exception as exc:
        logger.warning("OCR failed on image: %s", exc)
        return ""


def extract_text_from_image(image_bytes: bytes) -> str:
    """Decode image bytes then run OCR."""
    return extract_text_from_array(_decode_image(image_bytes))


def _decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes into an RGB numpy array, raising on garbage input."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        return np.array(img.convert("RGB"))


def _render_pdf_to_images(pdf_bytes: bytes) -> list:
    """Rasterize every page of a PDF into RGB numpy arrays for OCR."""
    try:
        import pymupdf as fitz  # PyMuPDF >= 1.24
    except ImportError:  # pragma: no cover - older PyMuPDF
        import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        images.append(_decode_image(pix.tobytes("png")))
    doc.close()
    return images


def _parse_amounts(text: str) -> list:
    """Collect plausible monetary values from receipt text."""
    amounts = []

    currency_re = re.compile(
        r"(?:rs\.?|₹|inr|total|amount|grand|net|due)[\s:₹]*(\d[\d,]*(?:\.\d{1,2})?)",
        re.IGNORECASE,
    )
    standalone_re = re.compile(r"\b(\d[\d,]*(?:\.\d{1,2})?)\b")

    for pattern in (currency_re, standalone_re):
        for m in pattern.finditer(text):
            raw = m.group(1)
            try:
                amounts.append(float(raw.replace(",", "")))
            except ValueError:
                continue

    return amounts


def _extract_gst(text: str) -> float:
    """Sum CGST/SGST or take the standalone GST/IGST figure, heuristically."""
    found = {"cgst": [], "sgst": [], "igst": [], "gst": []}
    for kind in found:
        pattern = re.compile(
            r"(?<![a-z])" + kind + r"[\s:]*\s*(?:rs\.?|₹)?\s*(\d+\.?\d*)",
            re.IGNORECASE,
        )
        for m in pattern.finditer(text):
            try:
                found[kind].append(float(m.group(1)))
            except ValueError:
                continue

    plain_gst = found["gst"]
    cgst = found["cgst"]
    sgst = found["sgst"]
    igst = found["igst"]

    if plain_gst:
        return max(plain_gst)
    if igst:
        return max(igst)
    if cgst and sgst:
        return max(cgst) + max(sgst)
    if cgst:
        return max(cgst)
    if sgst:
        return max(sgst)
    return 0.0


def parse_receipt_text(text: str) -> dict:
    """Parse receipt text to extract structured data."""
    lines = text.strip().split("\n")

    amounts = _parse_amounts(text)
    amount = max(amounts) if amounts else 0

    # Extract date
    date = datetime.now().strftime("%Y-%m-%d")
    date_patterns = [
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
        r"(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})",
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date = match.group(1)
            date = _normalize_date(date)
            break

    # Extract merchant (usually the first non-empty line)
    merchant = ""
    for line in lines[:5]:
        clean = line.strip()
        if len(clean) > 2 and not re.match(r"^[\d\s.\-/]+$", clean):
            merchant = clean
            break

    # Extract GST
    gst = _extract_gst(text)

    category = categorize_merchant(merchant + " " + text)

    return {
        "merchant": merchant[:100],
        "date": date,
        "amount": amount,
        "items": [line.strip() for line in lines if len(line.strip()) > 3][:10],
        "gst": gst,
        "category": category,
        "confidence": 0.7 if amount > 0 else 0.3,
        "raw_text": text[:1000],
    }


def _normalize_date(raw: str) -> str:
    """Convert dd/mm/yy variants to the ISO-ish format FinPilot expects."""
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def categorize_merchant(text: str) -> str:
    """Simple keyword-based categorization."""
    text = text.lower()
    categories = {
        "food": ["restaurant", "cafe", "pizza", "burger", "swiggy", "zomato", "food", "dine", "eat", "biryani", "chicken", "coffee"],
        "groceries": ["grocery", "mart", "supermarket", "bigbasket", "blinkit", "vegetables", "fruits", "milk"],
        "transport": ["uber", "ola", "rapido", "fuel", "petrol", "diesel", "metro", "bus", "taxi", "auto"],
        "shopping": ["amazon", "flipkart", "myntra", "mall", "shop", "store", "fashion"],
        "entertainment": ["netflix", "spotify", "hotstar", "movie", "cinema", "game", "play"],
        "utilities": ["electricity", "water", "gas", "internet", "wifi", "phone", "mobile", "recharge"],
        "health": ["hospital", "pharmacy", "medical", "doctor", "health", "medicine", "clinic"],
        "education": ["school", "college", "course", "udemy", "book", "education", "tuition"],
        "rent": ["rent", "lease", "housing"],
        "subscriptions": ["subscription", "premium", "plan", "membership"],
    }

    for category, keywords in categories.items():
        if any(kw in text for kw in keywords):
            return category

    return "other"


# ============================================
# LLM service (provider-agnostic → app/services/llm_service.py)
# ============================================

SYSTEM_PROMPT = """You are FinPilot AI, a professional financial assistant. You are helpful, precise, and honest.

Rules:
- Base recommendations strictly on the user's actual financial data when it is provided
- Never invent or hallucinate user data, transaction records, or account balances
- Clearly label any projection as illustrative, and state every assumption used
- Never present a return or future value as guaranteed
- Use ₹ (INR) for currency
- If you do not have enough data, ask clarifying questions
- Provide actionable advice, but note you are not a substitute for a certified advisor"""


async def chat_with_llm(message: str, context: dict = {}) -> str:
    """Run the user's message through the configured LLM provider.

    The route does not know (or care) whether the provider is a hosted API or
    a local Ollama instance. If the provider is unavailable, returns the
    honest deterministic fallback — never fabricated AI output.
    """
    context_parts = []
    if context.get("monthlyIncome"):
        context_parts.append(f"Monthly Income: ₹{context['monthlyIncome']:,.0f}")
    if context.get("monthlyExpenses"):
        context_parts.append(f"Monthly Expenses: ₹{context['monthlyExpenses']:,.0f}")
    if context.get("recentTransactions"):
        txns = context["recentTransactions"][:5]
        txn_text = "\n".join(
            f"  - {t.get('category', '')}: ₹{t.get('amount', 0):,.0f} ({t.get('merchant', '')})" for t in txns
        )
        context_parts.append(f"Recent Transactions:\n{txn_text}")

    context_str = "\n".join(context_parts) if context_parts else "No financial data available yet."
    full_prompt = f"User's Financial Context:\n{context_str}\n\nUser's Question: {message}"

    try:
        return await llm_service.generate_response(full_prompt, system=SYSTEM_PROMPT)
    except llm_service.LLMUnavailableError as exc:
        logger.warning("LLM provider unavailable: %s", exc)
    except Exception as exc:  # defensive — never let a provider bug kill chat
        logger.warning("Unexpected LLM error: %s", exc)

    return generate_fallback_response(message, context)


def generate_fallback_response(message: str, context: dict) -> str:
    """Deterministic offline reply. Every projection states its assumptions
    and is explicitly labelled illustrative — nothing is presented as a
    guaranteed return."""
    msg = str(message or "").lower()
    income = context.get("monthlyIncome", 0) or 0
    expenses = context.get("monthlyExpenses", 0) or 0
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0

    if any(w in msg for w in ["spend", "expense", "spent"]):
        return (
            f"📊 **Your spending summary**\n\n"
            f"This month: Income ₹{income:,.0f}, Expenses ₹{expenses:,.0f}, "
            f"Savings ₹{savings:,.0f} ({savings_rate:.1f}%).\n\n"
            + (
                "✅ Your savings rate looks healthy. Try to keep it above 20%."
                if savings_rate > 20
                else "⚠️ Your savings rate is below 20%. Reviewing non-essential expenses can help you improve it."
            )
            + "\n\n*Based only on the data you have recorded in FinPilot.*"
        )

    if any(w in msg for w in ["invest", "portfolio", "sip", "mutual fund"]):
        monthly_invest = max(savings * 0.6, 0)
        years = 10
        assumed_rate = 0.10
        periods = years * 12
        projected = monthly_invest * ((pow(1 + assumed_rate / 12, periods) - 1) / (assumed_rate / 12))
        return (
            f"📈 **Investment considerations**\n\n"
            f"Based on your current savings of ₹{savings:,.0f}/month, common first steps are:\n\n"
            f"1. **Emergency Fund** — keep ₹{expenses * 6:,.0f} (≈6 months of expenses) in a liquid, low-risk account.\n"
            f"2. **Broad-market index funds** via SIPs, alongside **PPF/NPS** for tax-advantaged, long-term goals.\n"
            f"3. **Diversification** — e.g. a small allocation to gold ETFs, appropriate to your risk profile.\n\n"
            f"*Illustration only:* if you invested ₹{monthly_invest * 0.5:,.0f}/month and achieved an assumed "
            f"{assumed_rate * 100:.0f}% annual return, compounded monthly, for {years} years, the projected value "
            f"would be approximately ₹{projected:,.0f}. This is **not a guarantee** — actual returns vary with "
            f"market conditions.\n\n"
            f"This is educational information, not personalized financial advice. For advice tailored to your "
            f"full situation, consult a SEBI-registered advisor."
        )

    if any(w in msg for w in ["save", "saving", "budget", "cut"]):
        return (
            f"💰 **Savings tips**\n\n"
            f"Your current savings rate is {savings_rate:.1f}% (income ₹{income:,.0f}, expenses ₹{expenses:,.0f}).\n\n"
            f"1. **Track every expense** with FinPilot to find leaks.\n"
            f"2. **Set a monthly budget** — a common guideline is ~50% needs, 30% wants, 20% savings.\n"
            f"3. **Automate savings** on salary day so the money moves first.\n"
            f"4. **Review subscriptions** and cancel anything you rarely use.\n\n"
            f"🎯 Aim to save at least 20% of income (₹{income * 0.2:,.0f}/month) when your budget allows."
        )

    return (
        f"👋 I'm your FinPilot AI assistant.\n\n"
        f"I can help you with:\n"
        f"• 📊 **Spending analysis** — \"How much did I spend this month?\"\n"
        f"• 💰 **Saving strategies** — \"How can I save more?\"\n"
        f"• 📈 **Investment considerations** — \"Where should I invest ₹5000/month?\"\n"
        f"• 🎯 **Budget planning** — \"Help me create a budget\"\n\n"
        f"Your current stats: Income ₹{income:,.0f} | Expenses ₹{expenses:,.0f} | Savings ₹{savings:,.0f}\n\n"
        f"Ask me anything about your finances!"
    )


# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
async def health():
    ocr_status = "loaded" if get_ocr() is not None else (f"unavailable ({_ocr_failed})" if _ocr_failed else "not loaded")

    # Application health is independent of the LLM provider. Report provider
    # config state, but never probe the provider (no expensive completion).
    provider = settings.provider
    if provider == "ollama":
        llm = {
            "provider": "ollama",
            "mode": "local-development-only",
            "configured": bool(settings.resolved_ollama_url),
            "model": settings.ollama_model,
        }
    else:
        configured = settings.hosted_provider_configured
        detail = "configured" if configured else (
            "missing LLM_API_KEY" if not settings.llm_api_key else "missing LLM_MODEL"
        )
        llm = {
            "provider": provider,
            "mode": "hosted-api",
            "configured": configured,
            "detail": detail,
            "model": settings.llm_model or None,
        }

    return {
        "status": "ok",
        "service": "FinPilot AI",
        "version": "1.0.0",
        "ocr": ocr_status,
        "llm": llm,
    }


@app.post("/api/scan-receipt", dependencies=[Depends(verify_service_key)])
async def scan_receipt(file: UploadFile = File(...)):
    """Scan a receipt image or PDF and extract structured data."""
    content_type = (file.content_type or "").lower()
    ext = os.path.splitext(file.filename or "")[1].lower()

    if content_type not in ALLOWED_MIME_TYPES or ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Only JPEG, PNG, WebP, and PDF files are supported")

    content = await file.read()

    if len(content) == 0:
        raise HTTPException(400, "Uploaded file is empty")

    if len(content) > settings.max_upload_size:
        raise HTTPException(413, f"File exceeds the {settings.max_upload_size // (1024 * 1024)} MB upload limit")

    try:
        if content_type == "application/pdf":
            images = _render_pdf_to_images(content)
            texts = [extract_text_from_array(image) for image in images]
            text = "\n".join(t for t in texts if t.strip())
        else:
            text = extract_text_from_image(content)

        if not text.strip():
            return {
                "merchant": "",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "amount": 0,
                "items": [],
                "category": "other",
                "gst": 0,
                "confidence": 0,
                "raw_text": "No text detected in image. Please fill in manually.",
            }

        return parse_receipt_text(text)

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Could not process uploaded receipt: %s", exc)
        raise HTTPException(400, "Unable to read the uploaded file. Please upload a valid image or PDF.") from exc


@app.post("/api/chat", dependencies=[Depends(verify_service_key)])
async def chat(request: ChatRequest):
    """Chat with the AI financial assistant."""
    response = await chat_with_llm(request.message, request.context)
    return {"response": response}


@app.post("/api/analyze-transaction", dependencies=[Depends(verify_service_key)])
async def analyze_transaction(request: TransactionAnalysis):
    """Analyze a transaction and return lightweight insights."""
    txn = request.transaction
    amount = txn.get("amount", 0) or 0
    category = txn.get("category", "other")

    insights = []

    if category in ["food", "entertainment", "shopping"] and amount > 2000:
        insights.append(f"High {category} expense of ₹{amount:,.0f}. Consider if this is within your budget.")

    if category == "subscriptions":
        insights.append("Subscription detected. Review all active subscriptions quarterly to avoid waste.")

    return {
        "category": category,
        "insights": insights,
        "score_impact": -2 if amount > 5000 and category != "investments" else 0,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))