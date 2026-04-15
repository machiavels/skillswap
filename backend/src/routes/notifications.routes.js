'use strict';

const { Router }     = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  listNotifications,
  markOneRead,
  markAllRead,
  updatePushToken,
} = require('../controllers/notifications.controller');

const router = Router();

// All notification routes require a valid JWT
router.use(authenticate);

// ── List & counts ─────────────────────────────────────────────────────
router.get('/',                listNotifications);

// ── Mark read ─────────────────────────────────────────────────────────
// /read-all MUST be declared before /:id so it is not swallowed as a param
router.patch('/read-all',      markAllRead);
router.patch('/:id/read',      markOneRead);

module.exports = router;
