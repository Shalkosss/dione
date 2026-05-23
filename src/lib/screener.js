/* ============================================================
   DIONE · screener.js
   Scoring técnico (70%) + fundamental-proxy (30%) a partir
   de candles diarios. Sin datos fundamentales externos — el
   "fundamental score" es momentum de largo plazo ajustado por
   riesgo, usando sharpe() de finance.js como kernel.
   ============================================================ */

import { fetchCandles, calcVol } from "./marketData.js";
import { sharpe } from "./finance.js";

const CACHE_KEY = "dione:screener:v1";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// ---- helpers matemáticos ----

function sma(arr, n) {
  if (!arr || arr.length < n) return null;
  return arr.slice(-n).reduce((s, x) => s + x, 0) / n;
}

// RSI con suavizado de Wilder (estándar de industria)
function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 2) return null;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss < 1e-10) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// ---- scoring ----

/* Score técnico (0–100)
   Señales: mom 3m · RSI 14 · precio vs MA200 · MA50 vs MA200
   Pesos aproximados: 30% / 25% / 25% / 20%  */
export function calcTechScore(closes) {
  if (!closes || closes.length < 50) return null;
  const n = closes.length;
  const last = closes[n - 1];
  let score = 0, factors = 0;

  // 1. Momentum 3m (~63 días de trading)
  if (n >= 63) {
    const mom = (last / closes[n - 63] - 1) * 100;
    // +30% → 90 · 0% → 50 · -30% → 10
    score += clamp(50 + mom * 1.33, 5, 97);
    factors++;
  }

  // 2. RSI 14 — sweet spot 50–65 (tendencia, no sobrecomprado)
  const rsi = calcRSI(closes, 14);
  if (rsi != null) {
    let s;
    if      (rsi < 30) s = 58;
    else if (rsi < 45) s = 38;
    else if (rsi < 55) s = 60;
    else if (rsi < 65) s = 82;
    else if (rsi < 75) s = 63;
    else               s = 28;
    score += s;
    factors++;
  }

  // 3. Precio vs MA200
  const ma200 = sma(closes, 200);
  if (ma200 != null) {
    const pctAbove = (last / ma200 - 1) * 100;
    // +20% sobre MA200 → 85 · en MA200 → 55 · -20% → 25
    score += clamp(55 + pctAbove * 1.5, 10, 95);
    factors++;
  }

  // 4. Golden / death cross (MA50 vs MA200)
  const ma50 = sma(closes, 50);
  if (ma50 != null && ma200 != null) {
    score += ma50 > ma200 ? 73 : 27;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : null;
}

/* Score "fundamental" (0–100)
   Proxy basado en momentum de largo plazo ajustado por riesgo.
   Usa sharpe() de finance.js como kernel para consistencia con
   el resto del motor cuantitativo.
   Señales: Sharpe 12m · % desde 52w high · Sharpe 6m */
export function calcFundScore(closes) {
  if (!closes || closes.length < 100) return null;
  const n = closes.length;
  const last = closes[n - 1];
  const RF = 0.043; // risk-free alineado con default del portafolio
  let score = 0, factors = 0;

  // 1. Sharpe ratio 12m (usa finance.js)
  if (n >= 252) {
    const ret12m = last / closes[n - 252] - 1;
    const vol12m = (calcVol(closes.slice(n - 252)) ?? 25) / 100;
    const sh = sharpe(ret12m, vol12m, RF);
    // Sharpe 2 → 90 · Sharpe 1 → 70 · 0 → 50 · -1 → 20
    score += clamp(50 + sh * 20, 5, 97);
    factors++;
  }

  // 2. % desde 52w high (blend valor/momentum)
  if (n >= 252) {
    const high52 = Math.max(...closes.slice(n - 252));
    const dd = (last / high52 - 1) * 100; // ≤ 0
    // En ATH (0%) → 68 · -25% → 43 · -50% → 18
    score += clamp(68 + dd * 1.0, 5, 95);
    factors++;
  }

  // 3. Sharpe 6m anualizado (usa finance.js)
  if (n >= 126) {
    const ret6m = last / closes[n - 126] - 1;
    const annRet = Math.pow(1 + ret6m, 2) - 1; // anualizar
    const vol6m = (calcVol(closes.slice(n - 126)) ?? 25) / 100;
    const sh6 = sharpe(annRet, vol6m, RF);
    score += clamp(50 + sh6 * 15, 5, 97);
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : null;
}

// Composite = 70% técnico + 30% fundamental
export function calcComposite(tech, fund) {
  if (tech == null && fund == null) return null;
  if (fund == null) return tech;
  if (tech == null) return Math.round(fund * 0.3);
  return Math.round(0.7 * tech + 0.3 * fund);
}

/* Scan completo del universo.
   Llama onProgress(ticker, data, count, total) a medida que avanza.
   Cache de 24h en localStorage para no sobrecargar el free tier. */
export async function scanUniverse(universe, onProgress) {
  for (let i = 0; i < universe.length; i++) {
    const { ticker } = universe[i];
    await sleep(150); // Yahoo Finance no tiene rate limit estricto
    let entry;
    try {
      // 420 días calendario ≈ 290 días hábiles (suficiente para MA200 + Sharpe 12m)
      const closes = await fetchCandles(ticker, 420);
      const tech = calcTechScore(closes);
      const fund = calcFundScore(closes);
      entry = {
        tech,
        fund,
        composite: calcComposite(tech, fund),
        price: closes.length > 0 ? closes[closes.length - 1] : null,
        scannedAt: Date.now(),
        error: null,
      };
    } catch (e) {
      entry = { tech: null, fund: null, composite: null, price: null, scannedAt: Date.now(), error: e.message };
    }
    onProgress?.(ticker, entry, i + 1, universe.length);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- caché ----

export function loadScreenerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { data: {}, savedAt: null };
    const { data, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL) return { data: {}, savedAt: null };
    return { data: data || {}, savedAt };
  } catch {
    return { data: {}, savedAt: null };
  }
}

export function saveScreenerCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage lleno
  }
}
