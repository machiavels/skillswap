const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { authLimiter, globalLimiter } = require('./middlewares/rateLimiter');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(globalLimiter);

// Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/profile', profileRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
