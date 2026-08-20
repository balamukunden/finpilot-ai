const env = require('../config/env');
const logger = require('../config/logger');

const AI_TIMEOUT_MS = 30000;

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
        headers: { 'Content-Type': 'application/json' },
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

  async scanReceipt(fileBuffer, mimetype, originalname) {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimetype });
      formData.append('file', blob, originalname);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
      const response = await fetch(`${env.aiServiceUrl}/api/scan-receipt`, {
        method: 'POST',
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
   */
  fallbackChat(message, context = {}) {
    const msg = String(message || '').toLowerCase();
    const income = context.monthlyIncome || 0;
    const expenses = context.monthlyExpenses || 0;
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    if (msg.includes('spend') || msg.includes('expense')) {
      return `📊 This month you've spent ₹${expenses.toLocaleString('en-IN')} so far. Your income is ₹${income.toLocaleString('en-IN')}, giving you a savings rate of ${savingsRate.toFixed(1)}%. ${
        savingsRate < 20
          ? 'Consider cutting back on non-essential expenses to improve your savings.'
          : 'Great job maintaining a healthy savings rate!'
      }`;
    }
    if (msg.includes('save') || msg.includes('saving')) {
      return `💰 You're saving ₹${Math.max(savings, 0).toLocaleString('en-IN')} this month (${savingsRate.toFixed(1)}% of income). ${
        savings > 0
          ? `Investing this monthly at ~12% annual returns could grow to roughly ₹${Math.round(
              savings * 12 * Math.pow(1.01, 120)
            ).toLocaleString('en-IN')} in 10 years.`
          : 'Try to reduce spending to start saving.'
      }`;
    }
    if (msg.includes('invest')) {
      return `📈 Based on your savings of ₹${Math.max(savings, 0).toLocaleString('en-IN')}/month, I'd recommend:\n\n1. **Emergency Fund**: keep 6 months of expenses (₹${Math.round(
        expenses * 6
      ).toLocaleString('en-IN')}) in a high-yield savings account\n2. **Index Funds**: invest through SIPs in Nifty 50 index funds\n3. **PPF**: consider PPF for tax-free returns\n\nAlways diversify and invest only what you can afford to lose.`;
    }
    return `I'm your FinPilot AI assistant. I can help you with:\n\n• **Spending analysis** — "How much did I spend this month?"\n• **Savings tips** — "How can I save more?"\n• **Investment advice** — "Where should I invest?"\n• **Budget planning** — "Help me create a budget"\n\nWhat would you like to know?`;
  },
};

module.exports = aiService;