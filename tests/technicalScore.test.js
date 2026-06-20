// tests/technicalScore.test.js — sanity de la doble vía v3.
// No reemplaza la validación con data real (TILE/ITRN), pero asegura que el
// framework distingue setups fuertes de débiles y que el breakdown tiene la
// forma documentada.

import { describe, it, expect } from 'vitest';
import { computeTechnicalScore } from '../lib/technicalScore.js';

// --- helpers para generar series sintéticas de N días ---
function buildCandles({ n = 300, start = 100, drift = 0, vol = 0.01, volume = 5_000_000, breakoutAt = null }) {
  const candles = [];
  let price = start;
  let baseT = Math.floor(Date.UTC(2024, 0, 1) / 1000);
  for (let i = 0; i < n; i++) {
    // drift lineal + noise determinístico (sin Math.random para tests reproducibles)
    const noise = ((Math.sin(i * 1.7) + Math.cos(i * 0.5)) * 0.5) * vol;
    price = price * (1 + drift + noise);
    const o = price * (1 - vol * 0.3);
    const c = price;
    const h = Math.max(o, c) * (1 + vol * 0.4);
    const l = Math.min(o, c) * (1 - vol * 0.4);
    let v = volume;
    if (breakoutAt != null && i === breakoutAt) v = volume * 3; // spike de volumen
    candles.push({ t: baseT + i * 86400, o, h, l, c, v });
  }
  return candles;
}

describe('computeTechnicalScore v3', () => {
  it('serie corta → score null con reason insufficient_data', () => {
    const candles = buildCandles({ n: 100, drift: 0.001 });
    const out = computeTechnicalScore(candles);
    expect(out.score).toBe(null);
    expect(out.reason).toBe('insufficient_data');
  });

  it('uptrend fuerte sostenido (drift +0.4%/d, breakout reciente) → score >= 50', () => {
    // 300 días de drift +0.4% → ~+230% total. Golden cross ocurre temprano.
    // El golden cross termina viejo (>250d), capeado a 8pts. Pero el resto del
    // trend track (52w high, momentum, OBV/CMF, RSI, volume) debe sumar fuerte.
    const candles = buildCandles({ n: 300, drift: 0.004, vol: 0.008, breakoutAt: 280 });
    const out = computeTechnicalScore(candles);
    expect(out.score).not.toBe(null);
    expect(out.score).toBeGreaterThanOrEqual(50);
    expect(out.breakdown).toHaveProperty('trendTrack');
    expect(out.breakdown).toHaveProperty('wyckoffTrack');
    expect(out.breakdown).toHaveProperty('composite');
    expect(out.breakdown).toHaveProperty('viaUsed');
    expect(out.breakdown).toHaveProperty('goldenCrossAge');
    expect(out.breakdown).toHaveProperty('momentum12_1');
  });

  it('downtrend sostenido (drift -0.2%/d) → score <= 25', () => {
    const candles = buildCandles({ n: 300, drift: -0.002, vol: 0.01 });
    const out = computeTechnicalScore(candles);
    expect(out.score).not.toBe(null);
    expect(out.score).toBeLessThanOrEqual(25);
    expect(out.breakdown.goldenCrossAge).toBe(null); // nunca cruzó hacia arriba
  });

  it('breakdown tiene la forma del contrato v3', () => {
    const candles = buildCandles({ n: 300, drift: 0.002 });
    const out = computeTechnicalScore(candles);
    const keys = ['trendTrack', 'wyckoffTrack', 'composite', 'bonuses', 'viaUsed',
                  'goldenCrossAge', 'rsi', 'cmf', 'momentum12_1', 'wyckoffPhase'];
    for (const k of keys) expect(out.breakdown).toHaveProperty(k);
    expect(['trend', 'wyckoff']).toContain(out.breakdown.viaUsed);
  });
});
