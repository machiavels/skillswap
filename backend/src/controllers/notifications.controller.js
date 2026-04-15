'use strict';

const pool           = require('../database/db');
const { success, error } = require('../utils/response');
const logger         = require('../utils/logger');

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_DEFAULT = 20;

/**
 * GET /api/v1/notifications
 *
 * Returns the authenticated user’s notifications, unread first then
 * newest-first within each group.  Supports cursor-based pagination
 * via `before` (a notification `created_at` ISO timestamp).
 *
 * Query params:
 *   limit  {number}  1–50, default 20
 *   before {string}  ISO timestamp cursor (exclusive)
 *
 * Response shape:
 *   { data: { notifications: [...], unread_count: N }, meta: { ... } }
 */
async function listNotifications(req, res) {
  const userId = req.user.id;
  const limit  = Math.min(parseInt(req.query.limit) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
  const before = req.query.before || null;

  try {
    const params = [userId];
    let cursorClause = '';
    if (before) {
      params.push(before);
      cursorClause = `AND n.created_at < $${params.length}::timestamptz`;
    }

    const [notifResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, type, payload, read_at, created_at
         FROM notifications n
         WHERE user_id = $1 ${cursorClause}
         ORDER BY
           (read_at IS NOT NULL),   -- unread (NULL) sorts before read
           created_at DESC
         LIMIT ${limit}`,
        params
      ),
      pool.query(
        'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      ),
    ]);

    return success(res, {
      notifications: notifResult.rows,
      unread_count:  countResult.rows[0].unread_count,
    });
  } catch (err) {
    logger.error('listNotifications error', { error: err.message, userId });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 *
 * Marks a single notification as read.  Idempotent: already-read
 * notifications are returned as-is with 200.
 */
async function markOneRead(req, res) {
  const userId         = req.user.id;
  const notificationId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET    read_at = COALESCE(read_at, NOW())
       WHERE  id = $1 AND user_id = $2
       RETURNING id, type, payload, read_at, created_at`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return error(res, 404, 'NOT_FOUND', 'Notification not found.');
    }
    return success(res, result.rows[0]);
  } catch (err) {
    logger.error('markOneRead error', { error: err.message, userId, notificationId });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 *
 * Marks all unread notifications for the current user as read.
 * Returns the count of rows updated.
 */
async function markAllRead(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET    read_at = NOW()
       WHERE  user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return success(res, { marked_read: result.rowCount });
  } catch (err) {
    logger.error('markAllRead error', { error: err.message, userId });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

/**
 * PATCH /api/v1/me/push-token
 *
 * Stores (or clears) the user’s Expo push token.
 * Body: { push_token: string | null }
 */
async function updatePushToken(req, res) {
  const userId     = req.user.id;
  const pushToken  = req.body.push_token ?? null;

  try {
    await pool.query(
      'UPDATE users SET push_token = $1 WHERE id = $2',
      [pushToken, userId]
    );
    return success(res, { push_token: pushToken });
  } catch (err) {
    logger.error('updatePushToken error', { error: err.message, userId });
    return error(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

module.exports = { listNotifications, markOneRead, markAllRead, updatePushToken };
