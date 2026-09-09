const env = require('../config/env');
const logger = require('../config/logger');

const AI_TIMEOUT_MS = 30000;

function serviceHeaders(extra = {}) {
  const headers = { ...extra };
  if (env.aiServiceKey) {
    headers['X-Ai-Service-Key'] = env.aiServiceKey;
  }
  return headers;
}

/**
 * Thin boundary around the FastAPI AI service.
 * The core application must work even when this service is unavailable —
 * every caller falls back to deterministic local behaviour on failure.
 */
const aiService = {
  async chat(message, userId, context = {}) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const response = await fetch(`${env.aiServiceUrl}/api/chat`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message, userId, context }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }
      const data = await response.json();
      return data.response || '';
    } catch (error) {
      logger.warn({ error: error.message }, 'AI service chat unavailable');
      throw error;
    }
  },

  async analyzeTransaction(transaction, userId) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const response = await fetch(`${env.aiServiceUrl}/api/analyze-transaction`, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ transaction, userId }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.warn({ error: error.message }, 'AI service analyze unavailable');
      return { category: transaction.category, insights: [], score_impact: 0 };
    }
  },

  async scanReceipt(fileBuffer, mimetype, originalname) {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimetype });
      formData.append('file', blob, originalname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const response = await fetch(`${env.aiServiceUrl}/api/scan-receipt`, {
        method: 'POST',
        headers: serviceHeaders(),
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.warn({ error: error.message }, 'AI service scan unavailable');
      throw error;
    }
  },

  /**
   * Deterministic fallback chat reply — never calls any external service.
   * Uses only the provided numeric context, so it is safe offline.
   * Every projection states its assumptions explicitly and is labelled
   * illustrative; no return figure is presented as guaranteed.
   */
  fallbackChat(message, context = {}) {
    const msg = String(message || '').toLowerCase();
    const income = context.monthlyIncome || 0;
    const expenses = context.monthlyExpenses || 0;
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    if (msg.includes('spend') || msg.includes('expense')) {
      return `📊 **Spending summary**

This month you've spent ₹${expenses.toLocaleString('en-IN')} so far. Your income is ₹${income.toLocaleString('en-IN')}, giving you a savings rate of ${savingsRate.toFixed(1)}%. ${
        savingsRate < 20
          ? 'Consider cutting back on non-essential expenses to improve your savings.'
          : 'Great job maintaining a healthy savings rate!'
      }

*These are based only on the transaction data you have recorded in FinPilot.*`;
    }
    if (msg.includes('save') || msg.includes('saving')) {
      if (savings > 0) {
        const assumedRate = 0.10;
        const monthly = savings;
        const years = 10;
        const periods = years * 12;
        const projected = monthly * ((Math.pow(1 + assumedRate / 12, periods) - 1) / (assumedRate / 12));
        return `💰 **Saving plan**

You're saving ₹${Math.max(savings, 0).toLocaleString('en-IN')}/month (${savingsRate.toFixed(1)}% of income).

Illustrative projection assuming a **${(assumedRate * 100).toFixed(0)}% annual return, compounded monthly**, with ₹${monthly.toLocaleString('en-IN')} contributed monthly for **${years} years**: approximately **₹${Math.round(projected).toLocaleString('en-IN')}**. This is an illustration, not a guarantee — actual returns vary with market conditions.

Your savings rate itself is computed purely from your recorded data.`;
      }
      return `💰 **Saving tips**

Your spending currently equals or exceeds your income. To start saving:
1. Track every expense in FinPilot for a week.
2. Set a monthly budget.
3. Review subscriptions and non-essential spending.

Want me to help you create a budget once you have more data recorded?`;
    }
    if (msg.includes('invest')) {
      return `📈 **Investment considerations**

Based on your current savings of ₹${Math.max(savings, 0).toLocaleString('en-IN')}/month, common guidelines include:

1. **Emergency Fund** — aim to keep 3–6 months of expenses (₹${Math.round(Math.max(expenses, 0) * 6).toLocaleString('en-IN')}) in a liquid, low-risk account.
2. **Index funds / SIPs** — regular contributions into broad-market index funds.
3. **Tax-advantaged options** — e.g. PPF/NPS for long-term goals.

This is **educational information, not personalized financial advice**. Return assumptions are never guaranteed. For advice tailored to your full situation, consider consulting a SEBI-registered advisor.`;
    }
    return `I'm your FinPilot AI assistant. I can help you with:

• **Spending analysis** — "How much did I spend this month?"
• **Savings tips** — "How can I save more?"
• **Investment considerations** — "Where should I invest?"
• **Budget planning** — "Help me create a budget"

What would you like to know?`;
  },
};

module.exports = aiService;