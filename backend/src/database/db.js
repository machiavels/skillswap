'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

// In CI/test environments TEST_DATABASE_URL is provided.
// In production DATABASE_URL takes precedence.
// Fall back to individual vars for local development without a .env URL.
const connectionString =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'skillswap',
      user:     process.env.DB_USER     || 'skillswap_user',
      // Ensure password is always a string — pg's SCRAM auth rejects undefined
      password: process.env.DB_PASSWORD || '',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

module.exports = pool;
