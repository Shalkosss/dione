// lib/technicalScore.js — Composite Technical Score v3 (doble vía).
//
// Reemplaza la versión simplificada anterior. El score final es:
//   composite = max(trendTrack, wyckoffTrack) + bonuses
//
// VÍA A — TREND TRACK (máx 100):
//   Golden Cross (30) · 52W high distance (15) · Momentum 12-1 (15)
//   OBV/CMF trend (15) · RSI contextual (10) · Volume on breakouts (15)
//
// VÍA B — WYCKOFF TRACK (máx 100):
//   Phase base + bonuses de Spring/Test/SOS/P&F count/OBV+CMF en lateralización
//
// BONUSES (suma sobre el max de las dos vías):
//   +5 si ATR14 < 3% del precio
//   +5 si ADV > $10M (avg 30d de close*volume)
//   -10 si A/D divergencia bearish sostenida >30d
//
// Si no hay 250 candles → score = null.

import {
  computeSMA, computeRSI, computeATR, computeOBV, computeADLine, computeCMF,
  linearSlope, detectWyckoffPhase,
} from './wyckoff.js';

export function computeTechnicalScore(candles, ctx = {}) {
  if (!Array.isArray(candles) || candles.length < 250) {
    return { score: null, reason: 'insufficient_data', breakdown: null, phase: null };
  }

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v);
  const n = candles.length;
  const last = n - 1;

  const sma50 = computeSMA(closes, 50);
  const sma200 = computeSMA(closes, 200);
  const rsi14 = computeRSI(closes, 14);
  const atr14 = computeATR(highs, lows, closes, 14);
  const obv = computeOBV(closes, volumes);
  const adLine = computeADLine(highs, lows, closes, volumes);
  const cmf20 = computeCMF(highs, lows, closes, volumes, 20);
  const adSlope60 = linearSlope(adLine.slice(-60), 60);
  const wyckoff = detectWyckoffPhase(candles);

  // ---- Golden Cross detection: índice del cruce alcista más reciente ----
  // SMA50 cruza SMA200 hacia arriba: sma50[i] >= sma200[i] AND sma50[i-1] < sma200[i-1].
  // Recorremos desde el final hacia atrás (hasta 250 días) para encontrar el cruce.
  let goldenCrossIdx = -1;
  const goldenLookback = Math.min(250, n - 1);
  for (let i = last; i >= last - goldenLookback; i--) {
    if (i < 1 || sma50[i] == null || sma200[i] == null || sma50[i - 1] == null || sma200[i - 1] == null) continue;
    if (sma50[i] >= sma200[i] && sma50[i - 1] < sma200[i - 1]) {
      goldenCrossIdx = i;
      break;
    }
  }
  // El cruce está "activo" si actualmente sma50 > sma200.
  const goldenActive = sma50[last] != null && sma200[last] != null && sma50[last] > sma200[last];
  const goldenCrossAge = goldenCrossIdx >= 0 ? (last - goldenCrossIdx) : null;

  // ---- 12-1 momentum return ----
  let momentum12_1 = null;
  if (n >= 253 && closes[n - 22] != null && closes[n - 253] != null && closes[n - 253] > 0) {
    momentum12_1 = (closes[n - 22] - closes[n - 253]) / closes[n - 253];
  }

  // ============================================================
  // VÍA A — TREND TRACK
  // ============================================================
  const trend = computeTrendTrack({
    closes, highs, volumes, sma50, sma200, rsi14, obv, cmf20, adSlope60,
    last, n, goldenCrossAge, goldenActive, momentum12_1,
    universeReturns12_1: ctx.universeReturns12_1,
  });

  // ============================================================
  // VÍA B — WYCKOFF TRACK
  // ============================================================
  const wyckoffTrack = computeWyckoffTrack({
    candles, wyckoff, volumes, closes, highs, lows,
    obv, adLine, cmf20, last, n,
  });

  // ============================================================
  // BONUSES
  // ============================================================
  const bonuses = computeBonuses({
    closes, volumes, adLine, atr14, last, n,
  });

  const baseTrack = Math.max(trend.score, wyckoffTrack.score);
  const viaUsed = trend.score >= wyckoffTrack.score ? 'trend' : 'wyckoff';
  const composite = Math.max(0, Math.min(100, Math.round(baseTrack + bonuses.total)));

  return {
    score: composite,
    breakdown: {
      trendTrack: trend.score,
      wyckoffTrack: wyckoffTrack.score,
      composite,
      bonuses: bonuses.total,
      viaUsed,
      goldenCrossAge,
      rsi: rsi14[last] != null ? Math.round(rsi14[last]) : null,
      cmf: cmf20 != null ? Number(cmf20.toFixed(3)) : null,
      momentum12_1: momentum12_1 != null ? Number(momentum12_1.toFixed(3)) : null,
      wyckoffPhase: wyckoff.phase,
      // Sub-breakdowns para debug; el contrato externo solo usa los campos de arriba.
      _trend: trend.parts,
      _wyckoff: wyckoffTrack.parts,
      _bonuses: bonuses.parts,
    },
    phase: wyckoff.phase,
    events: wyckoff.events.map((e) => ({ type: e.type, date: e.date, price: e.price })),
    levels: wyckoff.levels,
    rsi: rsi14[last] != null ? Math.round(rsi14[last]) : null,
    cmf: cmf20 != null ? Number(cmf20.toFixed(3)) : null,
  };
}

