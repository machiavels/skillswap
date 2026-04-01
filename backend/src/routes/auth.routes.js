const { Router } = require('express');
const Joi = require('joi');
const { validate } = require('../middlewares/validate.middleware');
const { register, login, refreshToken, logout } = require('../controllers/auth.controller');

const router = Router();

const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  pseudo: Joi.string().alphanum().min(3).max(50).required(),
  birth_date: Joi.date().iso().required(),
  cgu_accepted: Joi.boolean().valid(true).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

router.post('/register', validate(registerSchema), register);
router.post('/login',    validate(loginSchema),    login);
router.post('/refresh',  validate(refreshSchema),  refreshToken);
router.post('/logout',   logout);

module.exports = router;
