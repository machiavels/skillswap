const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function generateRefreshToken() {
  // Opaque random token stored hashed in DB
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
