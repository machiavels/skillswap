'use strict';

const request = require('supertest');
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');
const app  = require('../app');

/** Run schema.sql + all migrations against the test DB. Idempotent. */
async function applyMigrations() {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString });

  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
  }

  const migrationsDir = path.resolve(__dirname, '../database/migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      await pool.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  }

  await pool.end();
}

beforeAll(async () => {
  await applyMigrations();
});

/**
 * Promote a user to admin role directly in the DB.
 * @param {string} userId
 */
async function promoteToAdmin(userId) {
  await applyMigrations();
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
  await pool.end();
}

/**
 * Register a fresh user and return tokens + user object.
 * @param {object} overrides
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
 * Alias: returns { user, token } where token is the access token.
 * @param {object} overrides
 */
async function registerAndLogin(overrides = {}) {
  const { user, accessToken } = await createTestUser(overrides);
  return { user, token: accessToken };
}

/**
 * Returns a supertest-compatible Authorization header.
 * @param {string} token
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get a skill UUID from the catalogue and attach it to the user.
 * Workflow:
 *   1. GET /api/v1/skills          — fetch catalogue
 *   2. POST /api/v1/skills/me      — attach skill to user (type: offered, level: beginner)
 *
 * Returns the catalogue skill UUID (used as skill_id in exchanges).
 *
 * @param {string} token  — access token of the user who will offer the skill
 * @returns {Promise<string>} skill UUID from the catalogue
 */
async function seedSkill(token) {
  // Step 1: get catalogue
  const catalogRes = await request(app)
    .get('/api/v1/skills')
    .set(authHeader(token));

  if (catalogRes.status !== 200 || !catalogRes.body.data?.length) {
    throw new Error(
      `seedSkill: catalogue empty or unavailable (${catalogRes.status}): ${JSON.stringify(catalogRes.body)}`
    );
  }

  const skillId = catalogRes.body.data[0].id;

  // Step 2: attach to user (idempotent — if already attached the exchange still works)
  await request(app)
    .post('/api/v1/skills/me')
    .set(authHeader(token))
    .send({ skill_id: skillId, type: 'offered', level: 'beginner' });

  return skillId;
}

/**
 * Simulate a full completed exchange between two users:
 *   requester creates → partner accepts (PATCH /respond) → requester confirms (PATCH /confirm)
 *
 * @param {string} requesterId
 * @param {string} partnerId
 * @param {string} requesterToken
 * @param {string} partnerToken
 * @returns {Promise<object>} the final exchange row
 */
async function createCompletedExchange(requesterId, partnerId, requesterToken, partnerToken) {
  const skillId = await seedSkill(requesterToken);

  // Step 1: create exchange request
  const createRes = await request(app)
    .post('/api/v1/exchanges')
    .set(authHeader(requesterToken))
    .send({
      partner_id:       partnerId,
      skill_id:         skillId,
      duration_minutes: 60,
      desired_date:     new Date(Date.now() + 86400000).toISOString(),
      message:          'Test exchange',
    });

  if (createRes.status !== 201) {
    throw new Error(`createCompletedExchange (create) failed: ${JSON.stringify(createRes.body)}`);
  }

  const exchangeId = createRes.body.data.id;

  // Step 2: partner accepts
  const acceptRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/respond`)
    .set(authHeader(partnerToken))
    .send({ action: 'accept' });

  if (acceptRes.status !== 200) {
    throw new Error(`createCompletedExchange (accept) failed: ${JSON.stringify(acceptRes.body)}`);
  }

  // Step 3: requester confirms completion
  const confirmRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/confirm`)
    .set(authHeader(requesterToken));

  if (confirmRes.status !== 200) {
    throw new Error(`createCompletedExchange (confirm) failed: ${JSON.stringify(confirmRes.body)}`);
  }

  return confirmRes.body.data;
}

module.exports = { createTestUser, registerAndLogin, authHeader, promoteToAdmin, createCompletedExchange };
