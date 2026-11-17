// src/lib/priceHistory.js — Velas diarias con fecha, vía /api/candles (Yahoo, sin key).
// Cache en memoria por sesión para no repetir descargas al cambiar de página.

const TTL_MS = 20 * 60 * 1000;
const cache = new Map(); // `${ticker}:${calDays}` → { at, promise }

const isoDate = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

async function download(ticker, calDays) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - calDays * 86400;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`/api/candles/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const result = (await res.json())?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result?.timestamp || !quote) return [];
    const adj = result.indicators?.adjclose?.[0]?.adjclose;
    return result.timestamp
      .map((ts, i) => ({ date: isoDate(ts), close: adj?.[i] ?? quote.close?.[i], rawClose: quote.close?.[i], high: quote.high?.[i], low: quote.low?.[i], volume: quote.volume?.[i] }))
      .filter((c) => Number.isFinite(c.close) && c.close > 0);
  } catch {
    return []; // sin red o ticker desconocido: la página muestra "sin datos"
  } finally {
    clearTimeout(timer);
  }
}

// Serie diaria [{ date, close, rawClose, high, low, volume }]. `close` es el ajustado.
export function fetchSeries(ticker, calDays = 400) {
  const key = `${ticker}:${calDays}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = download(ticker, calDays);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

// Varias series a la vez, de a `concurrency`. Devuelve { ticker: serie }.
export async function fetchMany(tickers, calDays = 400, concurrency = 5) {
  const unique = [...new Set(tickers)];
  const out = {};
  let next = 0;
  const worker = async () => {
    while (next < unique.length) {
      const ticker = unique[next++];
      out[ticker] = await fetchSeries(ticker, calDays);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return out;
}

export function clearPriceCache() {
  cache.clear();
}

// Días calendario necesarios para cubrir desde `isoStart` hasta hoy, con margen.
export function daysSince(isoStart, margin = 15) {
  const ms = Date.now() - Date.parse(`${isoStart}T00:00:00Z`);
  return Math.max(60, Math.ceil(ms / 86400000) + margin);
}
