const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Notification = require('../models/Notification');
const User = require('../models/User');

// GET /api/dashboard
router.get('/', authenticate, asyncHandler(async (req, res) => {
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
  ] = await Promise.all([
    // This month income/expense
    Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    // Last month for comparison
    Transaction.aggregate([
      { $match: { userId: req.user._id, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    // Category breakdown
    Transaction.aggregate([
      { $match: { userId: req.user._id, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    // Recent transactions
    Transaction.find({ userId: req.userId }).sort('-date').limit(8),
    // Active goals
    Goal.find({ userId: req.userId, status: 'active' }).sort('-createdAt').limit(4),
    // Unread notification count
    Notification.countDocuments({ userId: req.userId, isRead: false }),
    // 6-month trend
    Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$date' }, year: { $year: '$date' }, type: '$type' },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const income = monthlyStats.find((s) => s._id === 'income')?.total || 0;
  const expenses = monthlyStats.find((s) => s._id === 'expense')?.total || 0;
  const lastIncome = lastMonthStats.find((s) => s._id === 'income')?.total || 0;
  const lastExpenses = lastMonthStats.find((s) => s._id === 'expense')?.total || 0;

  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;
  const expenseChange = lastExpenses > 0 ? ((expenses - lastExpenses) / lastExpenses) * 100 : 0;

  // Calculate financial score (0-100)
  const user = await User.findById(req.userId);
  let financialScore = 50; // Base
  if (savingsRate >= 30) financialScore += 20;
  else if (savingsRate >= 20) financialScore += 15;
  else if (savingsRate >= 10) financialScore += 10;
  else if (savingsRate < 0) financialScore -= 15;
  if (goals.length > 0) financialScore += 5;
  if (goals.some((g) => g.progress > 50)) financialScore += 5;
  if (expenseChange < 0) financialScore += 10; // Spending decreased
  if (expenseChange > 20) financialScore -= 10; // Spending spiked
  if (user.monthlyBudget > 0 && expenses <= user.monthlyBudget) financialScore += 10;
  financialScore = Math.max(0, Math.min(100, financialScore));

  // Generate AI suggestions
  const suggestions = [];
  if (savingsRate < 20) suggestions.push({ icon: '💡', text: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% to build wealth faster.` });
  if (expenseChange > 10) suggestions.push({ icon: '⚠️', text: `Spending is up ${expenseChange.toFixed(1)}% vs last month. Review your ${categoryBreakdown[0]?._id || 'top'} spending.` });
  if (goals.length === 0) suggestions.push({ icon: '🎯', text: 'Set your first savings goal to start tracking your progress!' });
  const topCategory = categoryBreakdown[0];
  if (topCategory) suggestions.push({ icon: '📊', text: `${topCategory._id} is your top expense at ₹${topCategory.total.toLocaleString('en-IN')}. Look for ways to optimize.` });
  if (suggestions.length === 0) suggestions.push({ icon: '🌟', text: 'Great job! You\'re maintaining healthy financial habits. Keep it up!' });

  // Format monthly trend for charts
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthNum = m.getMonth() + 1;
    const yearNum = m.getFullYear();
    const monthName = m.toLocaleString('default', { month: 'short' });
    const inc = monthlyTrend.find((t) => t._id.month === monthNum && t._id.year === yearNum && t._id.type === 'income')?.total || 0;
    const exp = monthlyTrend.find((t) => t._id.month === monthNum && t._id.year === yearNum && t._id.type === 'expense')?.total || 0;
    trendData.push({ month: monthName, income: inc, expenses: exp, savings: inc - exp });
  }

  ApiResponse.ok({
    financialScore,
    income,
    expenses,
    savings: income - expenses,
    savingsRate: parseFloat(savingsRate.toFixed(1)),
    expenseChange: parseFloat(expenseChange.toFixed(1)),
    netWorth: income - expenses, // Simplified
    categoryBreakdown: categoryBreakdown.map((c) => ({ category: c._id, amount: c.total, count: c.count })),
    recentTransactions,
    goals,
    suggestions,
    trendData,
    unreadNotifications,
    user: { name: user.name, level: user.level, xp: user.xp, xpForNextLevel: user.xpForNextLevel() },
  }).send(res);
}));

module.exports = router;
