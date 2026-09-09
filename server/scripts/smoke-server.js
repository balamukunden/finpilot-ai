const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const SERVER_DIR = path.resolve(__dirname, '..');

function pollHealth(url, attempts, delayMs, getBootLog) {
  return new Promise((resolve, reject) => {
    let attemptsLeft = attempts;
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', () => {
        attemptsLeft -= 1;
        if (attemptsLeft <= 0) reject(new Error(`health endpoint never responded\nBOOT_LOG=${getBootLog()}`));
        else setTimeout(tryOnce, delayMs);
      });
    };
    tryOnce();
  });
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: '5999', MONGODB_URI: uri, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let bootLog = '';
  child.stdout.on('data', (d) => (bootLog += d));
  child.stderr.on('data', (d) => (bootLog += d));

  try {
    const res = await pollHealth('http://localhost:5999/api/health', 40, 250, () => bootLog);
    console.log(`HEALTH_STATUS=${res.status}`);
    console.log(`HEALTH_BODY=${res.body.slice(0, 300)}`);
    console.log(`BOOT_LOG=${bootLog.slice(0, 500)}`);

    const notFound = await new Promise((resolve, reject) => {
      http.get('http://localhost:5999/api/nope', (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }).on('error', reject);
    });
    console.log(`NOT_FOUND_STATUS=${notFound}`);

    const pass = res.status === 200 && notFound === 404;
    process.exitCode = pass ? 0 : 1;
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await mongod.stop();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});