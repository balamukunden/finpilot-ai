const mongoose = require('mongoose');

const TRANSACTION_CATEGORIES = [
  'food', 'groceries', 'transport', 'entertainment', 'shopping',
  'utilities', 'rent', 'health', 'education', 'travel',
  'subscriptions', 'insurance', 'investments', 'salary',
  'freelance', 'gifts', 'other',
];

const PAYMENT_METHODS = ['cash', 'upi', 'credit-card', 'debit-card', 'net-banking', 'wallet', 'other', ''];

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
      max: [100000000, 'Amount is unreasonably large'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: TRANSACTION_CATEGORIES,
    },
    merchant: { type: String, trim: true, default: '', maxlength: 100 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: '' },
    date: { type: Date, default: Date.now, index: true },
    receiptUrl: { type: String, default: '', maxlength: 1000 },
    receiptStorageKey: { type: String, default: '' },
    isRecurring: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    aiCategorized: { type: Boolean, default: false },
    aiConfidence: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
      },
    },
  }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TRANSACTION_CATEGORIES = TRANSACTION_CATEGORIES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;