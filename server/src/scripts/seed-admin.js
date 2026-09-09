/**
 * Seed the admin account from environment variables.
 *
 * Usage:  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='...' npm run seed:admin
 *
 * - Creates the admin only if it does not already exist.
 * - Never runs destructively and never runs on server startup.
 * - Never exposes credentials.
 */
require('dotenv').config();

const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/user.model');

async function seedAdmin() {
  const { email, password, name } = env.admin;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    console.error('ADMIN_EMAIL must be a valid email address.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      console.log(`Admin already exists (${cleanEmail}). No changes made.`);
      process.exit(0);
    }

    await User.create({
      name: name || 'Admin',
      email: cleanEmail,
      passwordHash: password,
      role: 'admin',
    });

    console.log(`Admin created successfully: ${cleanEmail}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error.message);
    process.exit(1);
  }
}

seedAdmin();