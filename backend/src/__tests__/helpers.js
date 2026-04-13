const request = require('supertest');
const app = require('../app');

/**
 * Register a test user, return { user, accessToken, refreshToken }
 * Uses snake_case fields matching the API contract.
 * Reads tokens from res.body.data (wrapped by success() helper).
 */
async function createTestUser(overrides = {}) {
  const unique = Date.now() + Math.random().toString(36).slice(2, 7);
  const payload = {
    pseudo:       overrides.pseudo       || `user${unique}`,
    email:        overrides.email        || `test${unique}@example.com`,
    password:     overrides.password     || 'Password123!',
    birth_date:   overrides.birth_date   || '2000-01-01',
    cgu_accepted: overrides.cgu_accepted !== undefined ? overrides.cgu_accepted : true,
  };

  const regRes = await request(app).post('/api/v1/auth/register').send(payload);
  if (regRes.status !== 201) throw new Error(`createTestUser failed: ${JSON.stringify(regRes.body)}`);

  return {
    user:         regRes.body.data.user,
    accessToken:  regRes.body.data.access_token,
    refreshToken: regRes.body.data.refresh_token,
  };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createTestUser, authHeader };
