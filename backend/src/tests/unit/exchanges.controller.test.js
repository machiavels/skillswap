'use strict';

process.env.JWT_SECRET = 'test_secret_key_for_jest';

jest.mock('../../database/db', () => ({
  query:   jest.fn(),
  connect: jest.fn(),
}));
jest.mock('../../services/credits.service', () => ({
  hasEnoughCredits:    jest.fn().mockResolvedValue(true),
  applyExchangeCredits: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/matching.service', () => ({
  computeCompatibilityScore: jest.fn().mockReturnValue(75),
}));

const pool            = require('../../database/db');
const creditsService  = require('../../services/credits.service');
const {
  createExchange,
  listExchanges,
  getExchange,
  respondExchange,
  confirmExchange,
} = require('../../controllers/exchanges.controller');

function makeRes() {
  const res  = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeClient(queryImpl) {
  return { query: queryImpl, release: jest.fn() };
}

beforeEach(() => jest.clearAllMocks());

// ─── createExchange ───────────────────────────────────────────────────────────

describe('createExchange', () => {
  const baseReq = {
    user: { id: 'requester-id' },
    body: { partner_id: 'partner-id', skill_id: 's1', duration_minutes: 60, desired_date: null, message: '' },
  };

  it('returns 400 when requesting exchange with yourself', async () => {
    const req = { user: { id: 'same' }, body: { ...baseReq.body, partner_id: 'same' } };
    const res = makeRes();
    await createExchange(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'INVALID_REQUEST' }),
    }));
  });

  it('returns 400 when user has insufficient credits', async () => {
    creditsService.hasEnoughCredits.mockResolvedValueOnce(false);
    const res = makeRes();
    await createExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'INSUFFICIENT_CREDITS' }),
    }));
  });

  it('returns 201 with created exchange on success', async () => {
    const row = { id: 'ex1', requester_id: 'requester-id' };
    // 4 parallel queries (availabilities x2, user_skills x2) then INSERT
    pool.query
      .mockResolvedValueOnce({ rows: [] })  // requesterSlots
      .mockResolvedValueOnce({ rows: [] })  // partnerSlots
      .mockResolvedValueOnce({ rows: [] })  // requesterWanted
      .mockResolvedValueOnce({ rows: [] })  // partnerOffered
      .mockResolvedValueOnce({ rows: [row] }); // INSERT exchange
    const res = makeRes();
    await createExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: row }));
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await createExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── listExchanges ────────────────────────────────────────────────────────────

