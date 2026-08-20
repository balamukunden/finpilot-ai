const goalService = require('../services/goal.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

const goalController = {
  create: asyncHandler(async (req, res) => {
    const goal = await goalService.create(req.userId, req.body);
    return created(res, { goal }, 'Goal created');
  }),

  list: asyncHandler(async (req, res) => {
    const goals = await goalService.list(req.userId);
    return ok(res, { goals });
  }),

  get: asyncHandler(async (req, res) => {
    const goal = await goalService.get(req.userId, req.params.id);
    return ok(res, { goal });
  }),

  update: asyncHandler(async (req, res) => {
    const goal = await goalService.update(req.userId, req.params.id, req.body);
    return ok(res, { goal }, 'Goal updated');
  }),

  remove: asyncHandler(async (req, res) => {
    await goalService.remove(req.userId, req.params.id);
    return ok(res, null, 'Goal deleted');
  }),

  contribute: asyncHandler(async (req, res) => {
    const result = await goalService.contribute(req.userId, req.params.id, req.body.amount);
    return ok(res, result, 'Contribution added');
  }),
};

module.exports = goalController;