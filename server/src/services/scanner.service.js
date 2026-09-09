const Transaction = require('../models/transaction.model');
const aiService = require('./ai.service');
const receiptStorage = require('./receiptStorage.service');
const ApiError = require('../utils/errors');

const EMPTY_EXTRACTION = {
  merchant: '',
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  items: [],
  category: 'other',
  gst: 0,
  confidence: 0,
  raw_text: 'AI service unavailable — please fill in manually.',
};

const scannerService = {
  async upload(file) {
    if (!file || !file.buffer) {
      throw ApiError.badRequest('No file uploaded');
    }

    // Persist the receipt to durable object storage (or local disk in dev).
    let storage;
    try {
      storage = await receiptStorage.save(file.buffer, file.originalname);
    } catch (error) {
      if (error.isOperational) throw error;
      throw ApiError.serviceUnavailable('Receipt storage is unavailable.');
    }

    let extracted = EMPTY_EXTRACTION;
    let aiError = null;
    try {
      const result = await aiService.scanReceipt(file.buffer, file.mimetype, file.originalname);
      extracted = {
        merchant: result.merchant || '',
        date: result.date || new Date().toISOString().split('T')[0],
        amount: result.amount || 0,
        items: Array.isArray(result.items) ? result.items : [],
        category: result.category || 'other',
        gst: result.gst || 0,
        confidence: result.confidence ?? 0,
        raw_text: result.raw_text || '',
      };
    } catch (error) {
      // AI unavailable — return empty extraction so the user can fill in manually.
      // We never fake OCR results.
      aiError = error;
    }

    return {
      file: { url: storage.url, key: storage.key, name: file.originalname, size: file.size },
      extracted,
      aiUnavailable: !!aiError,
    };
  },

  async confirm(userId, body) {
    const amount = Number(body.amount);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      throw ApiError.badRequest('Amount must be greater than zero.');
    }
    if (!body.category) {
      throw ApiError.badRequest('Category is required.');
    }

    const transaction = await Transaction.create({
      userId,
      type: 'expense',
      amount: Math.round(amount * 100) / 100,
      category: body.category,
      merchant: body.merchant || '',
      description: body.description || 'Scanned receipt',
      date: body.date ? new Date(body.date) : new Date(),
      receiptUrl: body.receiptUrl || '',
      receiptStorageKey: body.receiptKey || '',
      aiCategorized: true,
    });

    return transaction.toJSON();
  },
};

module.exports = scannerService;