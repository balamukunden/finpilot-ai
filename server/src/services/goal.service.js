const Goal = require('../models/goal.model');
const ApiError = require('../utils/errors');

function buildMilestones() {
  return [25, 50, 75, 100].map((percentage) => ({ percentage, reached: false }));
}

function evaluateMilestones(goal, progress) {
  const reachedNow = [];
  goal.milestones.forEach((m) => {
    if (!m.reached && progress >= m.percentage) {
      m.reached = true;
      m.reachedAt = new Date();
      reachedNow.push(m.percentage);
    }
  });
  return reachedNow;
}

const goalService = {
  async create(userId, body) {
    const goal = await Goal.create({
      ...body,
      userId,
      milestones: buildMilestones(),
    });
    return goal.toJSON();
  },

  async list(userId) {
    const goals = await Goal.find({ userId }).sort('-createdAt');
    return goals.map((g) => g.toJSON());
  },

  async get(userId, id) {
    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) throw ApiError.notFound('Goal not found');
    return goal.toJSON();
  },

  async update(userId, id, body) {
    const allowed = [
      'name', 'type', 'icon', 'targetAmount', 'currentAmount',
      'deadline', 'status', 'color', 'description', 'notes',
    ];
    const update = {};
    allowed.forEach((field) => {
      if (body[field] !== undefined) update[field] = body[field];
    });

    const goal = await Goal.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!goal) throw ApiError.notFound('Goal not found');

    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
      await goal.save();
    }

    return goal.toJSON();
  },

  async remove(userId, id) {
    const goal = await Goal.findOneAndDelete({ _id: id, userId });
    if (!goal) throw ApiError.notFound('Goal not found');
    return goal.toJSON();
  },

  async contribute(userId, id, amount) {
    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) throw ApiError.notFound('Goal not found');
    if (goal.status === 'completed') throw ApiError.badRequest('This goal is already completed.');

    goal.currentAmount = Math.min(goal.currentAmount + amount, goal.targetAmount);

    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const newMilestones = evaluateMilestones(goal, progress);

    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
    }

    await goal.save();

    return {
      goal: goal.toJSON(),
      newMilestones,
      completed: goal.status === 'completed',
    };
  },
};

module.exports = goalService;