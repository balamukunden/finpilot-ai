"""
FinPilot AI Service — FastAPI Backend
Provides OCR scanning, AI chat, financial analysis, and predictions.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import re
import os
import tempfile
from datetime import datetime

app = FastAPI(
    title="FinPilot AI Service",
    description="AI-powered financial analysis, OCR, and chat",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
# OCR Service (lazy loaded)
# ============================================

_ocr_engine = None

def get_ocr():
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    
    # Try PaddleOCR first
    try:
        from paddleocr import PaddleOCR
        _ocr_engine = ("paddle", PaddleOCR(use_angle_cls=True, lang='en', show_log=False))
        print("[OCR] PaddleOCR loaded successfully")
        return _ocr_engine
    except Exception as e:
        print(f"[OCR] PaddleOCR not available: {e}")
    
    # Try EasyOCR as fallback
    try:
        import easyocr
        _ocr_engine = ("easy", easyocr.Reader(['en'], gpu=False))
        print("[OCR] EasyOCR loaded successfully")
        return _ocr_engine
    except Exception as e:
        print(f"[OCR] EasyOCR not available: {e}")
    
    return None

def extract_text_from_image(image_path: str) -> str:
    """Extract text from image using available OCR engine."""
    engine = get_ocr()
    
    if engine is None:
        return ""
    
    engine_type, reader = engine
    
    try:
        if engine_type == "paddle":
            result = reader.ocr(image_path, cls=True)
            texts = []
            if result and result[0]:
                for line in result[0]:
                    texts.append(line[1][0])
            return "\n".join(texts)
        
        elif engine_type == "easy":
            result = reader.readtext(image_path, detail=0)
            return "\n".join(result)
    
    except Exception as e:
        print(f"[OCR] Error: {e}")
        return ""

def parse_receipt_text(text: str) -> dict:
    """Parse receipt text to extract structured data."""
    lines = text.strip().split('\n')
    
    # Extract amount (look for numbers with decimal points or large numbers)
    amounts = []
    for line in lines:
        matches = re.findall(r'(?:rs\.?|₹|inr|total|amount|grand|net|due)[\s:]*(\d+[.,]?\d*)', line.lower())
        if matches:
            for m in matches:
                try:
                    amounts.append(float(m.replace(',', '')))
                except ValueError:
                    pass
        # Also look for standalone amounts
        standalone = re.findall(r'\b(\d{2,6}\.\d{2})\b', line)
        for s in standalone:
            try:
                amounts.append(float(s))
            except ValueError:
                pass
    
    amount = max(amounts) if amounts else 0
    
    # Extract date
    date = datetime.now().strftime('%Y-%m-%d')
    date_patterns = [
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        r'(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4})',
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date = match.group(1)
            break
    
    # Extract merchant (usually the first non-empty line)
    merchant = ''
    for line in lines[:5]:
        clean = line.strip()
        if len(clean) > 2 and not re.match(r'^[\d\s\.\-/]+$', clean):
            merchant = clean
            break
    
    # Extract GST
    gst = 0
    gst_match = re.search(r'(?:gst|tax|cgst|sgst)[\s:]*(?:rs\.?|₹)?\s*(\d+\.?\d*)', text, re.IGNORECASE)
    if gst_match:
        try:
            gst = float(gst_match.group(1))
        except ValueError:
            pass
    
    # Categorize
    category = categorize_merchant(merchant + ' ' + text)
    
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

def categorize_merchant(text: str) -> str:
    """Simple keyword-based categorization."""
    text = text.lower()
    categories = {
        'food': ['restaurant', 'cafe', 'pizza', 'burger', 'swiggy', 'zomato', 'food', 'dine', 'eat', 'biryani', 'chicken', 'coffee'],
        'groceries': ['grocery', 'mart', 'supermarket', 'bigbasket', 'blinkit', 'vegetables', 'fruits', 'milk'],
        'transport': ['uber', 'ola', 'rapido', 'fuel', 'petrol', 'diesel', 'metro', 'bus', 'taxi', 'auto'],
        'shopping': ['amazon', 'flipkart', 'myntra', 'mall', 'shop', 'store', 'fashion'],
        'entertainment': ['netflix', 'spotify', 'hotstar', 'movie', 'cinema', 'game', 'play'],
        'utilities': ['electricity', 'water', 'gas', 'internet', 'wifi', 'phone', 'mobile', 'recharge'],
        'health': ['hospital', 'pharmacy', 'medical', 'doctor', 'health', 'medicine', 'clinic'],
        'education': ['school', 'college', 'course', 'udemy', 'book', 'education', 'tuition'],
        'rent': ['rent', 'lease', 'housing'],
        'subscriptions': ['subscription', 'premium', 'plan', 'membership'],
    }
    
    for category, keywords in categories.items():
        if any(kw in text for kw in keywords):
            return category
    
    return 'other'


# ============================================
# LLM Service (Ollama)
# ============================================

async def chat_with_llm(message: str, context: dict = {}) -> str:
    """Chat with Ollama Qwen3 model."""
    import httpx
    
    system_prompt = """You are FinPilot AI, a professional financial advisor. You are helpful, precise, and data-driven.

