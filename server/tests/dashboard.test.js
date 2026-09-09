const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupTestDB, teardownTestDB, clearDB, registerUser, authHeader } = require('./helpers/testApp');
const app = require('../src/app');

let token;

// Mid-month date so monthly aggregation is stable regardless of timezone.
const midMonthDate = (() => {
  const d = new Date();
  d.setDate(15);
  return d.toISOString().split('T')[0];
})();

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDB();
  const reg = await registerUser(app);
  token = reg.body.data.accessToken;
});

test('dashboard requires authentication', async () => {
  const res = await request(app).get('/api/dashboard');
  assert.equal(res.status, 401);
});

test('dashboard returns empty defaults for a fresh user', async () => {
  const res = await request(app).get('/api/dashboard').set(authHeader(token));

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.income, 0);
  assert.equal(res.body.data.expenses, 0);
  assert.equal(res.body.data.savings, 0);
  assert.equal(typeof res.body.data.financialScore, 'number');
  assert.ok(res.body.data.financialScore >= 0 && res.body.data.financialScore <= 100);
  assert.ok(Array.isArray(res.body.data.recentTransactions));
  assert.ok(Array.isArray(res.body.data.goals));
  assert.ok(Array.isArray(res.body.data.categoryBreakdown));
  assert.ok(Array.isArray(res.body.data.trendData));
  assert.ok(Array.isArray(res.body.data.suggestions));
});

test('dashboard reports correct monthly totals', async () => {
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 100000, category: 'salary', date: midMonthDate });
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'expense', amount: 30000, category: 'food', date: midMonthDate });
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'expense', amount: 20000, category: 'rent', date: midMonthDate });

  const res = await request(app).get('/api/dashboard').set(authHeader(token));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.income, 100000);
  assert.equal(res.body.data.expenses, 50000);
  assert.equal(res.body.data.savings, 50000);
  assert.equal(res.body.data.savingsRate, 50);

  const categoryTotals = Object.fromEntries(
    res.body.data.categoryBreakdown.map((c) => [c.category, c.amount])
  );
  assert.equal(categoryTotals.food, 30000);
  assert.equal(categoryTotals.rent, 20000);

  const recent = res.body.data.recentTransactions;
  assert.equal(recent.length, 3);
  assert.ok(recent.every((t) => t.id && t.amount !== undefined && t.type !== undefined));
});

test('dashboard recent transactions exclude the userId field', async () => {
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 5000, category: 'salary', date: midMonthDate });

  const res = await request(app).get('/api/dashboard').set(authHeader(token));

  const recent = res.body.data.recentTransactions;
  assert.equal(recent.length, 1);
  assert.equal(recent[0].userId, undefined);
  assert.equal(recent[0].passwordHash, undefined);
});

test('dashboard financial score stays within 0-100 with data', async () => {
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 50000, category: 'salary', date: midMonthDate });
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'expense', amount: 10000, category: 'food', date: midMonthDate });

  const res = await request(app).get('/api/dashboard').set(authHeader(token));

  assert.equal(res.status, 200);
  assert.ok(res.body.data.financialScore >= 0 && res.body.data.financialScore <= 100);
  assert.equal(res.body.data.savingsRate, 80);
});