// ---------------------------------------------------------------------------
// TREND TRACK (máx 100)
// ---------------------------------------------------------------------------
function computeTrendTrack({
  closes, highs, volumes, sma50, sma200, rsi14, obv, cmf20, adSlope60,
  last, n, goldenCrossAge, goldenActive, momentum12_1, universeReturns12_1,
}) {
  const parts = {};

  // 1) Golden Cross (30pts)
  let gc = 0;
  if (goldenActive && goldenCrossAge != null) {
    if (goldenCrossAge < 30) gc = 30;
    else if (goldenCrossAge < 90) gc = 22;
    else if (goldenCrossAge < 180) gc = 15;
    else gc = 8; // sigue activo pero muy viejo
  } else if (goldenActive) {
    // sma50 > sma200 hoy pero no detectamos el cruce dentro de la ventana → es viejo
    gc = 8;
  }
  parts.goldenCross = gc;

  // 2) Distance to 52W high (15pts)
  const max52w = Math.max(...highs.slice(-Math.min(252, n)));
  const dist = max52w > 0 ? (max52w - closes[last]) / max52w : 1;
  let d52 = 0;
  if (dist <= 0.01) d52 = 15;
  else if (dist <= 0.05) d52 = 13;
  else if (dist <= 0.15) d52 = 10;
  else if (dist <= 0.25) d52 = 5;
  parts.distTo52w = d52;

  // 3) Momentum 12-1 (15pts, con bonus a top decile = 18)
  let mom = 0;
  if (momentum12_1 != null) {
    if (Array.isArray(universeReturns12_1) && universeReturns12_1.length >= 10) {
      const sorted = universeReturns12_1.slice().sort((a, b) => a - b);
      // percentil del ticker dentro del universo
      let rank = 0;
      while (rank < sorted.length && sorted[rank] < momentum12_1) rank++;
      const pct = rank / sorted.length;
      if (pct >= 0.90) mom = 18; // top decile (bonus)
      else if (pct >= 0.80) mom = 15; // top quintile
      else if (pct >= 0.60) mom = 10;
      else if (pct >= 0.50) mom = 5;
    } else {
      // single-ticker fallback: thresholds absolutos
      if (momentum12_1 > 0.30) mom = 15;
      else if (momentum12_1 > 0.10) mom = 10;
      else if (momentum12_1 > 0) mom = 5;
    }
  }
  parts.momentum = mom;

  // 4) OBV + ADL slope 60d (15pts). Spec: ambos positivos=15, uno=8, ninguno=0.
  // Antes usábamos CMF como proxy del ADL slope, lo que sub-puntuaba casos con
  // ADL+ pero CMF cerca de 0 (acumulación lenta). Y solo crediteábamos cmf-alone.
  const obvSlope = linearSlope(obv.slice(-60), 60);
  const obvPos = obvSlope != null && obvSlope > 0;
  const adPos = adSlope60 != null && adSlope60 > 0;
  let ov = 0;
  if (obvPos && adPos) ov = 15;
  else if (obvPos || adPos) ov = 8;
  parts.obvAdl = ov;

  // 5) RSI contextual (10pts). 40-65=10 (boundary 65 cae en bucket sano por
  // continuidad: para rsi=65 exacto preferimos el bucket más alto del spec).
  const rsi = rsi14[last];
  let r = 0;
  if (rsi != null) {
    if (rsi >= 40 && rsi < 65) r = 10;
    else if (rsi >= 65 && rsi <= 75) r = 8;
    else if (rsi > 75) r = 2;
    else if (rsi < 40 && goldenActive) r = 8; // pullback en uptrend
    else r = 3;
  }
  parts.rsi = r;

  // 6) Volume on breakouts (15pts)
  // RVOL del día de mayor volumen en últimos 30d vs promedio de los 20d previos a ese día.
  let vol = 0;
  if (n >= 50) {
    const startWin = n - 30;
    let maxV = -Infinity, maxIdx = -1;
    for (let i = startWin; i < n; i++) {
      if (volumes[i] > maxV) { maxV = volumes[i]; maxIdx = i; }
    }
    if (maxIdx >= 20) {
      let sum = 0, cnt = 0;
      for (let i = maxIdx - 20; i < maxIdx; i++) {
        if (Number.isFinite(volumes[i])) { sum += volumes[i]; cnt++; }
      }
      const avg20 = cnt > 0 ? sum / cnt : 0;
      const rvol = avg20 > 0 ? maxV / avg20 : 0;
      if (rvol > 1.5) vol = 15;
      else if (rvol >= 1.2) vol = 8;
    }
  }
  parts.volume = vol;

  const score = Math.min(100, gc + d52 + mom + ov + r + vol);
  return { score, parts };
}

