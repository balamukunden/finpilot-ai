const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SERVER_ROOT = path.resolve(__dirname, '..');

function runEnvCheck(overrides = {}) {
  return spawnSync(process.execPath, ['-e', "require('./src/config/env'); console.log('ENV-OK')"], {
    cwd: SERVER_ROOT,
    env: { ...process.env, NODE_ENV: 'production', ...overrides },
    encoding: 'utf8',
  });
}

const STRONG_SECRET = '72f0c97e6b4f1d8a3c5e9b2d7f1a4c8e6b3d9f2a7c4e1b8d5f3a9c2e6b4d1f8';

after(() => {
  delete require.cache[require.resolve('../api/index')];
});

test('Vercel entry point exports a callable async handler', () => {
  const handler = require('../api/index');
  assert.equal(typeof handler, 'function');
  assert.equal(handler.constructor.name, 'AsyncFunction');
});

test('production config requires JWT_SECRET and JWT_REFRESH_SECRET', () => {
  // MONGODB_URI is set so that the first failure reported is the missing JWT secret.
  const result = runEnvCheck({ MONGODB_URI: 'mongodb://example/finpilot' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT_SECRET.*required in production/);
});

test('production config rejects secure-looking placeholder secrets', () => {
  const result = runEnvCheck({
    MONGODB_URI: 'mongodb://example/finpilot',
    JWT_SECRET: 'change-me-in-production',
    JWT_REFRESH_SECRET: STRONG_SECRET,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT_SECRET.*strong, unique secret/);
});

test('production config loads cleanly with real secrets', () => {
  const result = runEnvCheck({
    MONGODB_URI: 'mongodb://example/finpilot',
    JWT_SECRET: STRONG_SECRET,
    JWT_REFRESH_SECRET: STRONG_SECRET + 'x',
  });

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('ENV-OK'));
});