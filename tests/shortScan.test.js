// tests/shortScan.test.js — scan short (SHORT_FRAMEWORK.md, versión con datos del snapshot).

import { describe, it, expect } from 'vitest';
import { normalizeShortRow, scoreShort, buildShortScan, mergeUniverse } from '../lib/shortScan.js';

const SECTORS = [
  { etf: 'XLK', gicsSector: 'Information Technology', aboveSma200: false, rs3m: -0.06 },
  { etf: 'XLP', gicsSector: 'Consumer Staples', aboveSma200: true, rs3m: 0.11 },
];

// Empresa en deterioro: sin caja, apalancada, bajo la SMA200, sector débil.
const WEAK = {
  symbol: 'WEAK', name: 'Weak Corp', gicsSector: 'Information Technology', marketCap: 8e9, price: 40,
  dollarVolume: 120e6, gatePass: false, preScore: 22,
  metrics: { piotroski: 3, altmanZ: 1.5, fcfYield: -0.02, netMargin: -0.05, debtToEquity: 2.6, pe: null, rsi: 45 },
  trendScore: 12, trendLabel: 'ROTA', aboveSma200: false,
  trendInputs: { distSma50: -0.04, distSma200: -0.12, mom12_1: -0.3, rsDiff63: -0.08, rsi14: 45, atr14: 1.6, ret63: -0.2 },
};

// Compounder de calidad que solo corrigió: no se shortea (anti-trap 3).
const QUALITY = {
  symbol: 'QUAL', name: 'Quality Inc', gicsSector: 'Information Technology', marketCap: 90e9, price: 220,
  dollarVolume: 900e6, gatePass: true, preScore: 96,
  metrics: { piotroski: 8, altmanZ: 7, fcfYield: 0.08, netMargin: 0.3, debtToEquity: 0.5, pe: 13, rsi: 33 },
  trendScore: 11, trendLabel: 'ROTA', aboveSma200: false,
  trendInputs: { distSma50: -0.09, distSma200: -0.1, mom12_1: -0.21, rsDiff63: -0.07, rsi14: 33, atr14: 8.6 },
};

// Largo para el par: calidad y tendencia en el mismo sector.
const LONG = {
  symbol: 'LONG', name: 'Long Co', gicsSector: 'Information Technology', marketCap: 50e9, price: 100,
  dollarVolume: 500e6, gatePass: true, preScore: 85,
  metrics: { piotroski: 7, altmanZ: 5, fcfYield: 0.05, netMargin: 0.2, debtToEquity: 0.3, pe: 22 },
  trendScore: 80, trendLabel: 'EN ZONA', aboveSma200: true,
  trendInputs: { distSma50: 0.03, distSma200: 0.12, mom12_1: 0.25, rsDiff63: 0.05, rsi14: 58, atr14: 2.5 },
};

describe('normalizeShortRow', () => {
  it('acepta filas del universo con los ratios arriba', () => {
    const r = normalizeShortRow({ symbol: 'U', marketCap: 3e9, price: 20, fcfYield: -0.01, opMargin: -0.1, debtToEquity: 3, pe: 50, roe: 0.4, trendScore: 15, aboveSma200: false });
    expect(r.metrics).toMatchObject({ fcfYield: -0.01, opMargin: -0.1, debtToEquity: 3, pe: 50 });
    expect(r.trendInputs).toEqual({});
  });
});

describe('scoreShort', () => {
  it('da un score alto a una empresa en deterioro en un sector débil', () => {
    const s = scoreShort(normalizeShortRow(WEAK), { sectors: SECTORS });
    expect(s.excluded).toBeNull();
    expect(s.breakdown.fundamental).toBeGreaterThanOrEqual(25);
    expect(s.breakdown.sector).toBe(15);
    expect(s.score).toBeGreaterThanOrEqual(65);
    expect(['CANDIDATO', 'CANDIDATO FUERTE']).toContain(s.verdict);
  });

  it('excluye al compounder de calidad aunque la tendencia esté rota', () => {
    const s = scoreShort(normalizeShortRow(QUALITY), { sectors: SECTORS });
    expect(s.excluded).toMatch(/calidad/);
  });

  it('excluye lo que no se puede shortear: cap chica, poco volumen o precio bajo', () => {
    expect(scoreShort(normalizeShortRow({ ...WEAK, marketCap: 1e9 }), { sectors: SECTORS }).excluded).toMatch(/cap/);
    expect(scoreShort(normalizeShortRow({ ...WEAK, dollarVolume: 10e6 }), { sectors: SECTORS }).excluded).toMatch(/volumen/);
    expect(scoreShort(normalizeShortRow({ ...WEAK, price: 6 }), { sectors: SECTORS }).excluded).toMatch(/precio/);
  });

  it('descarta sin deterioro fundamental (< 15 puntos)', () => {
    const healthy = { ...WEAK, gatePass: true, preScore: 60, metrics: { piotroski: 6, altmanZ: 4, fcfYield: 0.04, netMargin: 0.1, debtToEquity: 0.4, pe: 18 } };
    expect(scoreShort(normalizeShortRow(healthy), { sectors: SECTORS }).excluded).toMatch(/deterioro/);
  });

  it('marca EXTENDIDA si ya cayó demasiado (fase E)', () => {
    const extended = { ...WEAK, trendInputs: { ...WEAK.trendInputs, rsi14: 24, distSma50: -0.18 } };
    const s = scoreShort(normalizeShortRow(extended), { sectors: SECTORS });
    expect(s.flags).toContain('EXTENDIDA');
  });

  it('suma insiders vendedores y analistas bajando', () => {
    const base = scoreShort(normalizeShortRow(WEAK), { sectors: SECTORS });
    const withSm = scoreShort(normalizeShortRow(WEAK), {
      sectors: SECTORS,
      smartMoney: { WEAK: { insider: { buyUSD: 0, sellUSD: 4e6, netUSD: -4e6 }, analyst: { upgradesMinusDowngrades: -2 } } },
    });
    expect(withSm.breakdown.smartMoney).toBe(10);
    expect(withSm.score).toBe(Math.min(100, base.score + 10));
  });

  it('no muta la fila', () => {
    const row = normalizeShortRow(WEAK);
    const copy = structuredClone(row);
    scoreShort(row, { sectors: SECTORS });
    expect(row).toEqual(copy);
  });
});

