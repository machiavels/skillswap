const request = require('supertest');
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');
const app  = require('../app');

/**
 * Run the schema migration once before each __tests__ suite.
 * The globalSetup already does this, but it runs in a separate worker context.
 * This ensures the tables exist in the DB connection used by the test worker.
 */
beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return; // let the test fail with a clear DB error
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  if (!fs.existsSync(schemaPath)) return;
  const pool = new Pool({ connectionString });
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  await pool.end();
});

/**
 * Register a fresh user and return tokens + user object.
 * @param {object} overrides — override any default field
 */
async function createTestUser(overrides = {}) {
  const unique  = Date.now() + Math.random().toString(36).slice(2);
  const payload = {
    pseudo:       `testuser${unique}`,
    email:        `test${unique}@example.com`,
    password:     overrides.password || 'Password123!',
    birth_date:   '2000-01-01',
    cgu_accepted: true,
    ...overrides,
  };

  const regRes = await request(app).post('/api/v1/auth/register').send(payload);
  if (regRes.status !== 201) throw new Error(`createTestUser failed: ${JSON.stringify(regRes.body)}`);

  return {
    user:         regRes.body.data.user,
    accessToken:  regRes.body.data.access_token,
    refreshToken: regRes.body.data.refresh_token,
    password:     payload.password,
  };
}

/**
 * Returns a supertest-compatible header object for Bearer auth.
 * Usage: .set(authHeader(accessToken))
 * @param {string} token — JWT access token
 * @returns {{ Authorization: string }}
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { createTestUser, authHeader };
