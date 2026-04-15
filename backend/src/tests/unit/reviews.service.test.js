'use strict';

const { recalculateAverageRating } = require('../../services/reviews.service');

beforeEach(() => jest.clearAllMocks());

describe('recalculateAverageRating', () => {
  it('queries AVG, updates users table, and returns the avg', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ avg: '4.25' }] })  // SELECT AVG
        .mockResolvedValueOnce({}),                           // UPDATE users
    };
    const result = await recalculateAverageRating(client, 'u1');
    expect(result).toBe('4.25');
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query.mock.calls[1][1]).toEqual(['4.25', 'u1']);
  });

  it('returns null and sets average_rating to null when no reviews exist', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ avg: null }] })
        .mockResolvedValueOnce({}),
    };
    const result = await recalculateAverageRating(client, 'u1');
    expect(result).toBeNull();
    expect(client.query.mock.calls[1][1]).toEqual([null, 'u1']);
  });
});
