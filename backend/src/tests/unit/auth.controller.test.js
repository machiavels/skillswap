'use strict';

process.env.JWT_SECRET = 'test_secret_key_for_jest';

jest.mock('../../database/db', () => ({ query: jest.fn() }));
jest.mock('bcrypt', () => ({
  hash:    jest.fn().mockResolvedValue('hashed_pw'),
  compare: jest.fn(),
}));

const pool   = require('../../database/db');
const bcrypt = require('bcrypt');
const { register, login, refreshToken, logout } = require('../../controllers/auth.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── register ────────────────────────────────────────────────────────────────

describe('register', () => {
  const validBody = {
    email:        'alice@example.com',
    password:     'Secret123!',
    pseudo:       'alice',
    birth_date:   '2000-01-01',
    cgu_accepted: true,
  };

  it('returns 400 when user is younger than 15', async () => {
    const req = { body: { ...validBody, birth_date: new Date().toISOString().slice(0, 10) } };
    const res = makeRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when cgu_accepted is false', async () => {
    const req = { body: { ...validBody, cgu_accepted: false } };
    const res = makeRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when email or pseudo is already taken', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'existing' }] });
    const req = { body: validBody };
    const res = makeRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 201 with tokens on successful registration', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })   // uniqueness check
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'alice@example.com', pseudo: 'alice', credit_balance: 2 }] }) // INSERT user
      .mockResolvedValueOnce({});                          // INSERT refresh_token
    const req = { body: validBody };
    const res = makeRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveProperty('access_token');
    expect(payload.data).toHaveProperty('refresh_token');
  });

  it('returns 500 on unexpected DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const req = { body: validBody };
    const res = makeRes();
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('login', () => {
  const baseReq = { body: { email: 'alice@example.com', password: 'Secret123!' } };

  it('returns 401 when user not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await login(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when password is wrong', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'u1', email: 'alice@example.com', pseudo: 'alice', password_hash: 'hash', credit_balance: 2 }] });
    bcrypt.compare.mockResolvedValueOnce(false);
    const res = makeRes();
    await login(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 200 with tokens on valid credentials', async () => {
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'u1', email: 'alice@example.com', pseudo: 'alice', password_hash: 'hash', credit_balance: 2 }] })
      .mockResolvedValueOnce({}); // INSERT refresh_token
    bcrypt.compare.mockResolvedValueOnce(true);
    const res = makeRes();
    await login(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveProperty('access_token');
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await login(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── refreshToken ─────────────────────────────────────────────────────────────

describe('refreshToken', () => {
  it('returns 400 when refresh_token is missing', async () => {
    const req = { body: {} };
    const res = makeRes();
    await refreshToken(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 when token hash not found in DB', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await refreshToken({ body: { refresh_token: 'sometoken' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 and deletes token when expired', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'rt1', user_id: 'u1', pseudo: 'alice', expires_at: pastDate }] })
      .mockResolvedValueOnce({}); // DELETE
    const res = makeRes();
    await refreshToken({ body: { refresh_token: 'expiredtoken' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Refresh token expired.' }));
  });

  it('returns 200 with new tokens on valid refresh', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'rt1', user_id: 'u1', pseudo: 'alice', expires_at: futureDate }] })
      .mockResolvedValueOnce({})  // DELETE old
      .mockResolvedValueOnce({}); // INSERT new
    const res = makeRes();
    await refreshToken({ body: { refresh_token: 'validtoken' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toHaveProperty('access_token');
    expect(payload.data).toHaveProperty('refresh_token');
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await refreshToken({ body: { refresh_token: 'tok' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('deletes token from DB and returns logged out message', async () => {
    pool.query.mockResolvedValueOnce({});
    const req = { body: { refresh_token: 'sometoken' } };
    const res = makeRes();
    await logout(req, res);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Logged out.' }));
  });

  it('still returns logged out when no refresh_token provided', async () => {
    const req = { body: {} };
    const res = makeRes();
    await logout(req, res);
    expect(pool.query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Logged out.' }));
  });
});
