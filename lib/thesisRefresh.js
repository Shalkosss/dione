// lib/thesisRefresh.js — Orquesta el refresco diario de tesis.
//
// Baja velas de Yahoo (sin key) para cada ticker, SPY y los ETFs sectoriales,
// corre replayThesis y guarda estado, banderas y marcas. Solo lógica de
// precios, sin LLM. Lo usan el cron refresh-theses y el POST /api/theses
// (para reconstruir al momento una tesis importada con fecha pasada).
//
// Las partes puras (toDailyCandles, buildRegimeByDate, planRefresh) están
// separadas de la entrada/salida para poder testearlas.

import { fetchCandlesBatch } from './yahoo.js';
import { replayThesis } from './thesisTracker.js';
import { listTheses, saveReplay } from './thesisStore.js';

export const BENCHMARK = 'SPY';
const SMA_PERIOD = 200;
const SMA_WARMUP_DAYS = 320;    // días calendario extra para tener 200 sesiones previas
const MAX_LOOKBACK_DAYS = 1500;
const DAY_MS = 86_400_000;

// Velas de lib/yahoo.js ({ t, o, h, l, c }) → [{ date, o, h, l, c }] ascendente.
export function toDailyCandles(raw) {
  const byDate = new Map();
  for (const k of raw || []) {
    const date = new Date(k.t * 1000).toISOString().slice(0, 10);
    byDate.set(date, { date, o: k.o, h: k.h, l: k.l, c: k.c });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const closesByDate = (candles) => Object.fromEntries(candles.map((c) => [c.date, c.c]));

// { fecha → 'SPY>SMA200' | 'SPY<SMA200' } desde que hay 200 cierres.
export function buildRegimeByDate(spyCandles, period = SMA_PERIOD) {
  const out = {};
  let sum = 0;
  spyCandles.forEach((c, i) => {
    sum += c.c;
    if (i >= period) sum -= spyCandles[i - period].c;
    if (i >= period - 1) out[c.date] = c.c >= sum / period ? 'SPY>SMA200' : 'SPY<SMA200';
  });
  return out;
}

// Qué símbolos bajar y cuántos días hacia atrás.
export function planRefresh(theses, now = Date.now()) {
  const symbols = new Set([BENCHMARK]);
  let oldest = now;
  for (const t of theses) {
    symbols.add(t.ticker);
    if (t.sector_etf) symbols.add(t.sector_etf);
    oldest = Math.min(oldest, Date.parse(`${t.entry_date}T00:00:00Z`));
  }
  const days = Math.ceil((now - oldest) / DAY_MS) + SMA_WARMUP_DAYS;
  return { symbols: [...symbols], days: Math.min(days, MAX_LOOKBACK_DAYS) };
}

// Parte pura del refresco: tesis + velas por símbolo → resultados de replay.
export function replayAll(theses, candlesBySymbol, extraCtx = {}) {
  const spy = candlesBySymbol[BENCHMARK] || [];
  const base = { spy: closesByDate(spy), regimeByDate: buildRegimeByDate(spy), ...extraCtx };
  return theses.map((t) => {
    const candles = candlesBySymbol[t.ticker];
    if (!candles?.length) return { id: t.id, error: `sin velas para ${t.ticker}` };
    const etf = t.sector_etf ? closesByDate(candlesBySymbol[t.sector_etf] || []) : {};
    const { thesis, marks } = replayThesis(t, candles, { ...base, etf });
    return { id: t.id, before: t.status, thesis, marks };
  });
}

/**
 * Refresca las tesis en seguimiento (o las `ids` indicadas).
 * @returns {{ checked, changed: {id, from, to}[], flagged: string[], failures: {id, error}[] }}
 */
export async function refreshTheses({ ids = [] } = {}) {
  const theses = await listTheses(ids.length ? { ids } : { onlyTrackable: true });
  if (!theses.length) return { checked: 0, changed: [], flagged: [], failures: [] };

  const { symbols, days } = planRefresh(theses);
  const rawMap = await fetchCandlesBatch(symbols, { days, concurrency: 5, throttleMs: 150 });
  const candlesBySymbol = Object.fromEntries(symbols.map((s) => [s, toDailyCandles(rawMap.get(s))]));
  if (!candlesBySymbol[BENCHMARK].length) throw new Error('Yahoo no devolvió velas de SPY');

  const results = replayAll(theses, candlesBySymbol);
  const failures = results.filter((r) => r.error).map(({ id, error }) => ({ id, error }));
  const ok = results.filter((r) => !r.error);

  for (const r of ok) {
    try {
      await saveReplay(r.thesis, r.marks);
    } catch (e) {
      failures.push({ id: r.id, error: e.message });
    }
  }
  const failed = new Set(failures.map((f) => f.id));
  const saved = ok.filter((r) => !failed.has(r.id));

  return {
    checked: saved.length,
    changed: saved.filter((r) => r.before !== r.thesis.status)
      .map((r) => ({ id: r.id, from: r.before, to: r.thesis.status })),
    flagged: saved.filter((r) => r.thesis.flags.length > 0).map((r) => r.id),
    failures,
  };
}
