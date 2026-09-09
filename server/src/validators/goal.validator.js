const { z } = require('zod');
const { GOAL_TYPES } = require('../models/goal.model');

const createGoalSchema = z.object({
  name: z
    .string({ required_error: 'Goal name is required' })
    .trim()
    .min(1, 'Please enter a goal name')
    .max(100, 'Goal name must not exceed 100 characters'),
  type: z.enum(GOAL_TYPES, { required_error: 'Please select a goal type' }).default('custom'),
  targetAmount: z
    .number({ required_error: 'Target amount is required', invalid_type_error: 'Target amount must be a number' })
    .positive('Target amount must be greater than zero')
    .max(1000000000, 'Target amount is unreasonably large'),
  currentAmount: z
    .number({ invalid_type_error: 'Current savings must be a number' })
    .min(0, 'Current savings cannot be negative')
    .optional()
    .default(0),
  deadline: z
    .string({ invalid_type_error: 'Target date must be a valid date' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), 'Please select a valid target date'),
  icon: z.string().max(16).optional().default('🎯'),
  color: z.string().max(16).optional().default('#3B82F6'),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateGoalSchema = z.object({
  name: z.string().trim().min(1, 'Please enter a goal name').max(100).optional(),
  type: z.enum(GOAL_TYPES).optional(),
  targetAmount: z.number().positive('Target amount must be greater than zero').optional(),
  currentAmount: z.number().min(0, 'Current savings cannot be negative').optional(),
  deadline: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), 'Invalid target date'),
  icon: z.string().max(16).optional(),
  color: z.string().max(16).optional(),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
});

const contributeGoalSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero')
    .max(100000000, 'Amount is unreasonably large'),
});

module.exports = { createGoalSchema, updateGoalSchema, contributeGoalSchema };