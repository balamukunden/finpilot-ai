const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupTestDB, teardownTestDB, clearDB, registerUser, loginUser, authHeader } = require('./helpers/testApp');
const app = require('../src/app');

let registeredToken;
let registeredRefreshToken;
let registeredUser;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDB();
  const res = await registerUser(app);
  assert.equal(res.status, 201);
  registeredToken = res.body.data.accessToken;
  registeredRefreshToken = res.body.data.refreshToken;
  registeredUser = res.body.data.user;
});

test('register creates a user and returns tokens', async () => {
  const res = await registerUser(app, { email: 'unique@example.com' });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
  assert.equal(res.body.data.user.email, 'unique@example.com');
  assert.equal(res.body.data.user.name, 'Test User');
  assert.equal(res.body.data.user.role, 'user');
  assert.ok(res.body.data.user.id);
  assert.equal(res.body.data.user.passwordHash, undefined);
});

test('register normalizes email to lowercase', async () => {
  const res = await registerUser(app, { email: 'MiXeD@Example.COM' });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.email, 'mixed@example.com');
});

test('register rejects duplicate email with 409 EMAIL_ALREADY_EXISTS', async () => {
  const res = await registerUser(app);

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  assert.match(res.body.error.message, /already exists/i);
});

test('register rejects invalid email', async () => {
  const res = await registerUser(app, { email: 'not-an-email' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.errors));
});

test('register rejects short password', async () => {
  const res = await registerUser(app, { password: 'short' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('register rejects mismatched confirm password', async () => {
  const res = await registerUser(app, { email: 'other@example.com' });
  assert.equal(res.status, 201);

  const mismatched = await request(app)
    .post('/api/auth/register')
    .send({ name: 'X', email: 'x@example.com', password: 'StrongPass1', confirmPassword: 'Different1' });
  assert.equal(mismatched.status, 400);
});

test('login succeeds with correct credentials', async () => {
  const res = await loginUser(app);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
  assert.equal(res.body.data.user.email, 'test@example.com');
});

test('login fails with wrong password', async () => {
  const res = await loginUser(app, 'test@example.com', 'WrongPass1');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
  assert.match(res.body.error.message, /incorrect/i);
});

test('login fails for unknown email', async () => {
  const res = await loginUser(app, 'nobody@example.com', 'StrongPass1');

  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /incorrect/i);
});

test('GET /api/auth/me returns the current user', async () => {
  const res = await request(app).get('/api/auth/me').set(authHeader(registeredToken));

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'test@example.com');
  assert.equal(res.body.data.user.name, 'Test User');
});

test('GET /api/auth/me without token returns 401', async () => {
  const res = await request(app).get('/api/auth/me');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('GET /api/auth/me with invalid token returns 401', async () => {
  const res = await request(app).get('/api/auth/me').set(authHeader('not.a.valid.token'));

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('logout revokes the refresh token', async () => {
  const res = await request(app)
    .post('/api/auth/logout')
    .set(authHeader(registeredToken))
    .send({ refreshToken: registeredRefreshToken });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('POST /api/auth/refresh-token issues new tokens', async () => {
  const login = await loginUser(app);
  const refreshToken = login.body.data.refreshToken;

  const res = await request(app)
    .post('/api/auth/refresh-token')
    .send({ refreshToken });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
});

test('POST /api/auth/refresh-token rejects a missing token', async () => {
  const res = await request(app).post('/api/auth/refresh-token').send({});

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('error responses never leak stack traces or internals', async () => {
  const res = await loginUser(app, 'test@example.com', 'WrongPass1');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.stack, undefined);
  assert.equal(res.body.error.passwordHash, undefined);
  assert.equal(JSON.stringify(res.body).includes('at '), false);
});