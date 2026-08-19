const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const validate = require('../middleware/validate');
const { createGoalSchema } = require('../validators/goal.validator');
const Goal = require('../models/Goal');

// GET /api/goals
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const goals = await Goal.find({ userId: req.userId }).sort('-createdAt');
  ApiResponse.ok({ goals }).send(res);
}));

// POST /api/goals
router.post('/', authenticate, validate(createGoalSchema), asyncHandler(async (req, res) => {
  const milestones = [25, 50, 75, 100].map((p) => ({ percentage: p, reached: false }));
  const goal = await Goal.create({ ...req.body, userId: req.userId, milestones });
  ApiResponse.created({ goal }, 'Goal created').send(res);
}));

// PUT /api/goals/:id — Update goal
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!goal) throw ApiError.notFound('Goal not found');
  ApiResponse.ok({ goal }, 'Goal updated').send(res);
}));

// POST /api/goals/:id/contribute — Add money to goal
router.post('/:id/contribute', authenticate, asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) throw ApiError.badRequest('Amount must be greater than 0');

  const goal = await Goal.findOne({ _id: req.params.id, userId: req.userId });
  if (!goal) throw ApiError.notFound('Goal not found');

  goal.currentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);

  // Check milestones
  const progress = (goal.currentAmount / goal.targetAmount) * 100;
  const newMilestones = [];
  goal.milestones.forEach((m) => {
    if (!m.reached && progress >= m.percentage) {
      m.reached = true;
      m.reachedAt = new Date();
      newMilestones.push(m.percentage);
    }
  });

  if (goal.currentAmount >= goal.targetAmount) {
    goal.status = 'completed';
  }

  await goal.save();
  ApiResponse.ok({ goal, newMilestones, completed: goal.status === 'completed' }, 'Contribution added').send(res);
}));

// DELETE /api/goals/:id
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!goal) throw ApiError.notFound('Goal not found');
  ApiResponse.ok(null, 'Goal deleted').send(res);
}));

module.exports = router;
