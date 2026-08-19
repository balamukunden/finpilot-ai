const axios = require('axios');

const PORT = process.env.PORT || 5000;
const API_URL = `http://localhost:${PORT}/api/auth`;

async function runTests() {
  console.log('=== STARTING AUTHENTICATION MODULE VERIFICATION TESTS ===\n');
  let testCount = 0;
  let passedCount = 0;

  async function test(name, fn) {
    testCount++;
    try {
      await fn();
      passedCount++;
      console.log(`✓ Test ${testCount}: ${name} — PASSED`);
    } catch (err) {
      console.error(`✗ Test ${testCount}: ${name} — FAILED`);
      console.error('  Error:', err.response?.data || err.message);
    }
  }

  const testEmail = `user_${Date.now()}@example.com`;
  const validPassword = 'Password123!';
  let accessToken = '';
  let refreshToken = '';

  // 1. Register new user
  await test('Register new user (MongoDB user creation & JWT generation)', async () => {
    const res = await axios.post(`${API_URL}/register`, {
      name: 'John Doe',
      email: testEmail,
      password: validPassword,
      confirmPassword: validPassword,
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.success) throw new Error('Response success flag is false');
    if (!res.data.data.user) throw new Error('User object missing in response');
    if (!res.data.data.accessToken) throw new Error('AccessToken missing');
    if (!res.data.data.refreshToken) throw new Error('RefreshToken missing');

    accessToken = res.data.data.accessToken;
    refreshToken = res.data.data.refreshToken;
    console.log('  -> Registered User ID:', res.data.data.user.id);
    console.log('  -> JWT AccessToken issued successfully');
  });

  // 2. Duplicate email
  await test('Prevent Duplicate Email Registration (409 Conflict)', async () => {
    try {
      await axios.post(`${API_URL}/register`, {
        name: 'John Clone',
        email: testEmail,
        password: validPassword,
        confirmPassword: validPassword,
      });
      throw new Error('Should have failed with 409 Conflict');
    } catch (err) {
      if (err.response?.status === 409) {
        console.log('  -> Received expected 409 Conflict status');
      } else {
        throw err;
      }
    }
  });

  // 3. Invalid password
  await test('Reject Invalid Password (Validation Error 400)', async () => {
    try {
      await axios.post(`${API_URL}/register`, {
        name: 'Short Pass',
        email: `short_${Date.now()}@example.com`,
        password: 'short',
        confirmPassword: 'short',
      });
      throw new Error('Should have failed with 400 Bad Request');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  -> Received expected 400 status:', err.response.data.message || err.response.data.errors);
      } else {
        throw err;
      }
    }
  });

  // 4. Invalid email
  await test('Reject Invalid Email (Validation Error 400)', async () => {
    try {
      await axios.post(`${API_URL}/register`, {
        name: 'Bad Email',
        email: 'invalid-email-format',
        password: validPassword,
        confirmPassword: validPassword,
      });
      throw new Error('Should have failed with 400 Bad Request');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('  -> Received expected 400 status:', err.response.data.message || err.response.data.errors);
      } else {
        throw err;
      }
    }
  });

  // 5. Login
  await test('Login with Registered Credentials (200 OK & JWT issuance)', async () => {
    const res = await axios.post(`${API_URL}/login`, {
      email: testEmail,
      password: validPassword,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('AccessToken missing');
    accessToken = res.data.data.accessToken;
    console.log('  -> Login successful, new JWT token received');
  });

  // 6. Protected routes
  await test('Access Protected Route GET /api/auth/me using JWT', async () => {
    const res = await axios.get(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.data.user.email !== testEmail) throw new Error('Email mismatch');
    console.log('  -> Authenticated user fetched successfully:', res.data.data.user.name);
  });

  // 7. Logout
  await test('Logout User POST /api/auth/logout', async () => {
    const res = await axios.post(
      `${API_URL}/logout`,
      { refreshToken },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    console.log('  -> Logged out successfully');
  });

  console.log(`\n=== VERIFICATION SUMMARY: ${passedCount}/${testCount} TESTS PASSED ===\n`);
  if (passedCount === testCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
