const ChatMessage = require('../models/chatMessage.model');
const Transaction = require('../models/transaction.model');
const aiService = require('./ai.service');
const ApiError = require('../utils/errors');

const chatService = {
  async getHistory(userId) {
    const messages = await ChatMessage.find({ userId }).sort('createdAt').limit(100);
    return messages.map((m) => m.toJSON());
  },

  /**
   * Build the financial context the AI service expects.
   * If the AI is unreachable, the fallback reply still uses this data.
   */
  async buildContext(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const transactions = await Transaction.find({ userId, date: { $gte: startOfMonth } })
      .sort('-date')
      .limit(20);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      monthlyIncome: totalIncome,
      monthlyExpenses: totalExpenses,
      recentTransactions: transactions.slice(0, 10).map((t) => ({
        type: t.type,
        amount: t.amount,
        category: t.category,
        merchant: t.merchant,
        date: t.date,
      })),
    };
  },

  async send(userId, message) {
    if (!message || !message.trim()) {
      throw ApiError.badRequest('Message is required.');
    }
    const text = message.trim();

    const userMessage = await ChatMessage.create({ userId, role: 'user', content: text });

    const context = await this.buildContext(userId);

    let aiResponse;
    try {
      aiResponse = await aiService.chat(text, userId.toString(), context);
    } catch {
      // AI unavailable — the core app must keep working.
      aiResponse = aiService.fallbackChat(text, context);
    }

    const assistantMessage = await ChatMessage.create({
      userId,
      role: 'assistant',
      content: aiResponse || 'AI service is temporarily unavailable.',
    });

    return {
      userMessage: userMessage.toJSON(),
      assistantMessage: assistantMessage.toJSON(),
    };
  },

  async clear(userId) {
    await ChatMessage.deleteMany({ userId });
  },
};

module.exports = chatService;