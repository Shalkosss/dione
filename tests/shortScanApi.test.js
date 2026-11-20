// tests/shortScanApi.test.js — /api/screener?mode=short con Supabase simulado.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const WEAK = {
  symbol: 'WEAK', name: 'Weak Corp', gicsSector: 'Information Technology', marketCap: 8e9, price: 40, gatePass: false, preScore: 22,
  metrics: { piotroski: 3, altmanZ: 1.5, fcfYield: -0.02, netMargin: -0.05, debtToEquity: 2.6 },
  trendScore: 12, aboveSma200: false,
  trendInputs: { distSma50: -0.04, distSma200: -0.12, mom12_1: -0.3, rsDiff63: -0.08, rsi14: 45, atr14: 1.6 },
};
const SNAP = {
  gems: { WEAK },
  meta: { market: { regime: { label: 'DEFENSIVO' }, sectors: [{ etf: 'XLK', gicsSector: 'Information Technology', aboveSma200: false, rs3m: -0.06 }] } },
};

vi.mock('../lib/store.js', () => ({
  readSnapshot: vi.fn(async () => SNAP),
  readRow: vi.fn(async (id) => (id === 'universe'
    ? { meta: { updatedAt: 'x' }, rows: [{ symbol: 'WEAK', dollarVolume: 90e6 }, { symbol: 'TINY', marketCap: 5e8, price: 4 }] }
    : null)),
  readRowField: vi.fn(async () => null),
}));

const { default: handler } = await import('../api/screener.js');

function call(query) {
  const res = { headers: {}, statusCode: 0, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return handler({ query }, res).then(() => res);
}

describe('GET /api/screener?mode=short', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve candidatos, pares, exclusiones y el régimen', async () => {
    const res = await call({ mode: 'short' });
    expect(res.statusCode).toBe(200);
    expect(res.body.candidates.map((c) => c.symbol)).toEqual(['WEAK']);
    expect(res.body.candidates[0].verdict).toMatch(/CANDIDATO/);
    expect(res.body.excluded.cap).toBe(1);
    expect(res.body.meta.regime.label).toBe('DEFENSIVO');
    expect(res.body.meta.missing).toContain('short interest');
  });

  it('respeta minScore', async () => {
    const res = await call({ mode: 'short', minScore: '99' });
    expect(res.body.candidates).toHaveLength(0);
  });
});
