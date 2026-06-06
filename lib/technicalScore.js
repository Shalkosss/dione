// lib/technicalScore.js — Score técnico 0-100 sobre candles diarios.
//
// Pesos (TECHNICAL_VALIDATED.md):
//   Trend & Structure 30  · Momentum 20  · Volume Signature 25  · Wyckoff 25
//
// Si no hay 250 candles → score = null (marcar 'insufficient_data').

import {
  computeSMA, computeRSI, computeOBV, computeADLine, computeCMF,
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

  const sma200 = computeSMA(closes, 200);
  const rsi14 = computeRSI(closes, 14);
  const obv = computeOBV(closes, volumes);
  const adLine = computeADLine(highs, lows, closes, volumes);
  const cmf = computeCMF(highs, lows, closes, volumes, 20);

  // ============ Trend & Structure (30) ============
  let trend = 0;
  // precio > SMA200 → 10
  if (sma200[last] != null && closes[last] > sma200[last]) trend += 10;
  // higher highs en últimos 6m (126 days): max(últimos 60) > max(60..120 atrás)
  if (n >= 130) {
    const recent60 = Math.max(...highs.slice(-60));
    const prior60 = Math.max(...highs.slice(-120, -60));
    if (recent60 > prior60) trend += 10;
  }
  // dist 52W high: cuanto más cerca, más puntos (max 10)
  const max52w = Math.max(...highs.slice(-Math.min(252, n)));
  const dist = max52w > 0 ? (max52w - closes[last]) / max52w : 1;
  if (dist <= 0.05) trend += 10;
  else if (dist <= 0.15) trend += 7;
  else if (dist <= 0.25) trend += 4;
  else if (dist <= 0.35) trend += 2;

  // ============ Momentum (20) ============
  let momentum = 0;
  // 12-1m return percentil vs universe (si ctx.universeReturns12_1 disponible).
  // Fallback: scoring absoluto del 12-1m return.
  if (n >= 252) {
    const r12m1 = closes[last - 21] && closes[n - 252]
      ? (closes[last - 21] - closes[n - 252]) / closes[n - 252] : null;
    if (r12m1 != null) {
      if (Array.isArray(ctx.universeReturns12_1) && ctx.universeReturns12_1.length > 0) {
        const sorted = ctx.universeReturns12_1.slice().sort((a, b) => a - b);
        const rank = sorted.findIndex((v) => v >= r12m1);
        const pct = rank < 0 ? 1 : rank / sorted.length;
        momentum += Math.round(pct * 10);
      } else {
        if (r12m1 > 0.40) momentum += 10;
        else if (r12m1 > 0.20) momentum += 7;
        else if (r12m1 > 0.05) momentum += 4;
        else if (r12m1 > 0) momentum += 2;
      }
    }
  }
  // 3m accel: 3m return > 6m return (en términos anualizados → simplifico: r3 > 0.5 * r6)
  if (n >= 126) {
    const c0 = closes[n - 1], c3 = closes[n - 63], c6 = closes[n - 126];
    const r3 = (c0 - c3) / c3, r6 = (c0 - c6) / c6;
    if (r3 > r6 * 0.5 && r3 > 0) momentum += 5;
    else if (r3 > 0) momentum += 2;
  }
  // RSI contextual: 40-65 sano (no sobrecomprado, con momentum). >70 penaliza un poco.
  const rsi = rsi14[last];
  if (rsi != null) {
    if (rsi >= 40 && rsi <= 65) momentum += 5;
    else if (rsi > 65 && rsi <= 75) momentum += 3;
    else if (rsi > 75) momentum += 1;
  }

  // ============ Volume Signature (25) ============
  let volume = 0;
  // OBV slope 60d
  const obvSlope = linearSlope(obv.slice(-60), 60);
  if (obvSlope != null) {
    if (obvSlope > 0) volume += 10;
    else if (obvSlope > -Math.abs(obv[last] * 0.001)) volume += 5;
  }
  // A/D vs price divergence (60d): si A/D sube y precio baja → distribución oculta inversa (bullish)
  if (n >= 60) {
    const adSlope = linearSlope(adLine.slice(-60), 60);
    const priceSlope = linearSlope(closes.slice(-60), 60);
    if (adSlope != null && priceSlope != null) {
      const samesign = (adSlope > 0 && priceSlope > 0) || (adSlope < 0 && priceSlope < 0);
      const bullishDiv = adSlope > 0 && priceSlope <= 0;
      if (bullishDiv) volume += 10;
      else if (samesign && adSlope > 0) volume += 7;
      else if (samesign) volume += 3;
    }
  }
  // CMF
  if (cmf != null) {
    if (cmf > 0.10) volume += 5;
    else if (cmf > 0) volume += 3;
  }

  // ============ Wyckoff Phase (25) ============
  let wyckoffPts = 0;
  const wyckoff = detectWyckoffPhase(candles);
  if (wyckoff.phase) wyckoffPts += 10;
  const hasSpring = wyckoff.events.some((e) => e.type === 'Spring');
  const hasST = wyckoff.events.some((e) => e.type === 'ST');
  if (hasSpring) wyckoffPts += 10;
  else if (hasST) wyckoffPts += 5;
  // P&F viability: proxy básico = está en rango (fase B/C) o ya en breakout (D/E)
  if (wyckoff.phase === 'C' || wyckoff.phase === 'D') wyckoffPts += 5;
  else if (wyckoff.phase === 'E' || wyckoff.phase === 'B') wyckoffPts += 3;

  const breakdown = {
    trend: Math.min(30, trend),
    momentum: Math.min(20, momentum),
    volume: Math.min(25, volume),
    wyckoff: Math.min(25, wyckoffPts),
  };
  const score = breakdown.trend + breakdown.momentum + breakdown.volume + breakdown.wyckoff;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown,
    phase: wyckoff.phase,
    events: wyckoff.events.map((e) => ({ type: e.type, date: e.date, price: e.price })),
    levels: wyckoff.levels,
    rsi: rsi != null ? Math.round(rsi) : null,
    cmf: cmf != null ? Number(cmf.toFixed(3)) : null,
  };
}
