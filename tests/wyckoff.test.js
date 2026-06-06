// tests/wyckoff.test.js — sanity checks de los indicadores y de la heurística
// de detección de fase Wyckoff. Vitest.

import { describe, it, expect } from 'vitest';
import {
  computeSMA, computeRSI, computeATR, computeOBV, computeADLine,
  linearSlope, detectWyckoffPhase,
} from '../lib/wyckoff.js';

describe('computeSMA', () => {
  it('null hasta llenar la ventana, luego promedio correcto', () => {
    const sma = computeSMA([1, 2, 3, 4, 5], 3);
    expect(sma[0]).toBe(null);
    expect(sma[1]).toBe(null);
    expect(sma[2]).toBe(2);   // (1+2+3)/3
    expect(sma[3]).toBe(3);   // (2+3+4)/3
    expect(sma[4]).toBe(4);   // (3+4+5)/3
  });

  it('devuelve null array si values < period', () => {
    expect(computeSMA([1, 2], 5)).toEqual([null, null]);
  });
});

describe('computeRSI', () => {
  it('uptrend monotónico → RSI ≈ 100', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const rsi = computeRSI(closes, 14);
    expect(rsi[rsi.length - 1]).toBeGreaterThan(95);
  });

  it('downtrend monotónico → RSI ≈ 0', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 - i);
    const rsi = computeRSI(closes, 14);
    expect(rsi[rsi.length - 1]).toBeLessThan(5);
  });
});

describe('linearSlope', () => {
  it('serie creciente → slope positivo', () => {
    const s = linearSlope([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeCloseTo(1, 5);
  });

  it('serie plana → slope 0', () => {
    expect(linearSlope([5, 5, 5, 5, 5], 5)).toBeCloseTo(0, 6);
  });

  it('null si window > length', () => {
    expect(linearSlope([1, 2], 10)).toBe(null);
  });
});

describe('computeATR', () => {
  it('devuelve valores válidos en zona suficiente', () => {
    const highs = Array.from({ length: 30 }, (_, i) => 100 + i + 1);
    const lows = Array.from({ length: 30 }, (_, i) => 100 + i - 1);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const atr = computeATR(highs, lows, closes, 14);
    expect(atr[13]).not.toBe(null);
    expect(atr[29]).toBeGreaterThan(0);
  });
});

describe('computeOBV', () => {
  it('precio up → OBV suma volumen', () => {
    const closes = [10, 11, 12, 13];
    const vols = [100, 100, 100, 100];
    const obv = computeOBV(closes, vols);
    expect(obv).toEqual([0, 100, 200, 300]);
  });
});

describe('detectWyckoffPhase', () => {
  it('chop / pocos datos → phase null', () => {
    const candles = Array.from({ length: 40 }, (_, i) => ({
      t: i, o: 100, h: 101, l: 99, c: 100, v: 1000,
    }));
    const res = detectWyckoffPhase(candles);
    expect(res.phase).toBe(null);
  });

  it('fixture sintético con SC + AR + Spring → detecta evento SC y phase no-null', () => {
    // construyo 250 barras: downtrend → SC (gran range + volume) → rebote (AR)
    // → range lateral → Spring (close < min recent low con vol bajo, recovera).
    const c = [];
    for (let i = 0; i < 100; i++) {
      // downtrend desde 100 → 60
      const close = 100 - i * 0.4;
      c.push({ t: i, o: close + 0.5, h: close + 1, l: close - 1, c: close, v: 1_000_000 });
    }
    // SC: barra ancha de capitulación
    c.push({ t: 100, o: 60, h: 60.5, l: 50, c: 52, v: 8_000_000 });
    // AR: rebote 12% en 8 barras
    for (let i = 101; i < 110; i++) {
      const close = 52 + (i - 100) * 0.9;
      c.push({ t: i, o: close - 0.2, h: close + 0.5, l: close - 0.5, c: close, v: 1_500_000 });
    }
    // rango lateral 110-180 con leve subida en A/D (volumen mayor en up days)
    for (let i = 110; i < 180; i++) {
      const base = 60;
      const isUp = i % 2 === 0;
      const close = base + (Math.sin(i / 5) * 3);
      c.push({
        t: i,
        o: close - 0.3,
        h: close + 1.2,
        l: close - 1.2,
        c: close,
        v: isUp ? 1_400_000 : 800_000,
      });
    }
    // Spring: rompe el min del rango con vol bajo y recovera
    const minLow60 = Math.min(...c.slice(-60).map((x) => x.l));
    c.push({ t: 180, o: minLow60, h: minLow60 + 0.5, l: minLow60 - 2, c: minLow60 - 1.5, v: 500_000 });
    // recovery rápida 5 barras
    for (let i = 181; i < 186; i++) {
      const close = minLow60 + 1;
      c.push({ t: i, o: close, h: close + 1, l: close - 0.3, c: close, v: 1_100_000 });
    }
    // continúa sin hacer new low
    for (let i = 186; i < 260; i++) {
      const close = minLow60 + 2 + (i - 186) * 0.15;
      c.push({ t: i, o: close - 0.2, h: close + 0.6, l: close - 0.4, c: close, v: 1_200_000 });
    }

    const res = detectWyckoffPhase(c);
    const types = res.events.map((e) => e.type);
    expect(types).toContain('SC');
    expect(res.phase).not.toBe(null);
    // confidence > 0 cuando detectó algo
    expect(res.confidence).toBeGreaterThan(0);
  });
});
