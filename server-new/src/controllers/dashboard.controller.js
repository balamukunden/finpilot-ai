const dashboardService = require('../services/dashboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const dashboardController = {
  get: asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboard(req.userId);
    return ok(res, data);
  }),
};

module.exports = dashboardController;