'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const authRoutes          = require('./routes/auth.routes');
const profileRoutes       = require('./routes/profile.routes');
const skillsRoutes        = require('./routes/skills.routes');
const availabilityRoutes  = require('./routes/availability.routes');
const searchRoutes        = require('./routes/search.routes');
const exchangeRoutes      = require('./routes/exchange.routes');
const reviewRoutes        = require('./routes/review.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const reportsRoutes       = require('./routes/reports.routes');
const adminRoutes         = require('./routes/admin.routes');
const badgesRoutes        = require('./routes/badges.routes');

const app = express();

// ── Security & parsing ────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// ── Global rate limit ─────────────────────────────────────────────────
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',           authRoutes);
app.use('/api/v1/profile',        profileRoutes);
app.use('/api/v1/skills',         skillsRoutes);
app.use('/api/v1/availabilities', availabilityRoutes);
app.use('/api/v1/search',         searchRoutes);
app.use('/api/v1/exchanges',      exchangeRoutes);
app.use('/api/v1/reviews',        reviewRoutes);
app.use('/api/v1/notifications',  notificationsRoutes);
app.use('/api/v1/reports',        reportsRoutes);
app.use('/api/v1/admin',          adminRoutes);
app.use('/api/v1/badges',         badgesRoutes);

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found.' }));

module.exports = app;
