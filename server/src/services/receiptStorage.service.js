const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/errors');

let s3Client = null;

function getS3() {
  if (s3Client) return s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  const { region, endpoint, accessKeyId, secretAccessKey } = env.storage;
  s3Client = new S3Client({
    region: region || 'auto',
    endpoint: endpoint || undefined,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return s3Client;
}

function resolvedProvider() {
  const provider = env.storage.provider;
  if (provider === 's3') return 's3';
  if (env.isProd) {
    // In production a Vercel filesystem is ephemeral and cannot be used as
    // durable object storage. Fail safely instead of pretending.
    throw ApiError.serviceUnavailable(
      'Receipt storage is not configured for production. Set RECEIPT_STORAGE_PROVIDER=s3 and the matching credentials.'
    );
  }
  return 'local';
}

/**
 * Save an uploaded receipt. Returns { key, url } where:
 *  - local:  key is the relative file name, url is the dev-serving URL
 *  - s3:     key is the object key, url is empty (private object)
 */
async function save(buffer, originalname) {
  const ext = (path.extname(originalname) || '.jpg').toLowerCase();
  const provider = resolvedProvider();
  const key = `receipts/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  if (provider === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = getS3();
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream',
      })
    );
    logger.info({ key, size: buffer.length }, 'Receipt stored in object storage');
    return { key, url: '' };
  }

  const uploadDir = path.resolve(process.cwd(), env.uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, key), buffer);
  return { key, url: `/uploads/${key}` };
}

/**
 * Resolve a signed temporary URL for a receipt object (production) or a
 * dev-only absolute path (local). The caller must have already verified that
 * the requesting user owns the resource.
 */
async function getAccessibleUrl(key) {
  if (!key) return '';
  const provider = resolvedProvider();

  if (provider === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const client = getS3();
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }), {
      expiresIn: 900,
    });
    return url;
  }

  return `/uploads/${key}`;
}

module.exports = { save, getAccessibleUrl };