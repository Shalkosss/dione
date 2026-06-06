// lib/wyckoff.js — Indicadores técnicos + detección de fase Wyckoff.
//
// Funciones puras (sin side effects), unit-testables. Reglas cuantificadas
// según WYCKOFF_FRAMEWORK.md. Si faltan candles → cada función devuelve null
// o arrays parciales en lugar de tirar.
//
// Entrada típica de detectWyckoffPhase: candles = [{ t, o, h, l, c, v }, ...]
// ordenados ascendentes en tiempo, con al menos ~250 barras diarias.

// -----------------------------------------------------------------------------
// SMA — Simple Moving Average. Devuelve array misma longitud, null hasta llenar.
// -----------------------------------------------------------------------------
export function computeSMA(values, period) {
  const out = new Array(values.length).fill(null);
  if (!Array.isArray(values) || period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// -----------------------------------------------------------------------------
// RSI — Wilder smoothing. Devuelve array (null hasta tener `period` deltas).
// -----------------------------------------------------------------------------
export function computeRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
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

// -----------------------------------------------------------------------------
// ATR — Wilder smoothing del True Range.
// -----------------------------------------------------------------------------
export function computeATR(highs, lows, closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(null);
  if (n <= period) return out;
  const tr = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i === 0) tr[i] = highs[i] - lows[i];
    else {
      const a = highs[i] - lows[i];
      const b = Math.abs(highs[i] - closes[i - 1]);
      const c = Math.abs(lows[i] - closes[i - 1]);
      tr[i] = Math.max(a, b, c);
    }
  }
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;
  for (let i = period; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

// -----------------------------------------------------------------------------
// OBV — On Balance Volume acumulado.
// -----------------------------------------------------------------------------
export function computeOBV(closes, volumes) {
  const n = closes.length;
  const out = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] - volumes[i];
    else out[i] = out[i - 1];
  }
  return out;
}

// -----------------------------------------------------------------------------
// A/D Line — Accumulation/Distribution (Chaikin).
// -----------------------------------------------------------------------------
export function computeADLine(highs, lows, closes, volumes) {
  const n = closes.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const range = highs[i] - lows[i];
    const mfm = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    const mfv = mfm * volumes[i];
    out[i] = (i === 0 ? 0 : out[i - 1]) + mfv;
  }
  return out;
}

// -----------------------------------------------------------------------------
// CMF — Chaikin Money Flow (period default 20). Devuelve último valor.
// -----------------------------------------------------------------------------
export function computeCMF(highs, lows, closes, volumes, period = 20) {
  const n = closes.length;
  if (n < period) return null;
  let mfvSum = 0, volSum = 0;
  for (let i = n - period; i < n; i++) {
    const range = highs[i] - lows[i];
    const mfm = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    mfvSum += mfm * volumes[i];
    volSum += volumes[i];
  }
  return volSum === 0 ? 0 : mfvSum / volSum;
}

// -----------------------------------------------------------------------------
// linearSlope — pendiente de regresión lineal de los últimos `window` valores.
// Útil para tendencia de OBV / A/D / preferencias suaves. Devuelve null si no hay datos.
// -----------------------------------------------------------------------------
export function linearSlope(values, window) {
  if (!Array.isArray(values) || values.length < window) return null;
  const slice = values.slice(-window).filter((v) => Number.isFinite(v));
  if (slice.length < 2) return null;
  const n = slice.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += slice[i]; sxy += i * slice[i]; sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  return (n * sxy - sx * sy) / denom;
}

