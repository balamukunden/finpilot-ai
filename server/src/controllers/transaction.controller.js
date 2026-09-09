const transactionService = require('../services/transaction.service');
const receiptStorage = require('../services/receiptStorage.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

const transactionController = {
  create: asyncHandler(async (req, res) => {
    const transaction = await transactionService.create(req.userId, req.body);
    return created(res, transaction, 'Transaction created');
  }),

  list: asyncHandler(async (req, res) => {
    const result = await transactionService.list(req.userId, req.query);
    return ok(res, result);
  }),

  get: asyncHandler(async (req, res) => {
    const transaction = await transactionService.get(req.userId, req.params.id);
    return ok(res, transaction);
  }),

  update: asyncHandler(async (req, res) => {
    const transaction = await transactionService.update(req.userId, req.params.id, req.body);
    return ok(res, transaction, 'Transaction updated');
  }),

  remove: asyncHandler(async (req, res) => {
    await transactionService.remove(req.userId, req.params.id);
    return noContent(res);
  }),

  summary: asyncHandler(async (req, res) => {
    const summary = await transactionService.summary(req.userId);
    return ok(res, summary);
  }),

  receipt: asyncHandler(async (req, res) => {
    // Ownership is enforced here — a user may only access receipts on their
    // own transactions. This is the only way to obtain a receipt URL.
    const transaction = await transactionService.get(req.userId, req.params.id);
    const key = transaction.receiptStorageKey;
    if (!key) {
      return res.status(404).json({
        success: false,
        message: 'No receipt attached to this transaction.',
        error: { code: 'NOT_FOUND', message: 'No receipt attached to this transaction.' },
      });
    }
    const url = await receiptStorage.getAccessibleUrl(key);
    return ok(res, { url });
  }),
};

module.exports = transactionController;