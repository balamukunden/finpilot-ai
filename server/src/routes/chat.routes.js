const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ChatMessage = require('../models/ChatMessage');
const axios = require('axios');
const env = require('../config/env');
const Transaction = require('../models/Transaction');

// GET /api/chat/history
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const messages = await ChatMessage.find({ userId: req.userId }).sort('createdAt').limit(100);
  ApiResponse.ok({ messages }).send(res);
}));

// POST /api/chat/send
router.post('/send', authenticate, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

  // Save user message
  const userMsg = await ChatMessage.create({ userId: req.userId, role: 'user', content: message });

  // Get financial context for AI
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const transactions = await Transaction.find({
    userId: req.userId,
    date: { $gte: startOfMonth },
  }).sort('-date').limit(20);

  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  let aiResponse = '';
  try {
    const aiResult = await axios.post(`${env.aiServiceUrl}/api/chat`, {
      message,
      userId: req.userId.toString(),
      context: {
        monthlyIncome: totalIncome,
        monthlyExpenses: totalExpenses,
        recentTransactions: transactions.slice(0, 10).map(t => ({
          type: t.type, amount: t.amount, category: t.category, merchant: t.merchant, date: t.date,
        })),
      },
    }, { timeout: 30000 });
    aiResponse = aiResult.data.response || 'I apologize, I could not process that request.';
  } catch {
    // Fallback response if AI service is down
    aiResponse = generateFallbackResponse(message, { totalExpenses, totalIncome, transactions });
  }

  // Save assistant message
  const assistantMsg = await ChatMessage.create({ userId: req.userId, role: 'assistant', content: aiResponse });

  ApiResponse.ok({ userMessage: userMsg, assistantMessage: assistantMsg }).send(res);
}));

// DELETE /api/chat/clear
router.delete('/clear', authenticate, asyncHandler(async (req, res) => {
  await ChatMessage.deleteMany({ userId: req.userId });
  ApiResponse.ok(null, 'Chat history cleared').send(res);
}));

/**
 * Fallback response when AI service is unavailable.
 */
function generateFallbackResponse(message, { totalExpenses, totalIncome, transactions }) {
  const lowerMsg = message.toLowerCase();
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0;

  if (lowerMsg.includes('spend') || lowerMsg.includes('expense')) {
    return `📊 This month, you've spent ₹${totalExpenses.toLocaleString('en-IN')} so far. Your income is ₹${totalIncome.toLocaleString('en-IN')}, giving you a savings rate of ${savingsRate}%. ${parseFloat(savingsRate) < 20 ? 'Consider cutting back on non-essential expenses to improve your savings.' : 'Great job maintaining a healthy savings rate!'}`;
  }
  if (lowerMsg.includes('save') || lowerMsg.includes('saving')) {
    const monthlySavings = totalIncome - totalExpenses;
    return `💰 You're saving ₹${monthlySavings.toLocaleString('en-IN')} this month (${savingsRate}% of income). ${monthlySavings > 0 ? `If you invest this monthly at 12% annual returns, you'll have approximately ₹${Math.round(monthlySavings * 12 * Math.pow(1.01, 120)).toLocaleString('en-IN')} in 10 years!` : 'Try to reduce spending to start saving.'}`;
  }
  if (lowerMsg.includes('invest')) {
    return `📈 Based on your savings of ₹${(totalIncome - totalExpenses).toLocaleString('en-IN')}/month, I'd recommend:\n\n1. **Emergency Fund**: Keep 6 months of expenses (₹${(totalExpenses * 6).toLocaleString('en-IN')}) in a high-yield savings account\n2. **Index Funds**: Invest through SIPs in Nifty 50 index funds\n3. **PPF**: Consider ₹500/month in PPF for tax-free returns\n\nAlways diversify and invest only what you can afford to lose.`;
  }
  return `I'm your FinPilot AI assistant. I can help you with:\n\n• **Spending analysis** — "How much did I spend this month?"\n• **Savings tips** — "How can I save more?"\n• **Investment advice** — "Where should I invest?"\n• **Budget planning** — "Help me create a budget"\n\nWhat would you like to know?`;
}

module.exports = router;
