const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupTestDB, teardownTestDB, clearDB, registerUser, authHeader } = require('./helpers/testApp');
const app = require('../src/app');
const Notification = require('../src/models/notification.model');

let userA;
let userB;
let tokenA;
let tokenB;

before(async () => {
  await setupTestDB();
});

after(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearDB();
  const resA = await registerUser(app, { email: 'alice@example.com' });
  userA = resA.body.data.user;
  tokenA = resA.body.data.accessToken;
  const resB = await registerUser(app, { email: 'bob@example.com' });
  userB = resB.body.data.user;
  tokenB = resB.body.data.accessToken;
});

function seedNotifications() {
  return Notification.create([
    { userId: userA.id, type: 'goal', title: 'A1', message: 'one', isRead: false },
    { userId: userA.id, type: 'info', title: 'A2', message: 'two', isRead: true },
    { userId: userB.id, type: 'goal', title: 'B1', message: 'three', isRead: false },
  ]);
}

test('list returns only the authenticated user notifications', async () => {
  await seedNotifications();

  const res = await request(app).get('/api/notifications').set(authHeader(tokenA));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.notifications.length, 2);
  assert.ok(res.body.data.notifications.every((n) => n.title.startsWith('A')));
  assert.equal(res.body.data.unreadCount, 1);
});

test('list supports pagination', async () => {
  await Notification.create([
    { userId: userA.id, type: 'info', title: 'P1', message: 'm' },
    { userId: userA.id, type: 'info', title: 'P2', message: 'm' },
  ]);

  const res = await request(app)
    .get('/api/notifications?page=1&limit=1')
    .set(authHeader(tokenA));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.notifications.length, 1);
  assert.equal(res.body.data.pagination.total, 2);
});

test('cannot mark another user notification as read (ownership enforced)', async () => {
  const [, , other] = await seedNotifications();
  const res = await request(app)
    .put(`/api/notifications/${other._id}/read`)
    .set(authHeader(tokenA));

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');

  const stillUnread = await Notification.findById(other._id);
  assert.equal(stillUnread.isRead, false);
});

test('marks own notification as read', async () => {
  const [, , own] = await seedNotifications();
  const res = await request(app)
    .put(`/api/notifications/${own._id}/read`)
    .set(authHeader(tokenB));

  assert.equal(res.status, 200);
  const updated = await Notification.findById(own._id);
  assert.equal(updated.isRead, true);
});

test('mark-all-read only affects the caller', async () => {
  await seedNotifications();

  const res = await request(app).put('/api/notifications/read-all').set(authHeader(tokenA));

  assert.equal(res.status, 200);
  const aUnread = await Notification.countDocuments({ userId: userA.id, isRead: false });
  const bUnread = await Notification.countDocuments({ userId: userB.id, isRead: false });
  assert.equal(aUnread, 0);
  assert.equal(bUnread, 1);
});

test('invalid notification id returns 400', async () => {
  const res = await request(app).put('/api/notifications/not-an-id/read').set(authHeader(tokenA));

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_ID');
});

test('unauthenticated list returns 401', async () => {
  const res = await request(app).get('/api/notifications');
  assert.equal(res.status, 401);
});