const { z } = require('zod');

/**
 * Profile update validation schema.
 * Only allows safe, user-settable fields.
 */
const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters')
    .optional(),
  monthlyIncome: z
    .number({ invalid_type_error: 'Monthly income must be a number' })
    .min(0, 'Monthly income cannot be negative')
    .max(100000000, 'Income is unreasonably large')
    .optional(),
  monthlyBudget: z
    .number({ invalid_type_error: 'Monthly budget must be a number' })
    .min(0, 'Monthly budget cannot be negative')
    .max(100000000, 'Budget is unreasonably large')
    .optional(),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter code')
    .optional(),
  financialGoal: z
    .enum(['save', 'invest', 'reduce-debt', 'build-emergency', 'grow-wealth', ''])
    .optional(),
  riskProfile: z
    .enum(['conservative', 'moderate', 'aggressive', ''])
    .optional(),
});

module.exports = {
  updateProfileSchema,
};
