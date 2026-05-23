/* ============================================================
   DIONE · marketData.js
   Integración Finnhub API — precios e históricos.
   Vol y beta calculadas con datos reales (~90 días de trading).
   ============================================================ */

const BASE = "https://finnhub.io/api/v1";
const CACHE_KEY = "dione:marketdata:v1";

// Tickers sin cotización en bolsa — se omiten en las llamadas API
const NON_TRADEABLE = new Set(["CASH", "USD", "BRL", "ARS", "PEN"]);

// Proxy de mercado para cálculo de beta
export const MARKET_PROXY = "SPY";

function apiKey() {
  return import.meta.env.VITE_FINNHUB_KEY || "";
}

export function hasApiKey() {
  return !!apiKey();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiFetch(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const r = await fetch(`${BASE}${path}&token=${apiKey()}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Finnhub HTTP ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchQuote(ticker) {
  return apiFetch(`/quote?symbol=${encodeURIComponent(ticker)}`);
}

// Devuelve array de cierres ajustados diarios (aprox. 90 días de trading).
// Usa /api/candles/{ticker} — en dev: proxy Vite → Yahoo Finance;
// en prod: Vercel serverless function (api/candles/[ticker].js).
// Esto evita el bloqueo CORS que Yahoo impone en requests directas del browser.
export async function fetchCandles(ticker, calDays = 135) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - calDays * 86400;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(
      `/api/candles/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d`,
      { signal: ctrl.signal }
    );
    if (!r.ok) throw new Error(`Yahoo Finance HTTP ${r.status}`);
    const d = await r.json();
    const result = d?.chart?.result?.[0];
    if (!result) return [];
    const adj = result.indicators?.adjclose?.[0]?.adjclose;
    const reg = result.indicators?.quote?.[0]?.close;
    const closes = (adj ?? reg ?? []).filter((c) => c != null && isFinite(c));
    return closes.length >= 5 ? closes : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Vol anualizada en % (ej. 15.5). Acepta array de cierres.
export function calcVol(closes) {
  if (closes.length < 5) return null;
  const ret = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = ret.reduce((s, r) => s + r, 0) / ret.length;
  const variance = ret.reduce((s, r) => s + (r - mean) ** 2, 0) / (ret.length - 1);
  return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(1));
}

// Beta OLS vs retornos del proxy de mercado
export function calcBeta(closes, marketCloses) {
  const n = Math.min(closes.length, marketCloses.length);
  if (n < 5) return null;
  const sr = [], mr = [];
  for (let i = 1; i < n; i++) {
    sr.push(Math.log(closes[i] / closes[i - 1]));
    mr.push(Math.log(marketCloses[i] / marketCloses[i - 1]));
  }
  const meanS = sr.reduce((s, r) => s + r, 0) / sr.length;
  const meanM = mr.reduce((s, r) => s + r, 0) / mr.length;
  let cov = 0, varM = 0;
  for (let i = 0; i < sr.length; i++) {
    cov += (sr[i] - meanS) * (mr[i] - meanM);
    varM += (mr[i] - meanM) ** 2;
  }
  if (varM < 1e-12) return null;
  return parseFloat((cov / varM).toFixed(3));
}

/* Refresca datos de todos los tickers.
   Llama onProgress(ticker, data) a medida que completa cada uno.
   El proxy de mercado se descarga primero para poder calcular betas. */
export async function refreshMarketData(tickers, onProgress) {
  if (!apiKey()) throw new Error("VITE_FINNHUB_KEY no configurada");

  const fetchable = tickers.filter((t) => !NON_TRADEABLE.has(t.toUpperCase()));
  const allForCandles = [...new Set([...fetchable, MARKET_PROXY])];

  // 1 — Descargar históricos (incluyendo proxy de mercado para beta)
  const candleMap = {};
  for (const t of allForCandles) {
    await sleep(320); // respeto al rate limit free tier (60 req/min)
    try {
      candleMap[t] = await fetchCandles(t);
    } catch {
      candleMap[t] = [];
    }
  }

  const mktCloses = candleMap[MARKET_PROXY] || [];

  // 2 — Quote + métricas por ticker
  for (const t of tickers) {
    if (NON_TRADEABLE.has(t.toUpperCase())) {
      onProgress?.(t, {
        price: null, change: null, changePct: null,
        vol90: null, beta90: null,
        updatedAt: Date.now(), nonTradeable: true, error: null,
      });
      continue;
    }
    await sleep(320);
    try {
      const q = await fetchQuote(t);
      const closes = candleMap[t] || [];
      onProgress?.(t, {
        price: q.c || null,
        change: q.d ?? null,
        changePct: q.dp ?? null,
        vol90: calcVol(closes),
        beta90: mktCloses.length > 5 ? calcBeta(closes, mktCloses) : null,
        updatedAt: Date.now(),
        nonTradeable: false,
        error: null,
      });
    } catch (e) {
      onProgress?.(t, {
        price: null, change: null, changePct: null,
        vol90: null, beta90: null,
        updatedAt: Date.now(), nonTradeable: false, error: e.message,
      });
    }
  }
}

// ---- Cache en localStorage ----

export function loadMarketDataCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: {}, savedAt: null };
    const parsed = JSON.parse(raw);
    return { data: parsed.data || {}, savedAt: parsed.savedAt || null };
  } catch {
    return { data: {}, savedAt: null };
  }
}

export function saveMarketDataCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage lleno
  }
}
