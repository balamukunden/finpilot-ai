const multer = require('multer');
const env = require('../config/env');

const ALLOWED_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
]);

/**
 * Receipt upload middleware.
 * Uses memory storage (works on Vercel serverless where the filesystem is
 * ephemeral/read-only). MIME type and extension are validated against an
 * explicit allowlist; the AI service re-validates independently.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize, files: 1 },
  fileFilter(req, file, cb) {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedMime = ALLOWED_TYPES.get(ext);
    const mimeOk = file.mimetype && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype);
    if (allowedMime === file.mimetype || mimeOk) return cb(null, true);
    return cb(new Error('Only images (JPEG, PNG, WebP) and PDF files are allowed'));
  },
});

module.exports = upload;