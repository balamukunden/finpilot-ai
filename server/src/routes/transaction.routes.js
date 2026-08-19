const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const Transaction = require('../models/Transaction');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTransactionSchema, updateTransactionSchema, listTransactionsSchema } = require('../validators/transaction.validator');
const mongoose = require('mongoose');

/**
 * Create a transaction (income or expense).
 * Body is validated with Zod and the userId is injected from auth middleware.
 */
router.post(
  '/',
  authenticate,
  validate(createTransactionSchema),
  asyncHandler(async (req, res) => {
    const transaction = await Transaction.create({
      ...req.body,
      userId: req.userId,
    });
    ApiResponse.created(transaction).send(res);
  })
);

/**
 * Update a transaction – whitelist only allowed fields to prevent mass assignment.
 */
router.put(
  '/:id',
  authenticate,
  validate(updateTransactionSchema),
  asyncHandler(async (req, res) => {
    const allowedFields = [
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
    const update = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: update },
      { new: true }
    ).lean();
    if (!transaction) return ApiResponse.notFound('Transaction not found').send(res);
    ApiResponse.ok(transaction).send(res);
  })
);

/**
 * Delete a transaction.
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!transaction) return ApiResponse.notFound('Transaction not found').send(res);
    ApiResponse.noContent().send(res);
  })
);

/**
 * Get a single transaction – lean for performance.
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!transaction) return ApiResponse.notFound('Transaction not found').send(res);
    ApiResponse.ok(transaction).send(res);
  })
);

/**
 * List transactions with optional filters, pagination, sorting, and search.
 */
router.get(
  '/',
  authenticate,
  validate(listTransactionsSchema),
  asyncHandler(async (req, res) => {
    const { type, category, search, startDate, endDate, page = 1, limit = 20, sort = '-date' } = req.query;
    const match = { userId: req.userId };
    if (type) match.type = type;
    if (category) match.category = category;
    if (search) {
      const regex = new RegExp(search, 'i');
      match.$or = [{ merchant: regex }, { description: regex }, { notes: regex }];
    }
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    const total = await Transaction.countDocuments(match);
    const transactions = await Transaction.find(match)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    ApiResponse.ok({ transactions, total, page: parseInt(page) }).send(res);
  })
);

/**
 * Summary statistics – placed BEFORE the '/:id' route to be reachable.
 */
router.get(
  '/stats/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const match = { userId: req.userId };
    const [incomeAgg, expenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...match, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...match, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    ApiResponse.ok({ totalIncome, totalExpense, netProfit, profitMargin }).send(res);
  })
);

module.exports = router;
