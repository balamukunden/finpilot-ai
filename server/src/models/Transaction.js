const mongoose = require('mongoose');

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
      min: [0.01, 'Amount must be greater than 0'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'food', 'groceries', 'transport', 'entertainment', 'shopping',
        'utilities', 'rent', 'health', 'education', 'travel',
        'subscriptions', 'insurance', 'investments', 'salary',
        'freelance', 'gifts', 'other',
      ],
    },
    merchant: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'credit-card', 'debit-card', 'net-banking', 'wallet', 'other', ''],
      default: '',
    },
    date: { type: Date, default: Date.now, index: true },
    receiptUrl: { type: String, default: '' },
    isRecurring: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
    aiCategorized: { type: Boolean, default: false },
    aiConfidence: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1 });
transactionSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
