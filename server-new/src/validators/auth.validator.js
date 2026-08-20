const { z } = require('zod');

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PASSWORD_STRENGTH_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

const registerSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must not exceed 50 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .regex(EMAIL_RE, 'Please enter a valid email address')
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(PASSWORD_STRENGTH_RE, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    confirmPassword: z.string({ required_error: 'Confirm password is required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .regex(EMAIL_RE, 'Please enter a valid email address')
    .toLowerCase(),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50).optional(),
  monthlyIncome: z.number().min(0, 'Monthly income cannot be negative').optional(),
  monthlyBudget: z.number().min(0, 'Monthly budget cannot be negative').optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').optional(),
  financialGoal: z.enum(['save', 'invest', 'reduce-debt', 'build-emergency', 'grow-wealth', '']).optional(),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive', '']).optional(),
});

module.exports = { registerSchema, loginSchema, refreshTokenSchema, updateProfileSchema };