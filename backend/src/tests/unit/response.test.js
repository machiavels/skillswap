'use strict';

const { success, error } = require('../../utils/response');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('response utils', () => {
  describe('success', () => {
    it('defaults to status 200 and wraps data under the data key', () => {
      const res = makeRes();
      success(res, { id: 42 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { id: 42 } })
      );
    });

    it('uses a custom status code when provided', () => {
      const res = makeRes();
      success(res, {}, 201);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('merges extra fields into meta', () => {
      const res = makeRes();
      success(res, {}, 200, { page: 3, total: 100 });
      const payload = res.json.mock.calls[0][0];
      expect(payload.meta).toMatchObject({ page: 3, total: 100 });
    });

    it('always includes a requestId in meta', () => {
      const res = makeRes();
      success(res, {});
      const payload = res.json.mock.calls[0][0];
      expect(typeof payload.meta.requestId).toBe('string');
      expect(payload.meta.requestId.length).toBeGreaterThan(0);
    });
  });

  describe('error', () => {
    it('sets status, code, and message correctly', () => {
      const res = makeRes();
      error(res, 422, 'VALIDATION_FAILED', 'Bad input', ['field x required']);
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code:    'VALIDATION_FAILED',
            message: 'Bad input',
            details: ['field x required'],
          }),
        })
      );
    });

    it('defaults details to empty array when not provided', () => {
      const res = makeRes();
      error(res, 404, 'NOT_FOUND', 'Resource not found');
      const payload = res.json.mock.calls[0][0];
      expect(payload.error.details).toEqual([]);
    });

    it('always includes a requestId in meta', () => {
      const res = makeRes();
      error(res, 500, 'ERR', 'oops');
      const payload = res.json.mock.calls[0][0];
      expect(typeof payload.meta.requestId).toBe('string');
    });
  });
});
