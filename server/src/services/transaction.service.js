const Transaction = require('../models/transaction.model');
const ApiError = require('../utils/errors');

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

const ALLOWED_UPDATE_FIELDS = [
  'type',
  'amount',
  'category',
  'merchant',
  'description',
  'notes',
  'paymentMethod',
  'date',
  'receiptUrl',
  'isRecurring',
  'tags',
  'aiCategorized',
  'aiConfidence',
];

const transactionService = {
  async create(userId, body) {
    const transaction = await Transaction.create({
      ...body,
      userId,
      amount: roundMoney(body.amount),
    });
    return transaction.toJSON();
  },

  async list(userId, filters) {
    const {
      type,
      category,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = '-date',
    } = filters;

    const match = { userId };
    if (type) match.type = type;
    if (category) match.category = category;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [{ merchant: regex }, { description: regex }, { notes: regex }];
    }
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(match)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(match),
    ]);

    return {
      transactions: transactions.map((t) => t.toJSON()),
      total,
      page: Number(page),
    };
  },

  async get(userId, id) {
    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) throw ApiError.notFound('Transaction not found');
    return transaction.toJSON();
  },

  async update(userId, id, body) {
    const update = {};
    ALLOWED_UPDATE_FIELDS.forEach((field) => {
      if (body[field] !== undefined) update[field] = body[field];
    });
    if (update.amount !== undefined) update.amount = roundMoney(update.amount);

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!transaction) throw ApiError.notFound('Transaction not found');
    return transaction.toJSON();
  },

  async remove(userId, id) {
    const transaction = await Transaction.findOneAndDelete({ _id: id, userId });
    if (!transaction) throw ApiError.notFound('Transaction not found');
    return transaction.toJSON();
  },

  async summary(userId) {
    const [incomeAgg, expenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { userId, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { userId, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return { totalIncome, totalExpense, netProfit, profitMargin };
  },
};

module.exports = transactionService;