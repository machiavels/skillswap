'use strict';

process.env.JWT_SECRET = 'test_secret_for_utils';

const { generateAccessToken, generateRefreshToken, hashToken } = require('../../utils/jwt');
const { success, error } = require('../../utils/response');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ─── jwt utils ───────────────────────────────────────────────────────────────

describe('generateAccessToken', () => {
  it('returns a non-empty JWT string', () => {
    const token = generateAccessToken({ id: 'u1', pseudo: 'alice' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('encodes the given payload', () => {
    const jwt   = require('jsonwebtoken');
    const token = generateAccessToken({ id: 'u42', pseudo: 'bob' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe('u42');
    expect(decoded.pseudo).toBe('bob');
  });

  it('throws when JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => generateAccessToken({ id: 'u1' })).toThrow('JWT_SECRET is not defined');
    process.env.JWT_SECRET = original;
  });

  it('accepts a numeric string as expiresIn via JWT_ACCESS_EXPIRES', () => {
    process.env.JWT_ACCESS_EXPIRES = '3600';
    const token = generateAccessToken({ id: 'u1' });
    expect(typeof token).toBe('string');
    delete process.env.JWT_ACCESS_EXPIRES;
  });
});

describe('generateRefreshToken', () => {
  it('returns a 128-char hex string', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(128);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates unique tokens on each call', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });
});

describe('hashToken', () => {
  it('returns a deterministic 64-char hex hash', () => {
    const hash = hashToken('mytoken');
    expect(hash).toHaveLength(64);
    expect(hashToken('mytoken')).toBe(hash); // deterministic
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});

// ─── response utils ──────────────────────────────────────────────────────────

describe('success response helper', () => {
  it('returns 200 by default with data and meta.requestId', () => {
    const res = makeRes();
    success(res, { id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toEqual({ id: 1 });
    expect(body.meta).toHaveProperty('requestId');
  });

  it('accepts a custom status code', () => {
    const res = makeRes();
    success(res, {}, 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('merges extra fields into meta', () => {
    const res = makeRes();
    success(res, {}, 200, { total: 5 });
    const body = res.json.mock.calls[0][0];
    expect(body.meta.total).toBe(5);
  });
});

describe('error response helper', () => {
  it('returns the given status code with code and message', () => {
    const res = makeRes();
    error(res, 404, 'NOT_FOUND', 'Resource not found.');
    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Resource not found.');
    expect(body.meta).toHaveProperty('requestId');
  });

  it('includes details array when provided', () => {
    const res = makeRes();
    error(res, 422, 'VALIDATION_ERROR', 'Invalid input.', ['field is required']);
    const body = res.json.mock.calls[0][0];
    expect(body.error.details).toEqual(['field is required']);
  });

  it('defaults to empty details array', () => {
    const res = makeRes();
    error(res, 500, 'INTERNAL_ERROR', 'Oops.');
    const body = res.json.mock.calls[0][0];
    expect(body.error.details).toEqual([]);
  });
});
