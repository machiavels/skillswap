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
 * Alias used by badge (and other) tests.
 * Returns { user, token } where token is the access token.
 * @param {object} overrides
 */
async function registerAndLogin(overrides = {}) {
  const { user, accessToken } = await createTestUser(overrides);
  return { user, token: accessToken };
}

/**
 * Returns a supertest-compatible Authorization header.
 * @param {string} token
 * @returns {{ Authorization: string }}
 */
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Helper: simulate a full completed exchange between two users.
 * - requesterUser creates the exchange request
 * - partnerUser accepts it
 * - requesterUser confirms it as completed
 *
 * Requires the exchanges routes to be mounted at /api/v1/exchanges.
 *
 * @param {string} requesterId
 * @param {string} partnerId
 * @param {string} requesterToken
 * @param {string} partnerToken
 * @returns {Promise<object>} the final exchange row from the confirm response
 */
async function createCompletedExchange(requesterId, partnerId, requesterToken, partnerToken) {
  // Step 1: fetch a skill id to attach to the exchange
  const skillsRes = await request(app)
    .get('/api/v1/skills')
    .set(authHeader(requesterToken));
  const skillId = skillsRes.body.data?.[0]?.id || null;

  // Step 2: create exchange request
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

  // Step 3: partner accepts
  const acceptRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/status`)
    .set(authHeader(partnerToken))
    .send({ status: 'accepted' });

  if (acceptRes.status !== 200) {
    throw new Error(`createCompletedExchange (accept) failed: ${JSON.stringify(acceptRes.body)}`);
  }

  // Step 4: requester confirms completion
  const confirmRes = await request(app)
    .patch(`/api/v1/exchanges/${exchangeId}/status`)
    .set(authHeader(requesterToken))
    .send({ status: 'completed' });

  if (confirmRes.status !== 200) {
    throw new Error(`createCompletedExchange (confirm) failed: ${JSON.stringify(confirmRes.body)}`);
  }

  return confirmRes.body.data;
}

module.exports = { createTestUser, registerAndLogin, authHeader, promoteToAdmin, createCompletedExchange };
