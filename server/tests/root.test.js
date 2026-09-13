const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

// NOTE: This test intentionally does NOT start a test database. The root
// service-info route must respond without MongoDB being available.
const app = require('../src/app');

test('GET / returns 200 service info without database', async () => {
  const res = await request(app).get('/');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.service, 'FinPilot API');
  assert.equal(res.body.status, 'online');
  assert.equal(typeof res.body.version, 'string');
  assert.equal(res.body.health, '/api/health');

  const body = JSON.stringify(res.body);
  assert.doesNotMatch(body, /mongodb|mongodb\+srv|secret|password|token|key/i);
});

test('GET / does not leak internal configuration', async () => {
  const res = await request(app).get('/');
  const keys = Object.keys(res.body);
  for (const k of keys) {
    assert.ok(
      !/^(mongoUri|jwt|redis|aiService|storage|secret|password|token|key|cookie)$/i.test(k),
      `unexpected internal key leaked: ${k}`
    );
  }
});