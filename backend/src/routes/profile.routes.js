const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const Joi = require('joi');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { getProfile, updateProfile } = require('../controllers/profile.controller');

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG or WebP images are allowed.'));
    }
  },
});

const updateSchema = Joi.object({
  pseudo: Joi.string().alphanum().min(3).max(50),
  bio: Joi.string().max(500).allow(''),
});

// GET /api/v1/profile/me  — own profile
router.get('/me', authenticate, getProfile);

// GET /api/v1/profile/:userId  — public profile of any user
router.get('/:userId', authenticate, getProfile);

// PUT /api/v1/profile/me  — update own profile (with optional photo)
router.put('/me', authenticate, upload.single('photo'), validate(updateSchema), updateProfile);

module.exports = router;
