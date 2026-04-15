const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateAccessToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  // Read at call time so tests (and runtime reconfigs) can override JWT_ACCESS_EXPIRES
  const raw = process.env.JWT_ACCESS_EXPIRES || '15m';
  const expiresIn = /^\d+$/.test(raw) ? Number(raw) : raw;
  return jwt.sign(payload, secret, { expiresIn });
}

function generateRefreshToken() {
  // Opaque random token stored hashed in DB
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
