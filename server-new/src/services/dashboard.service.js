const Transaction = require('../models/transaction.model');
const Goal = require('../models/goal.model');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

/**
 * Deterministic, explainable financial health score (0-100).
 * Based solely on measurable user data — no LLM dependency.
 */
function calculateFinancialScore({ income, expenses, savingsRate, expenseChange, goals, withinBudget }) {
  let score = 50; // neutral base

  if (savingsRate >= 30) score += 20;
  else if (savingsRate >= 20) score += 15;
  else if (savingsRate >= 10) score += 10;
  else if (savingsRate < 0) score -= 15;

  if (goals.length > 0) score += 5;
  if (goals.some((g) => g.progress > 50)) score += 5;

  if (expenseChange < 0) score += 10; // spending decreased vs last month
  else if (expenseChange > 20) score -= 10; // spending spiked

  if (withinBudget) score += 10;

  return Math.max(0, Math.min(100, score));
}

const dashboardService = {
  async getDashboard(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      monthlyStats,
      lastMonthStats,
      categoryBreakdown,
      recentTransactions,
      goals,
      unreadNotifications,
      monthlyTrend,
      user,
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { userId, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { userId, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),
      Transaction.find({ userId }).sort('-date').limit(8),
      Goal.find({ userId, status: 'active' }).sort('-createdAt').limit(4),
      Notification.countDocuments({ userId, isRead: false }),
      Transaction.aggregate([
        { $match: { userId, date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        {
          $group: {
            _id: { month: { $month: '$date' }, year: { $year: '$date' }, type: '$type' },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      User.findById(userId),
    ]);

    const income = monthlyStats.find((s) => s._id === 'income')?.total || 0;
    const expenses = monthlyStats.find((s) => s._id === 'expense')?.total || 0;
    const lastIncome = lastMonthStats.find((s) => s._id === 'income')?.total || 0;
    const lastExpenses = lastMonthStats.find((s) => s._id === 'expense')?.total || 0;

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
    const expenseChange = lastExpenses > 0 ? ((expenses - lastExpenses) / lastExpenses) * 100 : 0;

    const withinBudget = (user?.monthlyBudget || 0) > 0 && expenses <= user.monthlyBudget;
    const financialScore = calculateFinancialScore({
      income,
      expenses,
      savingsRate,
      expenseChange,
      goals,
      withinBudget,
    });

    const suggestions = [];
    if (savingsRate < 20) {
      suggestions.push({
        icon: '💡',
        text: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% to build wealth faster.`,
      });
    }
    if (expenseChange > 10) {
      suggestions.push({
        icon: '⚠️',
        text: `Spending is up ${expenseChange.toFixed(1)}% vs last month. Review your ${
          categoryBreakdown[0]?._id || 'top'
        } spending.`,
      });
    }
    if (goals.length === 0) {
      suggestions.push({ icon: '🎯', text: 'Set your first savings goal to start tracking your progress!' });
    }
    const topCategory = categoryBreakdown[0];
    if (topCategory) {
      suggestions.push({
        icon: '📊',
        text: `${topCategory._id} is your top expense at ₹${topCategory.total.toLocaleString('en-IN')}. Look for ways to optimize.`,
      });
    }
    if (suggestions.length === 0) {
      suggestions.push({ icon: '🌟', text: "Great job! You're maintaining healthy financial habits. Keep it up!" });
    }

    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNum = m.getMonth() + 1;
      const yearNum = m.getFullYear();
      const monthName = m.toLocaleString('default', { month: 'short' });
      const inc =
        monthlyTrend.find(
          (t) => t._id.month === monthNum && t._id.year === yearNum && t._id.type === 'income'
        )?.total || 0;
      const exp =
        monthlyTrend.find(
          (t) => t._id.month === monthNum && t._id.year === yearNum && t._id.type === 'expense'
        )?.total || 0;
      trendData.push({ month: monthName, income: inc, expenses: exp, savings: inc - exp });
    }

    return {
      financialScore,
      income,
      expenses,
      savings: income - expenses,
      savingsRate: Math.round(savingsRate * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10,
      netWorth: income - expenses,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c._id,
        amount: c.total,
        count: c.count,
      })),
      recentTransactions: recentTransactions.map((t) => t.toJSON()),
      goals: goals.map((g) => g.toJSON()),
      suggestions,
      trendData,
      unreadNotifications,
      user: user
        ? {
            name: user.name,
            level: user.level,
            xp: user.xp,
            xpForNextLevel: user.xpForNextLevel(),
          }
        : { name: 'User', level: 1, xp: 0, xpForNextLevel: 100 },
    };
  },
};

module.exports = dashboardService;