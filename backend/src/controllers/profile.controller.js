'use strict';

const pool   = require('../database/db');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Helper: fetch badges earned by a user.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function _fetchBadges(userId) {
  const result = await pool.query(
    `SELECT b.slug, b.label, b.description, b.icon, b.threshold, ub.awarded_at
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = $1
     ORDER BY b.threshold ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * GET /api/v1/profile/me
 * Returns the authenticated user's full profile, including badges.
 */
async function getMyProfile(req, res) {
  const userId = req.user.id;
  try {
    const [userResult, skillsResult, badgesResult] = await Promise.all([
      pool.query(
        `SELECT id, pseudo, bio, photo_url, date_of_birth, credit_balance,
                average_rating, exchange_count, created_at
         FROM users
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT us.id, us.type, us.level, s.id AS skill_id, s.name, s.category
         FROM user_skills us
         JOIN skills s ON s.id = us.skill_id
         WHERE us.user_id = $1`,
        [userId]
      ),
      _fetchBadges(userId),
    ]);

    if (userResult.rowCount === 0) return error(res, 404, 'NOT_FOUND', 'User not found.');

    return success(res, {
      ...userResult.rows[0],
      skills: skillsResult.rows,
      badges: badgesResult,
    });
  } catch (err) {
    logger.error('getMyProfile error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * GET /api/v1/profile/:userId
 * Returns a public profile view, including badges.
 */
async function getPublicProfile(req, res) {
  const { userId } = req.params;
  try {
    const [userResult, skillsResult, badgesResult] = await Promise.all([
      pool.query(
        `SELECT id, pseudo, bio, photo_url, average_rating, exchange_count, created_at
         FROM users
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT us.id, us.type, us.level, s.id AS skill_id, s.name, s.category
         FROM user_skills us
         JOIN skills s ON s.id = us.skill_id
         WHERE us.user_id = $1`,
        [userId]
      ),
      _fetchBadges(userId),
    ]);

    if (userResult.rowCount === 0) return error(res, 404, 'NOT_FOUND', 'User not found.');

    return success(res, {
      ...userResult.rows[0],
      skills: skillsResult.rows,
      badges: badgesResult,
    });
  } catch (err) {
    logger.error('getPublicProfile error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PUT /api/v1/profile/me
 * Update the authenticated user's profile (pseudo, bio, photo_url).
 */
async function updateMyProfile(req, res) {
  const userId = req.user.id;
  const { pseudo, bio, photo_url } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET pseudo    = COALESCE($1, pseudo),
           bio       = COALESCE($2, bio),
           photo_url = COALESCE($3, photo_url)
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, pseudo, bio, photo_url, average_rating, exchange_count, credit_balance`,
      [pseudo || null, bio || null, photo_url || null, userId]
    );
    if (result.rowCount === 0) return error(res, 404, 'NOT_FOUND', 'User not found.');
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('updateMyProfile error', { error: err.message });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { getMyProfile, getPublicProfile, updateMyProfile };