// ---------------------------------------------------------------------------
// WYCKOFF TRACK (máx 100)
// ---------------------------------------------------------------------------
function computeWyckoffTrack({
  candles, wyckoff, volumes, closes, highs, lows, obv, adLine, cmf20, last, n,
}) {
  const parts = {};

  // 1) Phase base
  let phaseBase = 0;
  const phaseEvents = wyckoff.events || [];
  const hasSpring = phaseEvents.some((e) => e.type === 'Spring');
  const hasTest = phaseEvents.some((e) => e.type === 'ST');
  const hasSOS = phaseEvents.some((e) => e.type === 'SOS');
  switch (wyckoff.phase) {
    case 'C': phaseBase = hasSpring && hasTest ? 20 : 15; break;
    case 'D': phaseBase = 18; break;
    case 'B': phaseBase = 12; break;
    case 'A': phaseBase = 5; break;
    case 'E': phaseBase = 8; break;
    default:  phaseBase = 0;
  }
  parts.phaseBase = phaseBase;

  // Helper: RVOL del día del evento vs avg 20d previo
  function rvolAt(idx) {
    if (idx == null || idx < 20) return null;
    let sum = 0, cnt = 0;
    for (let i = idx - 20; i < idx; i++) {
      if (Number.isFinite(volumes[i])) { sum += volumes[i]; cnt++; }
    }
    const avg = cnt > 0 ? sum / cnt : 0;
    return avg > 0 ? volumes[idx] / avg : null;
  }
  function eventAge(idx) {
    return idx != null && idx >= 0 ? (last - idx) : null;
  }

  // 2) Spring bonus (+25): <60d, RVOL<0.85
  let springBonus = 0;
  const springEv = phaseEvents.find((e) => e.type === 'Spring');
  if (springEv) {
    const age = eventAge(springEv.idx);
    const rv = rvolAt(springEv.idx);
    if (age != null && age < 60 && rv != null && rv < 0.85) springBonus = 25;
  }
  parts.springBonus = springBonus;

  // 3) Test bonus (+15): <30d, RVOL<0.7
  let testBonus = 0;
  const testEv = phaseEvents.find((e) => e.type === 'ST');
  if (testEv) {
    const age = eventAge(testEv.idx);
    const rv = rvolAt(testEv.idx);
    if (age != null && age < 30 && rv != null && rv < 0.7) testBonus = 15;
  }
  parts.testBonus = testBonus;

  // 4) SOS bonus (+15 / +8): <30d
  let sosBonus = 0;
  const sosEv = phaseEvents.find((e) => e.type === 'SOS');
  if (sosEv) {
    const age = eventAge(sosEv.idx);
    const rv = rvolAt(sosEv.idx);
    if (age != null && age < 30 && rv != null) {
      if (rv > 1.5) sosBonus = 15;
      else if (rv >= 1.2) sosBonus = 8;
    }
  }
  parts.sosBonus = sosBonus;

  // 5) P&F count proxy (+10 / +5)
  // Sin P&F nativo, usamos un proxy: target proyectado = rangeHigh + (rangeHigh - rangeLow).
  // El rango se mide sobre los últimos 60-120 días si estamos en B/C/D.
  let pfBonus = 0;
  if (['B', 'C', 'D'].includes(wyckoff.phase)) {
    const win = Math.min(120, n);
    const rh = Math.max(...highs.slice(-win));
    const rl = Math.min(...lows.slice(-win));
    const target = rh + (rh - rl);
    const upside = closes[last] > 0 ? (target - closes[last]) / closes[last] : 0;
    if (upside > 0.30) pfBonus = 10;
    else if (upside >= 0.15) pfBonus = 5;
  }
  parts.pfBonus = pfBonus;

  // 6) OBV+CMF positivos durante lateralización (+15 / +8)
  let lateralBonus = 0;
  if (wyckoff.phase === 'B' || wyckoff.phase === 'C') {
    const obvSlope = linearSlope(obv.slice(-60), 60);
    const obvPos = obvSlope != null && obvSlope > 0;
    const cmfPos = cmf20 != null && cmf20 > 0.05;
    if (obvPos && cmfPos) lateralBonus = 15;
    else if (obvPos || cmfPos) lateralBonus = 8;
  }
  parts.lateralBonus = lateralBonus;

  const score = Math.min(100, phaseBase + springBonus + testBonus + sosBonus + pfBonus + lateralBonus);
  return { score, parts };
}

