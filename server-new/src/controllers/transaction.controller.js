const transactionService = require('../services/transaction.service');
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
};

module.exports = transactionController;