const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupTestDB, teardownTestDB, clearDB, registerUser, authHeader } = require('./helpers/testApp');
const app = require('../src/app');

let cookies;

function cookieValue(res, name) {
  const header = res.headers['set-cookie'];
  if (!header) return undefined;
  const entry = header.find((c) => c.startsWith(`${name}=`));
  if (!entry) return undefined;
  return entry.split(';')[0];
}

function cookieHeader(access, refresh) {
  return [access, refresh].filter(Boolean).join('; ');
}

const CSRF_HEADER = { 'X-Requested-With': 'XMLHttpRequest' };

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
  cookies = {
    access: cookieValue(res, 'accessToken'),
    refresh: cookieValue(res, 'refreshToken'),
  };
});

test('register sets httpOnly cookies scoped to /api', async () => {
  const res = await registerUser(app, { email: 'cookies@example.com' });
  const setCookie = res.headers['set-cookie'] || [];

  const access = setCookie.find((c) => c.startsWith('accessToken='));
  const refresh = setCookie.find((c) => c.startsWith('refreshToken='));

  assert.ok(access.includes('HttpOnly'));
  assert.ok(access.includes('Path=/api'));
  assert.ok(refresh.includes('HttpOnly'));
  assert.ok(refresh.includes('Path=/api'));
});

test('GET /api/auth/me authenticates via access-token cookie (no Bearer)', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Cookie', cookies.access);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.email, 'test@example.com');
});

test('mutating cookie-authenticated request without CSRF header is blocked (403)', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set('Cookie', cookieHeader(cookies.access, cookies.refresh))
    .send({ name: 'Attack', targetAmount: 100, currentAmount: 0 });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_REQUIRED');
});

test('mutating cookie-authenticated request with X-Requested-With passes CSRF', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set('Cookie', cookieHeader(cookies.access, cookies.refresh))
    .set(CSRF_HEADER)
    .send({ name: 'Emergency Fund', targetAmount: 200000, currentAmount: 50000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.goal.name, 'Emergency Fund');
});

test('Bearer-authenticated request is exempt from the CSRF header requirement', async () => {
  const res = await request(app)
    .post('/api/goals')
    .set(authHeader(cookies.access.split('=')[1]))
    .send({ name: 'Emergency Fund', targetAmount: 200000, currentAmount: 50000 });

  assert.equal(res.status, 201);
});

test('refresh-token via httpOnly cookie rotates the refresh token', async () => {
  const first = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', cookies.refresh)
    .set(CSRF_HEADER)
    .send({});

  assert.equal(first.status, 200);
  assert.ok(cookieValue(first, 'accessToken'));
  const newRefresh = cookieValue(first, 'refreshToken');
  assert.ok(newRefresh);
  assert.notEqual(newRefresh, cookies.refresh);

  // The rotated-out token must not be usable again.
  const reuse = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', cookies.refresh)
    .set(CSRF_HEADER)
    .send({});

  assert.equal(reuse.status, 401);
  assert.equal(reuse.body.error.code, 'REUSE_DETECTED');
});

test('refresh reuse detection revokes every active session', async () => {
  const first = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', cookies.refresh)
    .set(CSRF_HEADER)
    .send({});
  const newRefresh = cookieValue(first, 'refreshToken');
  assert.ok(newRefresh);

  // Trigger reuse detection with the old token.
  await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', cookies.refresh)
    .set(CSRF_HEADER)
    .send({});

  // The freshly-rotated token belongs to the same session and is now revoked.
  const second = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', newRefresh)
    .set(CSRF_HEADER)
    .send({});

  assert.equal(second.status, 401);
});

test('refresh token is required and missing credentials are rejected', async () => {
  const res = await request(app)
    .post('/api/auth/refresh-token')
    .set(CSRF_HEADER)
    .send({});

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('change-password rejects an incorrect current password', async () => {
  const res = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(cookies.access.split('=')[1]))
    .send({ currentPassword: 'WrongPass1', newPassword: 'NewStrong1', confirmPassword: 'NewStrong1' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_CURRENT_PASSWORD');
});

test('change-password revokes existing refresh tokens', async () => {
  const res = await request(app)
    .post('/api/auth/change-password')
    .set(authHeader(cookies.access.split('=')[1]))
    .send({ currentPassword: 'StrongPass1', newPassword: 'NewStrong1', confirmPassword: 'NewStrong1' });

  assert.equal(res.status, 200);

  const refresh = await request(app)
    .post('/api/auth/refresh-token')
    .set('Cookie', cookies.refresh)
    .set(CSRF_HEADER)
    .send({});

  assert.equal(refresh.status, 401);
});

test('logging out clears the auth cookies', async () => {
  const res = await request(app)
    .post('/api/auth/logout')
    .set(authHeader(cookies.access.split('=')[1]))
    .set('Cookie', cookieHeader(cookies.access, cookies.refresh))
    .set(CSRF_HEADER)
    .send({});

  assert.equal(res.status, 200);

  const logoutAccess = cookieValue(res, 'accessToken');
  const logoutRefresh = cookieValue(res, 'refreshToken');
  const rawCookies = res.headers['set-cookie'] || [];
  assert.ok(logoutAccess && logoutAccess.endsWith('=') && rawCookies.some((c) => c.includes('Expires=Thu, 01 Jan 1970')));
  assert.ok(logoutRefresh && logoutRefresh.endsWith('=') && rawCookies.some((c) => c.includes('Expires=Thu, 01 Jan 1970')));
});

test('CORS allows the configured production origin on preflight', async () => {
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type,x-requested-with');

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('CORS rejects a disallowed origin on preflight', async () => {
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://evil.example.com')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type');

  // No allow-origin header means the browser blocks the cross-origin request.
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('CORS omits allow-origin for disallowed origins on actual requests', async () => {
  const res = await request(app)
    .get('/api/health')
    .set('Origin', 'https://evil.example.com');

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});