const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(userId) {
  return jwt.sign({ userId, jti: randomUUID() }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh', jti: randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, env.jwt.refreshSecret, { algorithms: ['HS256'] });
  if (decoded.type !== 'refresh') {
    const error = new Error('Invalid token type');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return decoded;
}

function refreshTokenExpiryMs() {
  return 7 * 24 * 60 * 60 * 1000;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokenExpiryMs,
};