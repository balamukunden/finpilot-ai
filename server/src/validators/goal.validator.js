const { z } = require('zod');

const GOAL_TYPES = [
  'emergency-fund', 'vacation', 'laptop', 'bike', 'car',
  'house', 'education', 'custom',
];

/**
 * Create goal validation schema.
 */
const createGoalSchema = z.object({
  name: z
    .string({ required_error: 'Goal name is required' })
    .trim()
    .min(1, 'Goal name is required')
    .max(100, 'Goal name too long'),
  type: z.enum(GOAL_TYPES).optional().default('custom'),
  targetAmount: z
    .number({ required_error: 'Target amount is required', invalid_type_error: 'Target amount must be a number' })
    .positive('Target amount must be greater than 0')
    .max(100000000, 'Target amount is unreasonably large'),
  currentAmount: z
    .number({ invalid_type_error: 'Current savings must be a number' })
    .min(0, 'Current savings cannot be negative')
    .max(100000000, 'Current savings is unreasonably large')
    .default(0),
  deadline: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((d) => d === undefined || !isNaN(d.getTime()), 'Invalid deadline date'),
  icon: z.string().max(10).optional().default('🎯'),
  color: z.string().max(20).optional().default('#3B82F6'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional(),
}).refine((data) => data.currentAmount <= data.targetAmount, {
  message: 'Current savings cannot exceed the target amount',
  path: ['currentAmount'],
});

/**
 * Update goal validation schema (whitelist — no userId, milestones).
 */
const updateGoalSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(GOAL_TYPES).optional(),
  targetAmount: z.number().positive().max(100000000).optional(),
  currentAmount: z.number().min(0).max(100000000).optional(),
  deadline: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((d) => d === undefined || !isNaN(d.getTime()), 'Invalid deadline date'),
  icon: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  status: z.enum(['active', 'paused']).optional(),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(
  (data) =>
    data.currentAmount === undefined ||
    data.targetAmount === undefined ||
    data.currentAmount <= data.targetAmount,
  { message: 'Current savings cannot exceed the target amount', path: ['currentAmount'] }
);

/**
 * Contribute to goal validation schema.
 */
const contributeGoalSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(100000000, 'Amount is unreasonably large'),
});

module.exports = {
  createGoalSchema,
  updateGoalSchema,
  contributeGoalSchema,
};
