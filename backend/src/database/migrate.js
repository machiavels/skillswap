require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const logger = require('../utils/logger');

async function migrate() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    logger.info('Database migration completed successfully.');
  } catch (err) {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
