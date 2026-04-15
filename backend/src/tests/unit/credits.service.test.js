'use strict';

jest.mock('../../database/db', () => ({ query: jest.fn() }));

const pool = require('../../database/db');
const { applyExchangeCredits, hasEnoughCredits } = require('../../services/credits.service');

beforeEach(() => jest.clearAllMocks());

describe('applyExchangeCredits', () => {
  it('increments teacher and decrements learner balances', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await applyExchangeCredits(client, 'teacher-id', 'learner-id');
    expect(client.query).toHaveBeenCalledTimes(2);
    // First call: teacher +1
    expect(client.query.mock.calls[0][1]).toEqual(['teacher-id']);
    expect(client.query.mock.calls[0][0]).toContain('credit_balance + 1');
    // Second call: learner -1
    expect(client.query.mock.calls[1][1]).toEqual(['learner-id']);
    expect(client.query.mock.calls[1][0]).toContain('GREATEST');
  });
});

describe('hasEnoughCredits', () => {
  it('returns true when credit_balance > 0', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ credit_balance: 3 }] });
    const result = await hasEnoughCredits('u1');
    expect(result).toBe(true);
  });

  it('returns false when credit_balance is 0', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ credit_balance: 0 }] });
    const result = await hasEnoughCredits('u1');
    expect(result).toBe(false);
  });

  it('returns false when user not found (undefined row)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await hasEnoughCredits('ghost');
    expect(result).toBe(false);
  });
});
