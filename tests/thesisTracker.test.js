// tests/thesisTracker.test.js — máquina de estados del tracker de tesis.
// Cada caso arma velas diarias sintéticas y compara contra el cálculo a mano.

import { describe, it, expect } from 'vitest';
import { replayThesis, initialState, STATUS } from '../lib/thesisTracker.js';

// Genera fechas hábiles (lun-vie) consecutivas desde `start` (YYYY-MM-DD).
function sessions(start, n) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Velas planas en `base`, con overrides por índice de sesión (0 = día de emisión).
function flat(start, n, base, overrides = {}) {
  return sessions(start, n).map((date, i) => ({
    date, o: base, h: base + 1, l: base - 1, c: base, ...(overrides[i] || {}),
  }));
}

const LIMIT = {
  id: 'TST-2026-06-01', ticker: 'TST', entry_date: '2026-06-01',
  rating: 'BUY', order_type: 'LIMIT', ref_price: 110, spy_ref: 500,
  entry: 100, stop: 90, tp1: 115, target_3m: 130, valid_until: '2026-07-13',
};
const MARKET = { ...LIMIT, id: 'MKT-2026-06-01', order_type: 'MARKET', entry: 110, ref_price: 110, stop: 100, tp1: 125, target_3m: 140, valid_until: null };

describe('initialState', () => {
  it('LIMIT arranca ARMADA, MARKET arranca ABIERTA al precio de referencia, sin orden arranca SIN_ORDEN', () => {
    expect(initialState(LIMIT).status).toBe(STATUS.ARMADA);
    expect(initialState(MARKET)).toMatchObject({ status: STATUS.ABIERTA, filled_at: '2026-06-01', fill_price: 110 });
    expect(initialState({ ...LIMIT, rating: 'WATCH', order_type: 'SIN_ORDEN' }).status).toBe(STATUS.SIN_ORDEN);
  });
});

describe('orden LIMIT', () => {
  it('se ejecuta cuando el mínimo toca el limit', () => {
    const candles = flat('2026-06-01', 10, 110, { 4: { o: 104, h: 105, l: 99, c: 101 } });
    const { thesis, marks } = replayThesis(LIMIT, candles);
    expect(thesis.status).toBe(STATUS.ABIERTA);
    expect(thesis.filled_at).toBe(candles[4].date);
    expect(thesis.fill_price).toBe(100);
    expect(thesis.sessions_to_fill).toBe(4);
    expect(marks).toHaveLength(10);
    expect(marks[3].status).toBe(STATUS.ARMADA);
    expect(marks[4].status).toBe(STATUS.ABIERTA);
  });

  it('si abre con gap bajo el limit (pero sobre el stop) se ejecuta al precio de apertura', () => {
    const candles = flat('2026-06-01', 6, 110, { 2: { o: 96, h: 98, l: 95, c: 97 } });
    const { thesis } = replayThesis(LIMIT, candles);
    expect(thesis.status).toBe(STATUS.ABIERTA);
    expect(thesis.fill_price).toBe(96);
  });

  it('no se ejecuta el mismo día de la emisión aunque el rango toque el limit', () => {
    const candles = flat('2026-06-01', 3, 110, { 0: { o: 110, h: 111, l: 99, c: 110 } });
    expect(replayThesis(LIMIT, candles).thesis.status).toBe(STATUS.ARMADA);
  });

  it('vence (EXPIRADA) al pasar valid_until sin tocar el limit', () => {
    const candles = flat('2026-06-01', 40, 110);
    const { thesis } = replayThesis(LIMIT, candles);
    expect(thesis.status).toBe(STATUS.EXPIRADA);
    expect(thesis.closed_at).toBe('2026-07-14'); // primera sesión posterior al 13-jul
    expect(thesis.filled_at).toBeNull();
  });

  it('sin valid_until vence a las 30 sesiones', () => {
    const candles = flat('2026-06-01', 40, 110);
    const { thesis } = replayThesis({ ...LIMIT, valid_until: null }, candles);
    expect(thesis.status).toBe(STATUS.EXPIRADA);
    expect(thesis.closed_at).toBe(candles[31].date);
  });

  it('queda INVALIDADA si abre bajo el stop antes de ejecutarse', () => {
    const candles = flat('2026-06-01', 6, 110, { 3: { o: 88, h: 92, l: 85, c: 90 } });
    const { thesis } = replayThesis(LIMIT, candles);
    expect(thesis.status).toBe(STATUS.INVALIDADA);
    expect(thesis.closed_at).toBe(candles[3].date);
    expect(thesis.fill_price).toBeNull();
  });

  it('si el mismo día atraviesa limit y stop sin gap: se ejecuta y sale por stop (−1R)', () => {
    const candles = flat('2026-06-01', 6, 110, { 3: { o: 105, h: 106, l: 88, c: 89 } });
    const { thesis } = replayThesis(LIMIT, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_STOP);
    expect(thesis.fill_price).toBe(100);
    expect(thesis.r_multiple).toBeCloseTo(-1, 6);
  });

  it('el máximo del día de ejecución no cuenta como objetivo (pudo ocurrir antes del fill)', () => {
    const candles = flat('2026-06-01', 6, 110, { 3: { o: 120, h: 135, l: 99, c: 104 } });
    expect(replayThesis(LIMIT, candles).thesis.status).toBe(STATUS.ABIERTA);
  });
});

