'use strict';

process.env.JWT_SECRET = 'test_secret_for_middleware';

const jwt = require('jsonwebtoken');
const { authenticate } = require('../../middlewares/auth.middleware');
const errorHandler   = require('../../middlewares/errorHandler');
const { validate }   = require('../../middlewares/validate.middleware');
const Joi            = require('joi');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ─── authenticate ───────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an invalid / expired token', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' } };
    const res = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or expired access token.' })
    );
  });

  it('sets req.user and calls next() for a valid token', () => {
    const token = jwt.sign({ id: 'u1', pseudo: 'alice' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req  = { headers: { authorization: `Bearer ${token}` } };
    const res  = makeRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1', pseudo: 'alice' });
  });
});

// ─── errorHandler ───────────────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  it('uses err.status when provided and returns structured JSON', () => {
    const err = { status: 404, code: 'NOT_FOUND', message: 'Not found.' };
    const req = { id: 'req-1' };
    const res = makeRes();
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Not found.' }),
        meta:  expect.objectContaining({ requestId: 'req-1' }),
      })
    );
  });

  it('defaults to 500 and masks the message for unexpected errors', () => {
    const err = new Error('secret db details');
    const req = { id: 'req-2' };
    const res = makeRes();
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Internal server error.' }),
      })
    );
  });

  it('falls back to INTERNAL_ERROR code when err.code is absent', () => {
    const err = { statusCode: 503, message: 'down' };
    const req = { id: 'req-3' };
    const res = makeRes();
    errorHandler(err, req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      })
    );
  });
});

// ─── validate middleware ─────────────────────────────────────────────────────

describe('validate middleware', () => {
  const schema = Joi.object({ name: Joi.string().required() });

  it('calls next() and strips unknown fields when body is valid', () => {
    const req  = { body: { name: 'alice', extra: 'ignored' } };
    const res  = makeRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'alice' }); // unknown stripped
  });

  it('returns 422 with details array when body is invalid', () => {
    const req  = { body: {} };
    const res  = makeRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error:   'Validation failed',
        details: expect.arrayContaining([expect.any(String)]),
      })
    );
  });
});
