const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupTestDB, teardownTestDB } = require('./helpers/testApp');
const app = require('../src/app');

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

test('GET /api/health returns success without auth', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'FinPilot API is running');
  assert.equal(res.body.environment, 'test');
  assert.ok(res.body.timestamp);
});

test('GET /api/health is not rate limited', async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, () => request(app).get('/api/health'))
  );
  for (const res of results) {
    assert.equal(res.status, 200);
  }
});

test('unknown route returns structured 404', async () => {
  const res = await request(app).get('/api/nonexistent-route');

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});