describe('buildShortScan', () => {
  const rows = [WEAK, QUALITY, LONG].map(normalizeShortRow);

  it('rankea, cuenta exclusiones y arma el par neutral en el mismo sector', () => {
    const r = buildShortScan(rows, { sectors: SECTORS });
    expect(r.candidates.map((c) => c.symbol)).toEqual(['WEAK']);
    expect(r.excluded.calidad).toBe(2); // QUAL y LONG son compounders
    const pair = r.pairs.find((p) => p.short === 'WEAK');
    expect(pair.long).toBe('LONG');
    // Volatilidad: ATR% short 4%, largo 2.5% → el largo lleva 1.6 veces el monto del corto.
    expect(pair.longPerShort).toBeCloseTo(1.6);
  });

  it('respeta el tope por sector y el score mínimo', () => {
    const many = Array.from({ length: 5 }, (_, i) => normalizeShortRow({ ...WEAK, symbol: `W${i}` }));
    expect(buildShortScan(many, { sectors: SECTORS, perSector: 2 }).candidates).toHaveLength(2);
    expect(buildShortScan(many, { sectors: SECTORS, minScore: 101 }).candidates).toHaveLength(0);
  });
});

describe('mergeUniverse', () => {
  it('usa la fila del snapshot cuando existe y suma las del universo que faltan', () => {
    const merged = mergeUniverse({ WEAK, LONG }, [{ symbol: 'WEAK', price: 1 }, { symbol: 'NEW', price: 30, marketCap: 3e9 }]);
    expect(merged.map((r) => r.symbol).sort()).toEqual(['LONG', 'NEW', 'WEAK']);
    expect(merged.find((r) => r.symbol === 'WEAK').price).toBe(40);
  });
});

describe('mergeUniverse: volumen', () => {
  it('completa el volumen diario de la fila del snapshot con el del universo', () => {
    const merged = mergeUniverse({ WEAK: { ...WEAK, dollarVolume: undefined } }, [{ symbol: 'WEAK', dollarVolume: 77e6 }]);
    expect(merged[0].dollarVolume).toBe(77e6);
  });
});

import { applySmartMoney, betaFromCloses, hedgeNeeded } from '../lib/shortScan.js';

describe('applySmartMoney', () => {
  it('recalcula score y veredicto sin mutar', () => {
    const c = buildShortScan([normalizeShortRow(WEAK)], { sectors: SECTORS }).candidates[0];
    const copy = structuredClone(c);
    const out = applySmartMoney(c, { insider: { buyUSD: 0, netUSD: -2e6 } });
    expect(out.breakdown.smartMoney).toBe(6);
    expect(out.score).toBe(Math.min(100, c.score + 6));
    expect(out.flags).not.toContain('SIN_SMART_MONEY');
    expect(c).toEqual(copy);
    expect(applySmartMoney(c, null)).toBe(c);
  });
});

describe('betaFromCloses', () => {
  it('un activo que se mueve el doble del índice tiene beta 2', () => {
    const idx = [], asset = [];
    let i = 100, a = 50;
    for (let d = 0; d < 40; d++) {
      const r = (d % 3 === 0 ? 0.01 : -0.004) * (d % 5 === 0 ? 2 : 1);
      i *= 1 + r; a *= 1 + 2 * r;
      const date = `2026-01-${String(d + 1).padStart(2, '0')}`;
      idx.push({ date, close: i }); asset.push({ date, close: a });
    }
    expect(betaFromCloses(asset, idx)).toBeCloseTo(2, 5);
  });

  it('pocos datos devuelve null', () => {
    expect(betaFromCloses([{ date: 'a', close: 1 }], [])).toBeNull();
  });
});

