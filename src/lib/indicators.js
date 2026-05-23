/* indicators.js — Indicadores técnicos puros (sin side-effects).
   Cada función recibe arrays de candles o de números y devuelve arrays
   alineados (mismo largo, null donde no hay suficientes datos). */

// True Range bar a bar.
function trueRange(c, prev) {
  if (!prev) return c.high - c.low;
  return Math.max(
    c.high - c.low,
    Math.abs(c.high - prev.close),
    Math.abs(c.low - prev.close)
  );
}

// ATR Wilder (smoothing exponencial). Devuelve array alineado con candles.
export function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trueRange(candles[i], candles[i - 1]);
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trueRange(candles[i], candles[i - 1]);
    prev = (prev * (period - 1) + tr) / period;
    out[i] = prev;
  }
  return out;
}

// SMA simple sobre array de números (closes, volumes, etc).
export function sma(arr, period) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) {
      // reset si hay gap
      sum = 0; n = 0;
      continue;
    }
    sum += arr[i]; n++;
    if (i >= period && arr[i - period] != null) { sum -= arr[i - period]; n--; }
    if (n === period) out[i] = sum / period;
  }
  return out;
}

// Bollinger Bands (period, mult desvios estándar).
export function bollinger(closes, period = 20, mult = 2) {
  const out = closes.map(() => ({ mid: null, upper: null, lower: null }));
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    if (slice.some((v) => v == null)) continue;
    const mid = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    out[i] = { mid, upper: mid + mult * std, lower: mid - mult * std };
  }
  return out;
}

// OBV — On-Balance Volume. Cumulativa, parte de 0.
export function obv(candles) {
  const out = new Array(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const prev = out[i - 1];
    const c = candles[i], p = candles[i - 1];
    if (c.close > p.close) out[i] = prev + (c.volume || 0);
    else if (c.close < p.close) out[i] = prev - (c.volume || 0);
    else out[i] = prev;
  }
  return out;
}

// RSI con suavizado de Wilder (estándar de industria).
export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// Min / max sobre ventana móvil de los últimos `period` valores antes (e incluyendo) i.
export function rollingMin(arr, period) {
  return arr.map((_, i) => {
    if (i < period - 1) return null;
    let m = Infinity;
    for (let j = i - period + 1; j <= i; j++) if (arr[j] != null && arr[j] < m) m = arr[j];
    return isFinite(m) ? m : null;
  });
}
export function rollingMax(arr, period) {
  return arr.map((_, i) => {
    if (i < period - 1) return null;
    let m = -Infinity;
    for (let j = i - period + 1; j <= i; j++) if (arr[j] != null && arr[j] > m) m = arr[j];
    return isFinite(m) ? m : null;
  });
}
