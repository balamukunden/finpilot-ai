const fs = require('fs');
const path = require('path');
const Transaction = require('../models/transaction.model');
const aiService = require('./ai.service');
const ApiError = require('../utils/errors');
const env = require('../config/env');

/**
 * Persist an uploaded receipt buffer to disk (local development only).
 * On serverless (Vercel) the filesystem is not writable, so we return an
 * empty URL and rely on the file metadata only. Persistent blob storage
 * (e.g. Vercel Blob / S3) is the documented production dependency.
 */
function persistReceipt(buffer, originalname) {
  const ext = path.extname(originalname) || '.jpg';
  const uniqueName = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const uploadDir = path.resolve(process.cwd(), env.uploadDir);

  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, uniqueName), buffer);
    return `/uploads/${uniqueName}`;
  } catch (error) {
    return '';
  }
}

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

    const fileUrl = env.isProd ? '' : persistReceipt(file.buffer, file.originalname);

    let extracted = EMPTY_EXTRACTION;
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
    } catch {
      // AI unavailable — return empty extraction so the user can fill in manually.
      // We never fake OCR results.
    }

    return {
      file: { url: fileUrl, name: file.originalname, size: file.size },
      extracted,
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
      aiCategorized: true,
    });

    return transaction.toJSON();
  },
};

module.exports = scannerService;