describe('hedgeNeeded', () => {
  it('calcula el corto para bajar la exposición beta al objetivo', () => {
    const h = hedgeNeeded([{ ticker: 'SMH', value: 600, beta: 1.8 }, { ticker: 'XLP', value: 400, beta: 0.5 }], { totalValue: 1000, targetNet: 0.5 });
    expect(h.betaDollars).toBeCloseTo(1280);
    expect(h.netBeta).toBeCloseTo(1.28);
    expect(h.shortBetaDollars).toBeCloseTo(780);
  });

  it('sin exceso no pide corto', () => {
    expect(hedgeNeeded([{ value: 100, beta: 0.3 }], { totalValue: 1000 }).shortBetaDollars).toBe(0);
  });
});

describe('datos parciales', () => {
  it('una fila del universo se mide sobre los ítems que tiene', () => {
    const uni = normalizeShortRow({
      symbol: 'UNI', gicsSector: 'Information Technology', marketCap: 20e9, price: 50, dollarVolume: 300e6,
      gatePass: false, fcfYield: -0.01, opMargin: 0.05, debtToEquity: 2.5, pe: 60, trendScore: 15, aboveSma200: false,
    });
    const s = scoreShort(uni, { sectors: SECTORS });
    // fundamental: (6 + 5 + 4) de 20 disponibles → 26 de 35; tendencia: 16 de 16 → 30.
    expect(s.breakdown.fundamental).toBe(26);
    expect(s.breakdown.technical).toBe(30);
    expect(s.breakdown.valuation).toBe(10);
    expect(s.flags).toContain('DATOS_PARCIALES');
  });
});

import { trendInputsFromCandles, withCandleInputs } from '../lib/shortScan.js';

describe('exclusiones v1.1', () => {
  it('excluye fondos y trusts', () => {
    expect(scoreShort(normalizeShortRow({ ...WEAK, name: 'SPDR Gold Trust' }), { sectors: SECTORS }).excluded).toMatch(/fondo/);
  });

  it('en financieras no cuentan deuda, FCF ni gate: sin datos suficientes', () => {
    const bank = normalizeShortRow({ ...WEAK, gicsSector: 'Financials', metrics: { fcfYield: -0.1, debtToEquity: 9, netMargin: 0.2 } });
    expect(scoreShort(bank, { sectors: SECTORS }).excluded).toMatch(/insuficientes/);
  });

  it('salud sin ganancias es riesgo binario', () => {
    const bio = normalizeShortRow({ ...WEAK, gicsSector: 'Health Care' });
    expect(scoreShort(bio, { sectors: SECTORS }).excluded).toMatch(/binario/);
  });
});

describe('trendInputsFromCandles', () => {
  const mk = (closes) => closes.map((c, i) => ({ date: `d${i}`, h: c * 1.01, l: c * 0.99, c }));

  it('serie que cae: bajo las medias, momentum y RSI bajos', () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 * 0.997 ** i);
    const t = trendInputsFromCandles(mk(closes), mk(Array(300).fill(50)));
    expect(t.distSma50).toBeLessThan(0);
    expect(t.distSma200).toBeLessThan(t.distSma50);
    expect(t.mom12_1).toBeLessThan(0);
    expect(t.rsi14).toBeLessThan(5);
    expect(t.rsDiff63).toBeLessThan(0);
    expect(t.atr14).toBeGreaterThan(0);
  });

  it('pocas velas devuelve vacío', () => {
    expect(trendInputsFromCandles(mk([1, 2, 3]))).toEqual({});
  });

  it('withCandleInputs no pisa lo que la fila ya tenía', () => {
    const row = normalizeShortRow({ ...WEAK });
    const out = withCandleInputs(row, { atr14: 99, rsi14: 10 });
    expect(out.trendInputs.atr14).toBe(1.6);
    expect(row.trendInputs.atr14).toBe(1.6);
  });
});

describe('salud sin datos de margen', () => {
  it('sin P/E y con FCF negativo también es binario', () => {
    const bio = normalizeShortRow({ symbol: 'BIO', gicsSector: 'Health Care', marketCap: 5e9, price: 30, dollarVolume: 80e6, gatePass: false, fcfYield: -0.05, debtToEquity: 0.1, trendScore: 10, aboveSma200: false });
    expect(scoreShort(bio, { sectors: SECTORS }).excluded).toMatch(/binario/);
  });
});

describe('largo del par', () => {
  it('no usa una empresa chica o ilíquida como largo', () => {
    const tiny = normalizeShortRow({ ...LONG, symbol: 'TINY', marketCap: 1.1e9 });
    const r = buildShortScan([normalizeShortRow(WEAK), tiny], { sectors: SECTORS });
    expect(r.pairs[0].long).toBeNull();
    expect(r.pairs[0].hedgeEtf).toBe('XLK');
  });
});

describe('sin capitalización', () => {
  it('pasa si mueve más de $200M diarios, con bandera SIN_CAP', () => {
    const s = scoreShort(normalizeShortRow({ ...WEAK, marketCap: 0, dollarVolume: 900e6 }), { sectors: SECTORS });
    expect(s.excluded).toBeNull();
    expect(s.flags).toContain('SIN_CAP');
    expect(scoreShort(normalizeShortRow({ ...WEAK, marketCap: 0, dollarVolume: 100e6 }), { sectors: SECTORS }).excluded).toMatch(/cap/);
  });
});
