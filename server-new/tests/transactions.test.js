const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setupTestDB, teardownTestDB, clearDB, registerUser, authHeader } = require('./helpers/testApp');

let token;

const expensePayload = {
  type: 'expense',
  amount: 450,
  category: 'food',
  merchant: 'Swiggy',
  date: new Date().toISOString().split('T')[0],
  paymentMethod: 'upi',
  description: 'Lunch',
  notes: 'team lunch',
};

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

test('creates an expense transaction', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.type, 'expense');
  assert.equal(res.body.data.amount, 450);
  assert.equal(res.body.data.category, 'food');
  assert.equal(res.body.data.merchant, 'Swiggy');
  assert.equal(res.body.data.userId, undefined);
  assert.ok(res.body.data.id);
});

test('creates an income transaction', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 85000, category: 'salary', merchant: 'Company' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.type, 'income');
  assert.equal(res.body.data.amount, 85000);
});

test('rejects unauthenticated create', async () => {
  const res = await request(app).post('/api/transactions').send(expensePayload);

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('rejects amount of zero or negative', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ ...expensePayload, amount: 0 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');

  const neg = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ ...expensePayload, amount: -10 });

  assert.equal(neg.status, 400);
});

test('rejects non-numeric amount', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ ...expensePayload, amount: 'abc' });

  assert.equal(res.status, 400);
});

test('rejects invalid category', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ ...expensePayload, category: 'not-a-category' });

  assert.equal(res.status, 400);
});

test('stores multi-digit amounts correctly and numerically', async () => {
  for (const amount of [5, 50, 500, 1250, 12500, 99999.99, 1000000]) {
    const res = await request(app)
      .post('/api/transactions')
      .set(authHeader(token))
      .send({ ...expensePayload, amount, category: 'other' });

    assert.equal(res.status, 201, `amount ${amount} should be accepted`);
    assert.equal(res.body.data.amount, amount, `amount ${amount} stored incorrectly`);
    assert.equal(typeof res.body.data.amount, 'number');
  }
});

test('stores decimal amounts with two decimal precision', async () => {
  const res = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ ...expensePayload, amount: 99.99, category: 'other' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.amount, 99.99);
});

test('lists transactions with the frontend shape', async () => {
  await request(app).post('/api/transactions').set(authHeader(token)).send(expensePayload);
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 1000, category: 'salary' });

  const res = await request(app).get('/api/transactions').set(authHeader(token));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.transactions));
  assert.equal(res.body.data.transactions.length, 2);
  assert.equal(typeof res.body.data.total, 'number');
});

test('filters transactions by type', async () => {
  await request(app).post('/api/transactions').set(authHeader(token)).send(expensePayload);
  await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send({ type: 'income', amount: 1000, category: 'salary' });

  const res = await request(app)
    .get('/api/transactions?type=expense')
    .set(authHeader(token));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.transactions.length, 1);
  assert.equal(res.body.data.transactions[0].type, 'expense');
});

test('gets a single transaction', async () => {
  const created = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);
  const id = created.body.data.id;

  const res = await request(app).get(`/api/transactions/${id}`).set(authHeader(token));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, id);
  assert.equal(res.body.data.amount, 450);
});

test('updates a transaction (PUT)', async () => {
  const created = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);
  const id = created.body.data.id;

  const res = await request(app)
    .put(`/api/transactions/${id}`)
    .set(authHeader(token))
    .send({ amount: 999, merchant: 'Zomato' });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.amount, 999);
  assert.equal(res.body.data.merchant, 'Zomato');
  assert.equal(res.body.data.category, 'food');
});

test('deletes a transaction', async () => {
  const created = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);
  const id = created.body.data.id;

  const del = await request(app).delete(`/api/transactions/${id}`).set(authHeader(token));
  assert.equal(del.status, 204);

  const get = await request(app).get(`/api/transactions/${id}`).set(authHeader(token));
  assert.equal(get.status, 404);
});

test('cannot read another user transaction (ownership enforced)', async () => {
  const created = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);
  const id = created.body.data.id;

  const other = await registerUser(app, { email: 'other@example.com' });
  const otherToken = other.body.data.accessToken;

  const res = await request(app).get(`/api/transactions/${id}`).set(authHeader(otherToken));

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('cannot update or delete another user transaction', async () => {
  const created = await request(app)
    .post('/api/transactions')
    .set(authHeader(token))
    .send(expensePayload);
  const id = created.body.data.id;

  const other = await registerUser(app, { email: 'other@example.com' });
  const otherToken = other.body.data.accessToken;

  const upd = await request(app)
    .put(`/api/transactions/${id}`)
    .set(authHeader(otherToken))
    .send({ amount: 1 });
  assert.equal(upd.status, 404);

  const del = await request(app).delete(`/api/transactions/${id}`).set(authHeader(otherToken));
  assert.equal(del.status, 404);
});

test('returns 404 for nonexistent transaction id', async () => {
  const res = await request(app)
    .get('/api/transactions/000000000000000000000000')
    .set(authHeader(token));

  assert.equal(res.status, 404);
});

test('returns 400 for malformed object id', async () => {
  const res = await request(app)
    .get('/api/transactions/not-an-object-id')
    .set(authHeader(token));

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_ID');
});