describe('posición ABIERTA', () => {
  it('stop: cierra al nivel del stop con −1R', () => {
    const candles = flat('2026-06-01', 8, 110, { 5: { o: 104, h: 105, l: 99, c: 100 } });
    const { thesis } = replayThesis(MARKET, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_STOP);
    expect(thesis.closed_at).toBe(candles[5].date);
    expect(thesis.close_price).toBe(100);
    expect(thesis.r_multiple).toBeCloseTo(-1, 6);
  });

  it('stop con gap: cierra a la apertura, peor que −1R', () => {
    const candles = flat('2026-06-01', 8, 110, { 5: { o: 95, h: 97, l: 94, c: 96 } });
    const { thesis } = replayThesis(MARKET, candles);
    expect(thesis.close_price).toBe(95);
    expect(thesis.r_multiple).toBeCloseTo(-1.5, 6);
  });

  it('TP1 se registra sin cerrar; el cierre es en el objetivo base', () => {
    const candles = flat('2026-06-01', 12, 110, {
      4: { o: 120, h: 126, l: 119, c: 124 },
      9: { o: 135, h: 141, l: 134, c: 139 },
    });
    const { thesis } = replayThesis(MARKET, candles);
    expect(thesis.tp1_hit_at).toBe(candles[4].date);
    expect(thesis.status).toBe(STATUS.CERRADA_TP);
    expect(thesis.closed_at).toBe(candles[9].date);
    expect(thesis.close_price).toBe(140);
    expect(thesis.r_multiple).toBeCloseTo(3, 6);
  });

  it('sin objetivo base, TP1 cierra la tesis', () => {
    const candles = flat('2026-06-01', 8, 110, { 4: { o: 120, h: 126, l: 119, c: 124 } });
    const { thesis } = replayThesis({ ...MARKET, target_3m: null }, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_TP);
    expect(thesis.close_price).toBe(125);
  });

  it('caso ambiguo: el mismo día toca stop y objetivo → se asume stop', () => {
    const candles = flat('2026-06-01', 8, 110, { 3: { o: 110, h: 145, l: 98, c: 120 } });
    const { thesis } = replayThesis(MARKET, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_STOP);
    expect(thesis.close_price).toBe(100);
  });

  it('salida por tiempo: llega time_stop sin haber tocado +1R', () => {
    const candles = flat('2026-06-01', 30, 110);
    const { thesis } = replayThesis({ ...MARKET, time_stop: candles[20].date }, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_TIEMPO);
    expect(thesis.closed_at).toBe(candles[20].date);
    expect(thesis.close_price).toBe(110);
    expect(thesis.r_multiple).toBeCloseTo(0, 6);
  });

  it('time_stop no cierra si ya llegó a +1R', () => {
    const candles = flat('2026-06-01', 30, 110, { 5: { o: 118, h: 121, l: 117, c: 119 } });
    const { thesis } = replayThesis({ ...MARKET, time_stop: candles[20].date }, candles);
    expect(thesis.status).toBe(STATUS.ABIERTA);
  });

  it('cierre manual por tesis (CERRADA_TESIS) en la fecha indicada', () => {
    const candles = flat('2026-06-01', 10, 110);
    const { thesis } = replayThesis(
      { ...MARKET, manual_close: { date: candles[6].date, price: 108, reason: 'TESIS' } }, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_TESIS);
    expect(thesis.close_price).toBe(108);
    expect(thesis.r_multiple).toBeCloseTo(-0.2, 6);
  });
});

