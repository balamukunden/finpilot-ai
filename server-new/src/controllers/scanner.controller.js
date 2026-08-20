const scannerService = require('../services/scanner.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

const scannerController = {
  upload: asyncHandler(async (req, res) => {
    const result = await scannerService.upload(req.file);
    return ok(res, result, 'Receipt scanned successfully');
  }),

  confirm: asyncHandler(async (req, res) => {
    const transaction = await scannerService.confirm(req.userId, req.body);
    return created(res, { transaction }, 'Transaction created from receipt');
  }),
};

module.exports = scannerController;