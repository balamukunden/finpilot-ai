const { z } = require('zod');
const { TRANSACTION_CATEGORIES, PAYMENT_METHODS } = require('../models/transaction.model');

const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: 'Type is required (income or expense)' }),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero')
    .max(100000000, 'Amount is unreasonably large'),
  category: z.enum(TRANSACTION_CATEGORIES, { required_error: 'Category is required' }),
  merchant: z.string().trim().max(100, 'Merchant name too long').optional().default(''),
  description: z.string().trim().max(500, 'Description too long').optional().default(''),
  notes: z.string().trim().max(1000, 'Notes too long').optional().default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default(''),
  date: z
    .string({ invalid_type_error: 'Date must be a valid date string' })
    .optional()
    .transform((val) => (val ? new Date(val) : new Date()))
    .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date'),
  tags: z.array(z.string().trim().max(30)).max(10).optional().default([]),
  isRecurring: z.boolean().optional().default(false),
  receiptUrl: z.string().trim().max(1000).optional().default(''),
});

const updateTransactionSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero')
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
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), 'Invalid date'),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  isRecurring: z.boolean().optional(),
  receiptUrl: z.string().trim().max(1000).optional(),
});

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
};