Rules:
- Always base recommendations on the user's actual financial data when available
- Calculate exact numbers and projections when possible
- Never hallucinate or make up data
- Be concise but thorough
- Use ₹ (INR) for currency
- If you don't have enough data, ask clarifying questions
- Provide actionable, specific advice"""

    # Build context message
    context_parts = []
    if context.get('monthlyIncome'):
        context_parts.append(f"Monthly Income: ₹{context['monthlyIncome']:,.0f}")
    if context.get('monthlyExpenses'):
        context_parts.append(f"Monthly Expenses: ₹{context['monthlyExpenses']:,.0f}")
    if context.get('recentTransactions'):
        txns = context['recentTransactions'][:5]
        txn_text = "\n".join([f"  - {t.get('category','')}: ₹{t.get('amount',0):,.0f} ({t.get('merchant','')})" for t in txns])
        context_parts.append(f"Recent Transactions:\n{txn_text}")
    
    context_str = "\n".join(context_parts) if context_parts else "No financial data available yet."
    
    full_prompt = f"User's Financial Context:\n{context_str}\n\nUser's Question: {message}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": "qwen3:8b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": full_prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 500},
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("message", {}).get("content", "")
                # Strip thinking tags if present (Qwen3 quirk)
                content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
                return content
            else:
                return generate_fallback_response(message, context)
    
    except Exception as e:
        print(f"[LLM] Ollama error: {e}")
        return generate_fallback_response(message, context)


def generate_fallback_response(message: str, context: dict) -> str:
    """Generate a helpful response when Ollama is not available."""
    msg = message.lower()
    income = context.get('monthlyIncome', 0)
    expenses = context.get('monthlyExpenses', 0)
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0
    
    if any(w in msg for w in ['spend', 'expense', 'spent']):
        return f"""📊 **Your Spending Summary**

This month:
• Income: ₹{income:,.0f}
• Expenses: ₹{expenses:,.0f}
• Savings: ₹{savings:,.0f} ({savings_rate:.1f}%)

{"✅ You're saving well! Keep maintaining this rate." if savings_rate > 20 else "⚠️ Your savings rate is below 20%. Consider reviewing non-essential expenses."}

**Tip:** The 50/30/20 rule suggests: 50% needs, 30% wants, 20% savings."""
    
    if any(w in msg for w in ['invest', 'portfolio', 'sip', 'mutual fund']):
        monthly_invest = max(savings * 0.6, 0)
        ten_year = monthly_invest * 12 * 20  # Simplified 12% CAGR approximation
        return f"""📈 **Investment Recommendation**

Based on your savings of ₹{savings:,.0f}/month:

1. **Emergency Fund** (Priority 1): Keep ₹{expenses * 6:,.0f} (6 months expenses) in a savings account
2. **SIP in Index Funds**: ₹{monthly_invest * 0.5:,.0f}/month in Nifty 50 Index Fund
3. **PPF/NPS**: ₹{monthly_invest * 0.3:,.0f}/month for tax savings + long-term growth
4. **Gold ETF**: ₹{monthly_invest * 0.2:,.0f}/month for diversification

Projected value in 10 years (at ~12% CAGR): ~₹{ten_year:,.0f}

⚠️ This is not financial advice. Consult a SEBI-registered advisor."""
    
    if any(w in msg for w in ['save', 'saving', 'budget', 'cut']):
        return f"""💰 **Savings Tips**

Your current savings rate: {savings_rate:.1f}%

Here's how to improve:
1. **Track every expense** — Use FinPilot's expense tracker daily
2. **Set a monthly budget** — Aim for expenses under ₹{income * 0.7:,.0f}
3. **Automate savings** — Set up auto-debit on salary day
4. **Review subscriptions** — Cancel unused services
5. **Meal prep** — Reduce food delivery spending

🎯 Target: Save at least 20% of income (₹{income * 0.2:,.0f}/month)"""
    
    return f"""👋 I'm your FinPilot AI financial advisor!

I can help you with:
• 📊 **Spending analysis** — "How much did I spend this month?"
• 💰 **Saving strategies** — "How can I save more?"
• 📈 **Investment advice** — "Where should I invest ₹5000/month?"
• 🎯 **Budget planning** — "Create a budget for me"
• 📉 **Expense optimization** — "Where am I overspending?"

Your current stats: Income ₹{income:,.0f} | Expenses ₹{expenses:,.0f} | Savings ₹{savings:,.0f}

Ask me anything about your finances!"""


# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
async def health():
    ocr_status = "loaded" if _ocr_engine else "not loaded"
    return {"status": "ok", "service": "FinPilot AI", "ocr": ocr_status}


@app.post("/api/scan-receipt")
async def scan_receipt(file: UploadFile = File(...)):
    """Scan a receipt image and extract structured data."""
    allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if file.content_type not in allowed:
        raise HTTPException(400, "Only JPEG, PNG, WebP, and PDF files are supported")
    
    # Save temp file
    suffix = os.path.splitext(file.filename)[1] or '.jpg'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Extract text
        text = extract_text_from_image(tmp_path)
        
        if not text.strip():
            return {
                "merchant": "",
                "date": datetime.now().strftime('%Y-%m-%d'),
                "amount": 0,
                "items": [],
                "category": "other",
                "gst": 0,
                "confidence": 0,
                "raw_text": "No text detected in image. Please fill in manually.",
            }
        
        # Parse extracted text
        result = parse_receipt_text(text)
        return result
    
    finally:
        os.unlink(tmp_path)


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat with AI financial advisor."""
    response = await chat_with_llm(request.message, request.context)
    return {"response": response}


@app.post("/api/analyze-transaction")
async def analyze_transaction(request: TransactionAnalysis):
    """Analyze a transaction and return insights."""
    txn = request.transaction
    amount = txn.get('amount', 0)
    category = txn.get('category', 'other')
    
    insights = []
    
    if category in ['food', 'entertainment', 'shopping'] and amount > 2000:
        insights.append(f"High {category} expense of ₹{amount:,.0f}. Consider if this is within your budget.")
    
    if category == 'subscriptions':
        insights.append("Subscription detected. Review all active subscriptions quarterly to avoid waste.")
    
    return {
        "category": category,
        "insights": insights,
        "score_impact": -2 if amount > 5000 and category != 'investments' else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
