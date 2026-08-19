const env = require('../config/env');
const User = require('../models/User');

/**
 * Create (or verify) the admin/demo account from environment configuration.
 * - Idempotent: never duplicates an existing account.
 * - Never overwrites an existing password/name unless ADMIN_RESET_PASSWORD=1.
 * - No-op when ADMIN_EMAIL / ADMIN_PASSWORD are not configured.
 * @returns {Promise<{created: boolean, exists: boolean, email: string|null}>}
 */
async function ensureAdmin() {
  const { email, password, name } = env.admin;
  if (!email || !password) {
    console.log('[Admin] Seed skipped — ADMIN_EMAIL / ADMIN_PASSWORD not configured.');
    return { created: false, exists: false, email: null };
  }

  const existing = await User.findOne({ email });
  if (existing) {
    let changed = false;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      changed = true;
    }
    if (process.env.ADMIN_RESET_PASSWORD === '1') {
      existing.password = password;
      existing.name = name || existing.name;
      changed = true;
    }
    if (changed) {
      await existing.save();
    }
    console.log(`[Admin] Account exists — no duplicate created: ${email}`);
    return { created: false, exists: true, email };
  }

  await User.create({
    name: name || 'Admin',
    email,
    password,
    role: 'admin',
  });
  console.log(`[Admin] Created admin account: ${email}`);
  return { created: true, exists: false, email };
}

module.exports = { ensureAdmin };
