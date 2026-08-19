const { z } = require('zod');

/**
 * Valid transaction categories.
 */
const TRANSACTION_CATEGORIES = [
  'food', 'groceries', 'transport', 'entertainment', 'shopping',
  'utilities', 'rent', 'health', 'education', 'travel',
  'subscriptions', 'insurance', 'investments', 'salary',
  'freelance', 'gifts', 'other',
];

const PAYMENT_METHODS = ['cash', 'upi', 'credit-card', 'debit-card', 'net-banking', 'wallet', 'other', ''];

/**
 * Create transaction validation schema.
 */
const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: 'Type is required (income or expense)' }),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(100000000, 'Amount is unreasonably large'),
  category: z.enum(TRANSACTION_CATEGORIES, { required_error: 'Category is required' }),
  merchant: z.string().trim().max(100, 'Merchant name too long').optional().default(''),
  description: z.string().trim().max(500, 'Description too long').optional().default(''),
  notes: z.string().trim().max(1000, 'Notes too long').optional().default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default(''),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date()))
    .refine((d) => !isNaN(d.getTime()), 'Invalid date'),
  tags: z.array(z.string().trim().max(30)).max(10).optional().default([]),
  isRecurring: z.boolean().optional().default(false),
  receiptUrl: z.string().trim().max(1000).optional().default(''),
});

/**
 * Update transaction validation schema (partial — all fields optional).
 */
const updateTransactionSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(100000000, 'Amount is unreasonably large')
    .optional(),
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  merchant: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((d) => d === undefined || !isNaN(d.getTime()), 'Invalid date'),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  isRecurring: z.boolean().optional(),
  receiptUrl: z.string().trim().max(1000).optional(),
});

/**
 * List transactions query validation.
 */
const listTransactionsSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.enum(TRANSACTION_CATEGORIES).optional(),
  search: z.string().trim().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.string().optional().default('-date'),
});

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsSchema,
  TRANSACTION_CATEGORIES,
};