// ---------------------------------------------------------------------------
// BONUSES (sobre el max de las dos vías)
// ---------------------------------------------------------------------------
function computeBonuses({ closes, volumes, adLine, atr14, last, n }) {
  const parts = {};

  // +5 si ATR14 < 3% del precio
  let atrBonus = 0;
  if (atr14[last] != null && closes[last] > 0 && atr14[last] / closes[last] < 0.03) {
    atrBonus = 5;
  }
  parts.atrBonus = atrBonus;

  // +5 si ADV > $10M (avg 30d de close*volume)
  let advBonus = 0;
  if (n >= 30) {
    let sum = 0, cnt = 0;
    for (let i = n - 30; i < n; i++) {
      const dv = closes[i] * volumes[i];
      if (Number.isFinite(dv)) { sum += dv; cnt++; }
    }
    const adv = cnt > 0 ? sum / cnt : 0;
    if (adv > 10_000_000) advBonus = 5;
  }
  parts.advBonus = advBonus;

  // -10 si A/D divergencia bearish sostenida >30d
  // (precio slope positivo + adLine slope negativo en los últimos 30d).
  let adDivPenalty = 0;
  if (n >= 30) {
    const priceSlope = linearSlope(closes.slice(-30), 30);
    const adSlope = linearSlope(adLine.slice(-30), 30);
    if (priceSlope != null && adSlope != null && priceSlope > 0 && adSlope < 0) {
      adDivPenalty = -10;
    }
  }
  parts.adDivPenalty = adDivPenalty;

  return { total: atrBonus + advBonus + adDivPenalty, parts };
}
