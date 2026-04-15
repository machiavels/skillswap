'use strict';

process.env.JWT_SECRET = 'test_secret_key_for_jest';

const jwt = require('jsonwebtoken');
const { authenticate } = require('../../middlewares/auth.middleware');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function validToken(payload = { id: 'u1', pseudo: 'alice' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1m' });
}

describe('authenticate middleware', () => {
  it('calls next() and attaches payload to req.user when token is valid', () => {
    const req  = { headers: { authorization: `Bearer ${validToken()}` } };
    const res  = makeRes();
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'u1', pseudo: 'alice' });
  });

  it('returns 401 when Authorization header is absent', () => {
    const req  = { headers: {} };
    const res  = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Missing') })
    );
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    const req  = { headers: { authorization: 'Basic sometoken' } };
    const res  = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is signed with wrong secret', () => {
    const bad  = jwt.sign({ id: 'u1' }, 'wrong_secret');
    const req  = { headers: { authorization: `Bearer ${bad}` } };
    const res  = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid') })
    );
  });

  it('returns 401 when token is expired', () => {
    const expired = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: -1 });
    const req     = { headers: { authorization: `Bearer ${expired}` } };
    const res     = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token string is malformed', () => {
    const req  = { headers: { authorization: 'Bearer not.a.jwt' } };
    const res  = makeRes();
    authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
