const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const SERVER_ROOT = path.resolve(__dirname, '..');

// Run env.js in a child process from an ISOLATED cwd that contains no .env
// file. dotenv resolves .env from process.cwd(), so developer-local secrets
// can never silently satisfy the production-required checks. The env.js
// module is loaded by absolute path to stay independent of cwd.
function runEnvCheck(overrides = {}) {
  const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'finpilot-env-test-'));
  // Never inherit JWT secrets from the parent shell for determinism — strip
  // them BEFORE applying overrides so test-supplied secrets are preserved.
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.JWT_SECRET;
  delete env.JWT_REFRESH_SECRET;
  if (overrides) Object.assign(env, overrides);
  try {
    return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(SERVER_ROOT, 'src/config/env.js'))}); console.log('ENV-OK')`], {
      cwd: isolatedCwd,
      env,
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(isolatedCwd, { recursive: true, force: true });
  }
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