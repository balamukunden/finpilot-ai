const multer = require('multer');
const env = require('../config/env');

const ALLOWED_EXT = /jpeg|jpg|png|webp|pdf/;

/**
 * Receipt upload middleware.
 * Uses memory storage (works on Vercel serverless where the filesystem is
 * ephemeral/read-only). In local development the service may additionally
 * persist the buffer to disk to serve a usable file URL.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize, files: 1 },
  fileFilter(req, file, cb) {
    const extMatches = ALLOWED_EXT.test(file.originalname.split('.').pop().toLowerCase());
    const mimeMatches = ALLOWED_EXT.test(file.mimetype || '');
    if (extMatches && mimeMatches) return cb(null, true);
    return cb(new Error('Only images (JPEG, PNG, WebP) and PDF files are allowed'));
  },
});

module.exports = upload;