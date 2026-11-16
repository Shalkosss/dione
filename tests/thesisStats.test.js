// tests/thesisStats.test.js — métricas de eficiencia (THESIS_LOG.md sección 6).

import { describe, it, expect } from 'vitest';
import { computeThesisStats } from '../lib/thesisStats.js';

const h = (alpha) => ({ ret: alpha + 0.02, spy: 0.02, etf: 0.01, alpha_spy: alpha, alpha_etf: alpha + 0.01 });
const t = (over) => ({
  rating: 'BUY', conviction: 4, sector: 'Tech', sector_view: 'OW', trend_label: 'EN ZONA',
  order_type: 'MARKET', status: 'ABIERTA', perf: { h20: null, h60: null, h120: null, last: null }, ...over,
});

const THESES = [
  t({ order_type: 'LIMIT', status: 'CERRADA_TP', filled_at: '2026-06-05', sessions_to_fill: 4, r_multiple: 2, perf: { h20: h(0.10), h60: h(0.20), h120: null } }),
  t({ order_type: 'LIMIT', status: 'CERRADA_STOP', filled_at: '2026-06-09', sessions_to_fill: 10, r_multiple: -1, perf: { h20: h(-0.04), h60: null, h120: null } }),
  t({ order_type: 'LIMIT', status: 'EXPIRADA', filled_at: null, perf: { h20: h(0.06), h60: null, h120: null, last: { ret: 0.25, alpha_spy: 0.2 } } }),
  t({ order_type: 'LIMIT', status: 'ARMADA', filled_at: null }),
  t({ rating: 'WATCH', conviction: 3, order_type: 'SIN_ORDEN', status: 'SIN_ORDEN', sector: 'Energy', sector_view: 'N', perf: { h20: h(-0.02), h60: null, h120: null } }),
  t({ status: 'CERRADA_TIEMPO', filled_at: '2026-06-01', sessions_to_fill: 0, r_multiple: 0.5, perf: { h20: h(0.02), h60: null, h120: null } }),
];

describe('computeThesisStats', () => {
  const s = computeThesisStats(THESES);

  it('cuenta por estado', () => {
    expect(s.total).toBe(6);
    expect(s.byStatus).toMatchObject({ CERRADA_TP: 1, EXPIRADA: 1, ARMADA: 1, SIN_ORDEN: 1 });
  });

  it('tasa de ejecución de LIMIT: solo órdenes resueltas (la ARMADA no cuenta)', () => {
    expect(s.limit).toMatchObject({ emitted: 4, resolved: 3, filled: 2 });
    expect(s.limit.fillRate).toBeCloseTo(2 / 3, 6);
    expect(s.limit.medianSessionsToFill).toBe(7);
  });

  it('retorno perdido en EXPIRADA', () => {
    expect(s.expired).toMatchObject({ n: 1, avgMissedRet: 0.25, avgMissedAlphaSpy: 0.2 });
  });

  it('plan de trade: acierto, R promedio y expectativa de las cerradas', () => {
    expect(s.trades.n).toBe(3);
    expect(s.trades.winRate).toBeCloseTo(2 / 3, 6);
    expect(s.trades.avgR).toBeCloseTo(0.5, 6);
    expect(s.trades.avgWinR).toBeCloseTo(1.25, 6);
    expect(s.trades.avgLossR).toBeCloseTo(-1, 6);
  });

  it('alfa contra SPY por rating, con media, mediana y n por horizonte', () => {
    const buy = s.alpha.byRating.find((g) => g.key === 'BUY');
    expect(buy.n).toBe(5);
    expect(buy.h20.n).toBe(4);
    expect(buy.h20.mean).toBeCloseTo(0.035, 6);
    expect(buy.h20.median).toBeCloseTo(0.04, 6);
    expect(buy.h60).toMatchObject({ n: 1, mean: 0.2 });
    expect(buy.h120.n).toBe(0);
    expect(s.alpha.byRating.find((g) => g.key === 'WATCH').h20.mean).toBeCloseTo(-0.02, 6);
  });

  it('agrupa también por convicción, sector, vista sectorial y etiqueta de tendencia', () => {
    expect(s.alpha.byConviction.map((g) => g.key)).toEqual(['4', '3']);
    expect(s.alpha.bySector.map((g) => g.key).sort()).toEqual(['Energy', 'Tech']);
    expect(s.alpha.bySectorView).toHaveLength(2);
    expect(s.alpha.byTrendLabel[0].key).toBe('EN ZONA');
    expect(s.alpha.overall.h20.n).toBe(5);
    expect(s.alphaEtf.overall.h20.mean).toBeCloseTo(0.034, 6);
  });

  it('con lista vacía no rompe', () => {
    const empty = computeThesisStats([]);
    expect(empty.total).toBe(0);
    expect(empty.limit.fillRate).toBeNull();
    expect(empty.trades.avgR).toBeNull();
  });
});