describe('listExchanges', () => {
  it('returns exchanges for the current user (default role=all)', async () => {
    const rows = [{ id: 'ex1' }];
    pool.query.mockResolvedValueOnce({ rows });
    const req = { user: { id: 'u1' }, query: {} };
    const res = makeRes();
    await listExchanges(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: rows }));
  });

  it('filters by role=sent', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { user: { id: 'u1' }, query: { role: 'sent' } };
    await listExchanges(req, makeRes());
    expect(pool.query.mock.calls[0][0]).toContain('e.requester_id = $1');
  });

  it('filters by role=received', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { user: { id: 'u1' }, query: { role: 'received' } };
    await listExchanges(req, makeRes());
    expect(pool.query.mock.calls[0][0]).toContain('e.partner_id = $1');
  });

  it('adds status clause when status param provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const req = { user: { id: 'u1' }, query: { status: 'pending' } };
    await listExchanges(req, makeRes());
    expect(pool.query.mock.calls[0][1]).toContain('pending');
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await listExchanges({ user: { id: 'u1' }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getExchange ──────────────────────────────────────────────────────────────

describe('getExchange', () => {
  const baseReq = { user: { id: 'u1' }, params: { exchangeId: 'ex1' } };

  it('returns 404 when exchange not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await getExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the exchange on success', async () => {
    const row = { id: 'ex1' };
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [row] });
    const res = makeRes();
    await getExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: row }));
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await getExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── respondExchange ──────────────────────────────────────────────────────────

describe('respondExchange', () => {
  const baseReq = { user: { id: 'partner-id' }, params: { exchangeId: 'ex1' }, body: { action: 'accept' } };

  it('returns 400 for invalid action', async () => {
    const req = { ...baseReq, body: { action: 'invalid' } };
    const res = makeRes();
    await respondExchange(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when exchange not found', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const res = makeRes();
    await respondExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when user is not a participant', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'other', partner_id: 'other2', status: 'pending' }] });
    const res = makeRes();
    await respondExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when exchange is not pending', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'requester-id', partner_id: 'partner-id', status: 'accepted' }] });
    const res = makeRes();
    await respondExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when requester tries to accept', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'partner-id', partner_id: 'other', status: 'pending' }] });
    const req = { ...baseReq, body: { action: 'accept' } };
    const res = makeRes();
    await respondExchange(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('accepts exchange and returns updated row', async () => {
    const updated = { id: 'ex1', status: 'accepted' };
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'requester-id', partner_id: 'partner-id', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [updated] });
    const res = makeRes();
    await respondExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: updated }));
  });

  it('cancels exchange when action is cancel and user is requester', async () => {
    const updated = { id: 'ex1', status: 'cancelled' };
    pool.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'partner-id', partner_id: 'other-partner', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [updated] });
    const req = { ...baseReq, body: { action: 'cancel' } };
    const res = makeRes();
    await respondExchange(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 on DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await respondExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── confirmExchange ──────────────────────────────────────────────────────────

describe('confirmExchange', () => {
  const baseReq = { user: { id: 'requester-id' }, params: { exchangeId: 'ex1' } };

  it('returns 404 when exchange not found', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})                         // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })  // SELECT FOR UPDATE
        .mockResolvedValueOnce({})                         // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(client.release).toHaveBeenCalled();
  });

  it('returns 403 when user is not a participant', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'other', partner_id: 'other2', status: 'accepted' }] })
        .mockResolvedValueOnce({}) // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when exchange is not accepted', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'requester-id', partner_id: 'partner-id', status: 'pending' }] })
        .mockResolvedValueOnce({}) // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sets confirmed_by_requester and returns 200 (both not yet confirmed)', async () => {
    const updatedEx = { id: 'ex1', status: 'accepted', confirmed_by_requester: true, confirmed_by_partner: false };
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'requester-id', partner_id: 'partner-id', status: 'accepted', confirmed_by_requester: false, confirmed_by_partner: false }] })
        .mockResolvedValueOnce({ rows: [updatedEx] }) // UPDATE confirmed_by_requester
        .mockResolvedValueOnce({}) // COMMIT
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('marks exchange completed and applies credits when both confirm', async () => {
    const updatedEx = { id: 'ex1', status: 'accepted', confirmed_by_requester: true, confirmed_by_partner: true, requester_id: 'requester-id', partner_id: 'partner-id' };
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ requester_id: 'requester-id', partner_id: 'partner-id', status: 'accepted', confirmed_by_requester: false, confirmed_by_partner: true }] })
        .mockResolvedValueOnce({ rows: [updatedEx] }) // UPDATE confirmed_by_requester
        .mockResolvedValueOnce({}) // UPDATE status = completed
        .mockResolvedValueOnce({}) // COMMIT
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(creditsService.applyExchangeCredits).toHaveBeenCalledWith(
      client, 'partner-id', 'requester-id'
    );
  });

  it('returns 500 on unexpected error', async () => {
    const client = makeClient(
      jest.fn()
        .mockResolvedValueOnce({})               // BEGIN
        .mockRejectedValueOnce(new Error('fail')) // SELECT throws
        .mockResolvedValueOnce({})               // ROLLBACK
    );
    pool.connect.mockResolvedValueOnce(client);
    const res = makeRes();
    await confirmExchange(baseReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(client.release).toHaveBeenCalled();
  });
});
