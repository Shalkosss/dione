// lib/prices.js — Fuente robusta de precios: Finnhub primario + Yahoo fallback.
//
// Stooq dejó de servir CSV plano (anti-bot JS challenge desde mid-2026) y los
// crons no pueden resolver el PoW. Esta capa reemplaza fetchPrices de stooq.js:
//   1. Pide quote a Finnhub (rápido, batch throttle 25/s).
//   2. Los símbolos que Finnhub no resolvió, los retoma Yahoo /v8/finance/chart.
// Devuelve Map sym → { price, name? }. Name viene null acá; refresh-gems lo
// pisa con lo que enrichSectors haya cacheado en symbol_metadata.

import { fetchCandlesBatch } from './yahoo.js';

const FINNHUB_KEY = process.env.FINNHUB_KEY || '';

async function finnhubQuote(symbol) {
  if (!FINNHUB_KEY) return null;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    // Finnhub devuelve {c: current, h, l, o, pc, t, d, dp}. Cuando no conoce el
    // símbolo: { c: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }.
    if (!j || typeof j.c !== 'number' || j.c <= 0) return null;
    return j.c;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function finnhubBatch(symbols, { concurrency = 5, throttleMs = 40 } = {}) {
  const out = new Map();
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (idx < symbols.length) {
      const s = symbols[idx++];
      const price = await finnhubQuote(s);
      if (price != null) out.set(s, { price, name: null });
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}

// Yahoo fallback: usa el último close del rango corto (5d, 1d interval).
async function yahooLastClose(symbols) {
  const candles = await fetchCandlesBatch(symbols, { days: 7, concurrency: 5, throttleMs: 200 });
  const out = new Map();
  for (const [sym, arr] of candles) {
    if (!arr || arr.length === 0) continue;
    const last = arr[arr.length - 1];
    if (last?.c > 0) out.set(sym, { price: last.c, name: null });
  }
  return out;
}

// API drop-in que reemplaza lib/stooq.js → fetchPrices.
export async function fetchPrices(symbols) {
  if (!symbols.length) return new Map();
  const fromFinnhub = await finnhubBatch(symbols);
  const missing = symbols.filter((s) => !fromFinnhub.has(s));
  if (!missing.length) return fromFinnhub;
  const fromYahoo = await yahooLastClose(missing);
  for (const [k, v] of fromYahoo) fromFinnhub.set(k, v);
  return fromFinnhub;
}
