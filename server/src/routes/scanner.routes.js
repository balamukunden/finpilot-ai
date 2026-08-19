const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Transaction = require('../models/Transaction');
const axios = require('axios');
const env = require('../config/env');

// Multer config for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images (JPEG, PNG, WebP) and PDF files are allowed'));
  },
});

/**
 * POST /api/scanner/upload — Upload receipt for OCR scanning
 */
router.post(
  '/upload',
  authenticate,
  uploadLimiter,
  upload.single('receipt'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');

    const filePath = req.file.path;
    const fileUrl = `/uploads/${req.file.filename}`;

    let extractedData = null;

    try {
      // Send to AI service for OCR processing
      const formData = new FormData();
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: req.file.mimetype });
      formData.append('file', blob, req.file.originalname);

      const aiResult = await axios.post(`${env.aiServiceUrl}/api/scan-receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      extractedData = aiResult.data;
    } catch {
      // Fallback: return empty extraction if AI service is down
      extractedData = {
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        items: [],
        category: 'other',
        gst: 0,
        confidence: 0,
        raw_text: 'AI service unavailable — please fill in manually.',
      };
    }

    ApiResponse.ok({
      file: { url: fileUrl, name: req.file.originalname, size: req.file.size },
      extracted: extractedData,
    }, 'Receipt scanned successfully').send(res);
  })
);

/**
 * POST /api/scanner/confirm — Confirm scanned data and create transaction
 */
router.post(
  '/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const { amount, category, merchant, description, date, receiptUrl } = req.body;
    if (!amount || !category) throw ApiError.badRequest('Amount and category are required');

    const transaction = await Transaction.create({
      userId: req.userId,
      type: 'expense',
      amount: parseFloat(amount),
      category,
      merchant: merchant || '',
      description: description || 'Scanned receipt',
      date: date ? new Date(date) : new Date(),
      receiptUrl: receiptUrl || '',
      aiCategorized: true,
    });

    ApiResponse.created({ transaction }, 'Transaction created from receipt').send(res);
  })
);

module.exports = router;