// -----------------------------------------------------------------------------
// detectWyckoffPhase — heurística sobre candles diarios (>=250 barras ideal).
// Devuelve { phase, events, confidence, levels }.
// -----------------------------------------------------------------------------
export function detectWyckoffPhase(candles) {
  if (!Array.isArray(candles) || candles.length < 60) {
    return { phase: null, events: [], confidence: 0, levels: {} };
  }
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v);

  const n = candles.length;
  const atr = computeATR(highs, lows, closes, 14);
  const sma20Vol = computeSMA(volumes, 20);

  // Cuartil inferior del precio de los últimos 250 días (ventana de "bottom")
  const lookback = Math.min(250, n);
  const recentLows = lows.slice(-lookback).slice().sort((a, b) => a - b);
  const q1Price = recentLows[Math.floor(recentLows.length * 0.25)];

  const events = [];

  // --- SC: range > 2.5×ATR Y volume > 2.5×avg20 Y precio en cuartil inferior ---
  let lastSCIdx = -1;
  for (let i = Math.max(20, n - lookback); i < n; i++) {
    if (atr[i] == null || sma20Vol[i] == null || sma20Vol[i] === 0) continue;
    const range = highs[i] - lows[i];
    if (range > 2.5 * atr[i] &&
        volumes[i] > 2.5 * sma20Vol[i] &&
        lows[i] <= q1Price) {
      events.push({ type: 'SC', idx: i, date: candles[i].t, price: lows[i], volume: volumes[i] });
      lastSCIdx = i;
    }
  }

  // --- AR: rebote >10% en 5-15 bars post-SC ---
  let lastARIdx = -1;
  if (lastSCIdx >= 0) {
    const scLow = lows[lastSCIdx];
    const end = Math.min(n, lastSCIdx + 16);
    let maxRebound = 0, maxIdx = -1;
    for (let i = lastSCIdx + 5; i < end; i++) {
      const r = (highs[i] - scLow) / scLow;
      if (r > maxRebound) { maxRebound = r; maxIdx = i; }
    }
    if (maxRebound >= 0.10 && maxIdx >= 0) {
      events.push({ type: 'AR', idx: maxIdx, date: candles[maxIdx].t, price: highs[maxIdx] });
      lastARIdx = maxIdx;
    }
  }

  // --- ST: retest del SC low ±5% con volume < 70% del SC volume ---
  let lastSTIdx = -1;
  if (lastSCIdx >= 0 && lastARIdx >= 0) {
    const scLow = lows[lastSCIdx];
    const scVol = volumes[lastSCIdx];
    for (let i = lastARIdx + 1; i < n; i++) {
      if (Math.abs(lows[i] - scLow) / scLow <= 0.05 &&
          volumes[i] < 0.70 * scVol) {
        events.push({ type: 'ST', idx: i, date: candles[i].t, price: lows[i] });
        lastSTIdx = i;
        break;
      }
    }
  }

  // --- Spring: close < min(low[t-60..t-1]) AND vol < 0.80×avg20
  //              AND close[t+1..t+5] recovera por encima del nivel roto
  //              AND no new low en t+15 ---
  let lastSpringIdx = -1;
  for (let i = 60; i < n - 15; i++) {
    if (sma20Vol[i] == null || sma20Vol[i] === 0) continue;
    let minLow = Infinity;
    for (let j = i - 60; j < i; j++) minLow = Math.min(minLow, lows[j]);
    if (closes[i] < minLow && volumes[i] < 0.80 * sma20Vol[i]) {
      let recovered = false;
      for (let k = i + 1; k <= Math.min(n - 1, i + 5); k++) {
        if (closes[k] > minLow) { recovered = true; break; }
      }
      if (!recovered) continue;
      let newLow = false;
      for (let k = i + 1; k <= Math.min(n - 1, i + 15); k++) {
        if (lows[k] < lows[i]) { newLow = true; break; }
      }
      if (newLow) continue;
      events.push({ type: 'Spring', idx: i, date: candles[i].t, price: lows[i] });
      lastSpringIdx = i;
    }
  }

  // --- SOS: breakout del rango con vol > 1.5×avg20, wide range bar ---
  let lastSOSIdx = -1;
  if (lastSTIdx >= 0 || lastSpringIdx >= 0) {
    const startIdx = Math.max(lastSTIdx, lastSpringIdx) + 1;
    // techo del rango: máximo de highs entre SC y startIdx
    const rangeStart = lastSCIdx >= 0 ? lastSCIdx : Math.max(0, startIdx - 60);
    let rangeHigh = -Infinity;
    for (let j = rangeStart; j < startIdx; j++) rangeHigh = Math.max(rangeHigh, highs[j]);
    for (let i = startIdx; i < n; i++) {
      if (atr[i] == null || sma20Vol[i] == null) continue;
      const range = highs[i] - lows[i];
      if (closes[i] > rangeHigh && volumes[i] > 1.5 * sma20Vol[i] && range > 1.5 * atr[i]) {
        events.push({ type: 'SOS', idx: i, date: candles[i].t, price: closes[i] });
        lastSOSIdx = i;
        break;
      }
    }
  }

  // --- Phase inference ---
  let phase = null;
  let confidence = 0;

  const adLine = computeADLine(highs, lows, closes, volumes);
  const adSlope = linearSlope(adLine.slice(-60), 60);
  const last = n - 1;

  if (lastSOSIdx >= 0) {
    // post-SOS: fase D (LPS posible) o fase E (uptrend sostenido)
    const distSinceSOS = last - lastSOSIdx;
    const sosLevel = closes[lastSOSIdx];
    const stillAbove = closes[last] > sosLevel;
    if (distSinceSOS > 30 && stillAbove) {
      phase = 'E';
      confidence = 0.7;
    } else {
      phase = 'D';
      confidence = 0.65;
    }
  } else if (lastSpringIdx >= 0 && lastSCIdx >= 0) {
    phase = 'C';
    confidence = 0.7;
  } else if (lastSTIdx >= 0 || (lastARIdx >= 0 && last - lastARIdx > 20)) {
    // rango lateral establecido. Si A/D slope positiva → fase B
    if (adSlope != null && adSlope > 0) {
      phase = 'B';
      confidence = 0.55;
    } else {
      phase = 'B';
      confidence = 0.40;
    }
  } else if (lastSCIdx >= 0 && lastARIdx >= 0) {
    phase = 'A';
    confidence = 0.6;
  }

  const sma200 = computeSMA(closes, 200);
  const max52w = Math.max(...highs.slice(-Math.min(252, n)));
  const levels = {
    currentPrice: closes[last],
    sma200: sma200[last],
    high52w: max52w,
    dist52wHigh: max52w > 0 ? (closes[last] - max52w) / max52w : null,
  };

  return { phase, events, confidence, levels };
}
