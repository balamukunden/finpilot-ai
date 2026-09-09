const User = require('../models/user.model');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const ApiError = require('../utils/errors');

const userController = {
  getMe: asyncHandler(async (req, res) => {
    return ok(res, { user: req.user.toJSON() });
  }),

  updateMe: asyncHandler(async (req, res) => {
    const allowed = ['name', 'monthlyIncome', 'monthlyBudget', 'currency', 'financialGoal', 'riskProfile'];
    const update = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true });
    if (!user) throw ApiError.notFound('User not found');
    return ok(res, { user: user.toJSON() }, 'Profile updated');
  }),
};

module.exports = userController;