describe('SIN_ORDEN', () => {
  it('se mide 120 sesiones y ahí termina el seguimiento', () => {
    const candles = flat('2026-01-05', 140, 50);
    const { thesis, marks } = replayThesis(
      { id: 'W-1', ticker: 'W', entry_date: '2026-01-05', rating: 'AVOID', order_type: 'SIN_ORDEN', ref_price: 50 }, candles);
    expect(thesis.status).toBe(STATUS.SIN_ORDEN);
    expect(thesis.tracking_done).toBe(true);
    expect(marks).toHaveLength(121); // emisión + 120 sesiones
    expect(thesis.flags).toEqual([]);
  });
});

describe('banderas REVISAR', () => {
  const codes = (t) => t.flags.map((f) => f.code);

  it('earnings intermedio: la empresa reportó después de la emisión', () => {
    const candles = flat('2026-06-01', 15, 110);
    const { thesis } = replayThesis({ ...MARKET, next_earnings: candles[8].date }, candles);
    expect(thesis.status).toBe(STATUS.ABIERTA);
    const flag = thesis.flags.find((f) => f.code === 'EARNINGS');
    expect(flag).toBeTruthy();
    expect(flag.since).toBe(candles[8].date);
  });

  it('sin bandera de earnings si la fecha todavía no llegó', () => {
    const candles = flat('2026-06-01', 5, 110);
    expect(codes(replayThesis({ ...MARKET, next_earnings: '2026-09-01' }, candles).thesis)).not.toContain('EARNINGS');
  });

  it('ARMADA con el precio a más de 15% del limit', () => {
    const candles = flat('2026-06-01', 5, 110, { 4: { o: 118, h: 120, l: 117, c: 118 } });
    expect(codes(replayThesis(LIMIT, candles).thesis)).toContain('LIMIT_LEJOS');
  });

  it('ABIERTA con más de 60 sesiones sin llegar a +1R', () => {
    const candles = flat('2026-06-01', 63, 110);
    expect(codes(replayThesis(MARKET, candles).thesis)).toContain('SIN_1R_60');
    expect(codes(replayThesis(MARKET, candles.slice(0, 60)).thesis)).not.toContain('SIN_1R_60');
  });

  it('más de 90 días calendario sin revisión', () => {
    const candles = flat('2026-06-01', 70, 110); // 70 sesiones ≈ 97 días
    expect(codes(replayThesis(MARKET, candles).thesis)).toContain('SIN_REVISION_90D');
    expect(codes(replayThesis({ ...MARKET, reviewed_at: candles[40].date }, candles).thesis)).not.toContain('SIN_REVISION_90D');
  });

  it('cambio de régimen respecto al registrado', () => {
    const candles = flat('2026-06-01', 10, 110);
    const regimeByDate = Object.fromEntries(candles.map((c, i) => [c.date, i < 6 ? 'SPY>SMA200' : 'SPY<SMA200']));
    const { thesis } = replayThesis({ ...MARKET, regime: 'SPY>SMA200' }, candles, { regimeByDate });
    const flag = thesis.flags.find((f) => f.code === 'REGIMEN');
    expect(flag.since).toBe(candles[6].date);
  });

  it('sector fuera de la lista de sobreponderados (solo si el contexto la trae)', () => {
    const candles = flat('2026-06-01', 5, 110);
    const t = { ...MARKET, sector: 'Energy', sector_view: 'OW' };
    expect(codes(replayThesis(t, candles, { overweightSectors: ['Health Care'] }).thesis)).toContain('SECTOR');
    expect(codes(replayThesis(t, candles, { overweightSectors: ['Energy'] }).thesis)).not.toContain('SECTOR');
    expect(codes(replayThesis(t, candles).thesis)).not.toContain('SECTOR');
  });

  it('una tesis emitida sin el sector sobreponderado no lleva bandera SECTOR', () => {
    const candles = flat('2026-06-01', 5, 110);
    const t = { ...MARKET, sector: 'Energy', sector_view: 'N' };
    expect(codes(replayThesis(t, candles, { overweightSectors: ['Health Care'] }).thesis)).not.toContain('SECTOR');
  });

  it('una tesis cerrada no lleva banderas', () => {
    const candles = flat('2026-06-01', 100, 110, { 5: { o: 104, h: 105, l: 99, c: 100 } });
    expect(replayThesis(MARKET, candles).thesis.flags).toEqual([]);
  });
});

