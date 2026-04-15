'use strict';

const Joi = require('joi');
const { validate } = require('../../middlewares/validate.middleware');

const schema = Joi.object({
  name: Joi.string().required(),
  age:  Joi.number().optional(),
});

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  it('calls next() and strips unknown fields when body is valid', () => {
    const req  = { body: { name: 'Alice', extra: 'drop-me' } };
    const res  = makeRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'Alice' }); // unknown key stripped
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 422 with details when a required field is missing', () => {
    const req  = { body: { age: 25 } }; // name missing
    const res  = makeRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error:   'Validation failed',
        details: expect.arrayContaining([expect.stringContaining('name')]),
      })
    );
  });

  it('collects ALL errors (abortEarly: false)', () => {
    const multiSchema = Joi.object({
      a: Joi.string().required(),
      b: Joi.number().required(),
    });
    const req  = { body: {} };
    const res  = makeRes();
    const next = jest.fn();
    validate(multiSchema)(req, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.details.length).toBeGreaterThanOrEqual(2);
  });

  it('passes through a numeric field when type is correct', () => {
    const req  = { body: { name: 'Bob', age: 30 } };
    const res  = makeRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.age).toBe(30);
  });
});
