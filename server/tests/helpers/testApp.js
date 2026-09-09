process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.RATE_LIMIT_MAX_REQUESTS = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.AUTH_MAX_FAILED_ATTEMPTS = '100000';
process.env.CLIENT_URL = 'http://localhost:5173';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../../src/config/db');
const throttle = require('../../src/services/loginThrottle.service');

let mongod;

async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connectDB(uri);
  return { uri };
}

async function teardownTestDB() {
  await disconnectDB();
  if (mongod) await mongod.stop();
  mongoose.connection.close();
}

async function clearDB() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  await throttle.resetAll();
}

async function registerUser(app, overrides = {}) {
  const body = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'StrongPass1',
    ...overrides,
  };
  return request(app).post('/api/auth/register').send({
    name: body.name,
    email: body.email,
    password: body.password,
    confirmPassword: body.password,
  });
}

async function loginUser(app, email = 'test@example.com', password = 'StrongPass1') {
  return request(app).post('/api/auth/login').send({ email, password });
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { setupTestDB, teardownTestDB, clearDB, registerUser, loginUser, authHeader };