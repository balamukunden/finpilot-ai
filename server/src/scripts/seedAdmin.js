const mongoose = require('mongoose');
const env = require('../config/env');
const { ensureAdmin } = require('../services/adminSeed');

async function run() {
  console.log('[Seed] Connecting to:', env.mongodbUri);
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 3000 });

  const result = await ensureAdmin();
  console.log('[Seed] Done:', JSON.stringify(result));
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[Seed] Failed:', err.message);
  console.error(
    '[Seed] Tip: make sure the backend is running (it starts the persistent embedded MongoDB) or that MongoDB is reachable at',
    env.mongodbUri
  );
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
