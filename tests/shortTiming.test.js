// tests/shortTiming.test.js — cuándo y dónde entrar en corto (resistencias y Wyckoff).

import { describe, it, expect } from 'vitest';
import { shortTiming, toChartCandles, finalShortVerdict, accumulationState } from '../lib/shortTiming.js';

const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const bar = (i, close, { range = 1, volume = 1e6 } = {}) => ({
  date: day(i), open: close, high: close + range / 2, low: close - range / 2, close, volume,
});

// Bajada sin Spring: mínimo en 87.5, piso plano, rebote a 111, segundo piso en
// 88.5 (soporte de 2 toques) y segundo techo en 110.5. Hoy 100.
function downtrendWithResistance() {
  const out = [];
  let i = 0;
  for (; i < 120; i++) out.push(bar(i, 140 - i * 0.2));
  // Cada vela cierra bajo el mínimo anterior hasta 87.5; después seis sesiones
  // en 88 (sin cerrar sobre 88.5, así no hay Spring) y recién ahí el rebote.
  const path = [113, 110, 107, 104, 101, 98, 95, 92, 90.5, 89, 87.5, 88, 88, 88, 88, 88, 88,
    92, 97, 102, 107, 111, 107, 103, 99, 95, 91.5, 88.5, 92, 96, 100, 104, 108, 110.5, 106, 102, 99, 100];
  for (const c of path) out.push(bar(i++, c));
  return out;
}

// Clímax de venta: bajada, vela ancha con 6 veces el volumen y rally de +15%.
function sellingClimax() {
  const out = [];
  let i = 0;
  for (; i < 150; i++) out.push(bar(i, 100 - i * 0.3, { range: 1 }));
  out.push(bar(i++, 50, { range: 8, volume: 6e6 }));
  for (let k = 1; k <= 10; k++) out.push(bar(i++, 50 + k * 0.9, { range: 1.2 }));
  for (let k = 0; k < 25; k++) out.push(bar(i++, 56 - (k % 5), { range: 1 }));
  return out;
}

describe('toChartCandles', () => {
  it('convierte velas de Yahoo ({ t, o, h, l, c, v }) al formato del Chart', () => {
    const [c] = toChartCandles([{ t: Date.UTC(2026, 0, 2) / 1000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }]);
    expect(c).toEqual({ date: '2026-01-02', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
  });
});

describe('shortTiming', () => {
  it('pocas velas: sin datos', () => {
    expect(shortTiming([bar(0, 10)]).status).toBe('SIN_DATOS');
  });

  it('arma plan a mercado y límite con stop sobre la resistencia y objetivo en el soporte', () => {
    const t = shortTiming(downtrendWithResistance());
    expect(t.price).toBeCloseTo(100);
    expect(t.limit.entry).toBeGreaterThan(t.price);
    expect(t.stop).toBeGreaterThan(t.entry);
    expect(t.target).toBeLessThan(t.price);
    expect(['ORDEN_LIMITE', 'EN_RESISTENCIA', 'A_MERCADO', 'POCO_RECORRIDO']).toContain(t.status);
    expect(t.market.entry).toBeCloseTo(100);
    expect(t.market.stop).toBeGreaterThan(t.limit.entry);
  });

  it('bloquea el corto si hay acumulación Wyckoff (clímax de venta y rally)', () => {
    const t = shortTiming(sellingClimax());
    expect(t.status).toBe('ACUMULACION');
    expect(t.reasons[0]).toMatch(/clímax|Spring/);
  });

  it('a mercado si el soporte paga el R:R con el stop sobre la resistencia', () => {
    const t = shortTiming(downtrendWithResistance(), { minRR: 2 });
    expect(t.status).toBe('A_MERCADO');
    expect(t.entry).toBeCloseTo(100);
    expect(t.target).toBeCloseTo(87.5);
  });

  it('exige R:R mínimo hasta el primer soporte', () => {
    const t = shortTiming(downtrendWithResistance(), { minRR: 50 });
    expect(t.status).toBe('POCO_RECORRIDO');
  });
});

describe('finalShortVerdict', () => {
  it('traduce score y timing a una acción concreta', () => {
    expect(finalShortVerdict(70, { status: 'ORDEN_LIMITE' })).toBe('ORDEN LÍMITE');
    expect(finalShortVerdict(70, { status: 'EN_RESISTENCIA' })).toBe('SHORT AHORA');
    expect(finalShortVerdict(70, { status: 'A_MERCADO' })).toBe('SHORT A MERCADO');
    expect(finalShortVerdict(70, { status: 'ACUMULACION' })).toBe('NO: ACUMULACIÓN');
    expect(finalShortVerdict(70, { status: 'POCO_RECORRIDO' })).toBe('NO: SOPORTE CERCA');
    expect(finalShortVerdict(70, { status: 'SIN_RESISTENCIA' })).toBe('NO: SIN RESISTENCIA');
    expect(finalShortVerdict(55, { status: 'ORDEN_LIMITE' })).toBe('VIGILAR');
    expect(finalShortVerdict(30, { status: 'ORDEN_LIMITE' })).toBe('EVITAR');
  });
});

describe('accumulationState', () => {
  const flat = (n, c) => Array.from({ length: n }, (_, i) => bar(i, c));

  it('Spring con el mínimo intacto bloquea', () => {
    const candles = flat(100, 20);
    const st = accumulationState(candles, [{ type: 'Spring', idx: 80, price: 19, status: 'pendiente', date: 'x' }]);
    expect(st.blocking).toBe(true);
  });

  it('Spring con el mínimo roto no bloquea (es debilidad)', () => {
    const candles = [...flat(90, 20), ...flat(10, 17)];
    const st = accumulationState(candles, [{ type: 'Spring', idx: 80, price: 19, status: 'pendiente', date: 'x' }]);
    expect(st.blocking).toBe(false);
  });

  it('SOS fallido después del Spring no bloquea', () => {
    const candles = flat(100, 20);
    const st = accumulationState(candles, [
      { type: 'Spring', idx: 70, price: 15, status: 'pendiente', date: 'a' },
      { type: 'SOS', idx: 80, price: 25, level: 24, date: 'b' },
    ]);
    expect(st.blocking).toBe(false);
    expect(st.label).toMatch(/SOS fallido/);
  });

  it('clímax de venta reciente con el mínimo intacto bloquea', () => {
    const st = accumulationState(flat(100, 20), [{ type: 'SC', idx: 90, price: 19, date: 'x' }]);
    expect(st.blocking).toBe(true);
  });
});
