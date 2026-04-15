'use strict';

const { Router } = require('express');
const { authenticate }  = require('../middlewares/auth.middleware');
const { reportLimiter } = require('../middlewares/rateLimiter');
const { createReport }  = require('../controllers/reports.controller');

const router = Router();

router.post('/', authenticate, reportLimiter, createReport);

module.exports = router;
