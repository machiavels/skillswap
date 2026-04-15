'use strict';

const errorHandler = require('../../middlewares/errorHandler');

function makeReqRes() {
  const req  = { id: 'req-test-123' };
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return { req, res };
}

describe('errorHandler middleware', () => {
  it('uses err.status and exposes the message for 4xx errors', () => {
    const { req, res } = makeReqRes();
    const err = { status: 404, message: 'Not found', code: 'NOT_FOUND' };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Not found' }),
        meta:  expect.objectContaining({ requestId: 'req-test-123' }),
      })
    );
  });

  it('uses err.statusCode as fallback when err.status is absent', () => {
    const { req, res } = makeReqRes();
    errorHandler({ statusCode: 403, message: 'Forbidden' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('defaults to 500 and hides the message for unhandled errors', () => {
    const { req, res } = makeReqRes();
    const err = new Error('db exploded');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Internal server error.' }),
      })
    );
  });

  it('defaults to 500 when err has no status at all', () => {
    const { req, res } = makeReqRes();
    errorHandler({}, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('falls back to INTERNAL_ERROR code when err.code is absent', () => {
    const { req, res } = makeReqRes();
    errorHandler({ status: 500, message: 'Oops' }, req, res, jest.fn());
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('INTERNAL_ERROR');
  });
});