describe('marcas y rendimiento', () => {
  it('guarda SPY y ETF sectorial por día y calcula el alfa a 20 sesiones desde ref_price', () => {
    const candles = flat('2026-06-01', 25, 110, { 20: { o: 120, h: 122, l: 119, c: 121 } });
    const spy = Object.fromEntries(candles.map((c, i) => [c.date, 500 + i]));   // día 20: 520 → +4%
    const etf = Object.fromEntries(candles.map((c, i) => [c.date, 200 + i]));   // día 20: 220 → +10%
    const { thesis, marks } = replayThesis(MARKET, candles, { spy, etf });
    expect(marks[20]).toMatchObject({ thesis_id: MARKET.id, close: 121, spy_close: 520, sector_etf_close: 220 });
    expect(thesis.perf.h20.ret).toBeCloseTo(0.1, 6);
    expect(thesis.perf.h20.alpha_spy).toBeCloseTo(0.06, 6);
    expect(thesis.perf.h20.alpha_etf).toBeCloseTo(0, 6);
    expect(thesis.perf.h60).toBeNull();
    expect(thesis.perf.last.sessions).toBe(24);
  });

  it('una tesis cerrada se sigue marcando hasta 120 sesiones para medir el alfa', () => {
    const candles = flat('2026-01-05', 130, 110, { 5: { o: 104, h: 105, l: 99, c: 100 } });
    const { thesis, marks } = replayThesis({ ...MARKET, entry_date: '2026-01-05' }, candles);
    expect(thesis.status).toBe(STATUS.CERRADA_STOP);
    expect(marks).toHaveLength(121);
    expect(marks[120].status).toBe(STATUS.CERRADA_STOP);
    expect(thesis.perf.h120).not.toBeNull();
    expect(thesis.tracking_done).toBe(true);
  });

  it('es idempotente y no muta la tesis de entrada', () => {
    const candles = flat('2026-06-01', 12, 110, { 4: { o: 104, h: 105, l: 99, c: 101 } });
    const input = Object.freeze({ ...LIMIT });
    const a = replayThesis(input, candles);
    const b = replayThesis(a.thesis, candles);
    expect(b.thesis).toEqual(a.thesis);
    expect(b.marks).toEqual(a.marks);
    expect(a.thesis.last_checked).toBe(candles[11].date);
  });

  it('sin velas devuelve el estado inicial sin marcas', () => {
    const { thesis, marks } = replayThesis(LIMIT, []);
    expect(thesis.status).toBe(STATUS.ARMADA);
    expect(marks).toEqual([]);
  });
});
