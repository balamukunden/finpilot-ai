const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const { setupTestDB, teardownTestDB, clearDB, registerUser, authHeader } = require('./helpers/testApp');

let token;

const goalPayload = {
  name: 'Emergency Fund',
  type: 'emergency-fund',
  targetAmount: 200000,
  currentAmount: 50000,
  deadline: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  icon: '🏦',
  color: '#34D399',
  description: '6 months of expenses',
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

test('creates a goal and computes progress', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send(goalPayload);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'Emergency Fund');
  assert.equal(res.body.data.type, 'emergency-fund');
  assert.equal(res.body.data.targetAmount, 200000);
  assert.equal(res.body.data.currentAmount, 50000);
  assert.equal(res.body.data.progress, 25);
  assert.ok(res.body.data.id);
});

test('rejects goal without target amount', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send({ name: 'No target', type: 'custom', deadline: '2030-01-01' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('rejects zero or negative target amount', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send({ ...goalPayload, targetAmount: 0 });

  assert.equal(res.status, 400);
});

test('rejects negative current amount', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send({ ...goalPayload, currentAmount: -5 });

  assert.equal(res.status, 400);
});

test('rejects missing name', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send({ ...goalPayload, name: '  ' });

  assert.equal(res.status, 400);
});

test('lists goals for the user', async () => {
  await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  await request(app)
    .post('/api/goals')
    .set(authHeader(token))
    .send({ ...goalPayload, name: 'Vacation', type: 'vacation' });

  const res = await request(app).get('/api/goals').set(authHeader(token));

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.goals));
  assert.equal(res.body.data.goals.length, 2);
});

test('gets a single goal', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app).get(`/api/goals/${id}`).set(authHeader(token));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.name, 'Emergency Fund');
});

test('updates a goal', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app)
    .put(`/api/goals/${id}`)
    .set(authHeader(token))
    .send({ currentAmount: 100000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.currentAmount, 100000);
  assert.equal(res.body.data.progress, 50);
});

test('deletes a goal', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const del = await request(app).delete(`/api/goals/${id}`).set(authHeader(token));
  assert.equal(del.status, 204);

  const get = await request(app).get(`/api/goals/${id}`).set(authHeader(token));
  assert.equal(get.status, 404);
});

test('contribute adds to progress', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app)
    .post(`/api/goals/${id}/contribute`)
    .set(authHeader(token))
    .send({ amount: 50000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.goal.currentAmount, 100000);
  assert.equal(res.body.data.goal.progress, 50);
  assert.equal(res.body.data.completed, false);
});

test('contribute marks goal completed when target reached', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app)
    .post(`/api/goals/${id}/contribute`)
    .set(authHeader(token))
    .send({ amount: 200000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.completed, true);
  assert.equal(res.body.data.goal.status, 'completed');
  assert.equal(res.body.data.goal.currentAmount, 200000);
  assert.equal(res.body.data.goal.progress, 100);
});

test('contribute beyond target is capped at 100%', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app)
    .post(`/api/goals/${id}/contribute`)
    .set(authHeader(token))
    .send({ amount: 500000 });

  assert.equal(res.body.data.goal.currentAmount, 200000);
  assert.equal(res.body.data.goal.progress, 100);
});

test('rejects contribution of zero or negative', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const res = await request(app)
    .post(`/api/goals/${id}/contribute`)
    .set(authHeader(token))
    .send({ amount: 0 });

  assert.equal(res.status, 400);
});

test('cannot access another user goal (ownership enforced)', async () => {
  const created = await request(app).post('/api/goals').set(authHeader(token)).send(goalPayload);
  const id = created.body.data.id;

  const other = await registerUser(app, { email: 'other@example.com' });
  const otherToken = other.body.data.accessToken;

  const res = await request(app).get(`/api/goals/${id}`).set(authHeader(otherToken));
  assert.equal(res.status, 404);

  const cont = await request(app)
    .post(`/api/goals/${id}/contribute`)
    .set(authHeader(otherToken))
    .send({ amount: 100 });
  assert.equal(cont.status, 404);
});

test('requires authentication for goals', async () => {
  const res = await request(app).get('/api/goals');
  assert.equal(res.status, 401);
});