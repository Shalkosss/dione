// lib/trendScore.js — Score de estado de tendencia v4 (TECHNICAL_VALIDATED.md §4).
//
// Funciones puras. No elige ganadores: describe en qué estado está la
// tendencia y si el precio está en zona de entrada. Reemplaza al
// technicalScore v3 en el ranking técnico (v3 queda como histórico).
//
// Componentes (0-100):
//   precio sobre SMA200 ............ 20
//   SMA200 subiendo (vs 20 ses.) ... 15
//   SMA50 sobre SMA200 ............. 10
//   momentum 12-1 y 6-1 (percentil)  0-25
//   fuerza relativa 63 ses. vs ETF . 15/10/5/0
//   zona de entrada (dist. SMA50, RSI) 15/8/5/0

import { computeSMA, computeRSI, computeATR } from './wyckoff.js';

export const MIN_BARS = 220;
export const MIN_UNIVERSE = 20;
const EPS = 1e-9;

export const SECTOR_ETF_BY_GICS = Object.freeze({
  'Communication Services': 'XLC',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  Energy: 'XLE',
  Financials: 'XLF',
  'Health Care': 'XLV',
  Industrials: 'XLI',
  'Information Technology': 'XLK',
  Materials: 'XLB',
  'Real Estate': 'XLRE',
  Utilities: 'XLU',
});

const ratio = (a, b) => (a != null && b != null && b > 0 ? a / b - 1 : null);

// Velas [{t,o,h,l,c,v}] ascendentes → entradas del score, o null si hay menos de 220.
export function computeTrendInputs(candles) {
  if (!Array.isArray(candles) || candles.length < MIN_BARS) return null;
  const n = candles.length;
  const last = n - 1;
  const closes = candles.map((k) => k.c);
  const sma50s = computeSMA(closes, 50);
  const sma200s = computeSMA(closes, 200);
  const price = closes[last];
  const mom12_1 = n >= 253 ? ratio(closes[n - 22], closes[n - 253]) : null;
  const mom6_1 = ratio(closes[n - 22], closes[n - 127]);
  const momentum = mom12_1 != null && mom6_1 != null ? (mom12_1 + mom6_1) / 2 : mom6_1;

  return {
    price,
    sma50: sma50s[last],
    sma200: sma200s[last],
    sma200Prev20: sma200s[last - 20],
    rsi: computeRSI(closes, 14)[last],
    atr14: computeATR(candles.map((k) => k.h), candles.map((k) => k.l), closes, 14)[last],
    mom12_1,
    mom6_1,
    momentum,
    momentumPartial: mom12_1 == null,
    ret63: ratio(price, closes[last - 63]),
    distSma50: ratio(price, sma50s[last]),
    distSma200: ratio(price, sma200s[last]),
  };
}

// Percentil del valor dentro del universo: el mejor da 1, el peor 0.
// Con menos de 20 valores no hay percentil confiable (null).
export function momentumPercentile(value, universeValues) {
  if (value == null) return null;
  const values = universeValues.filter((v) => v != null && Number.isFinite(v));
  if (values.length < MIN_UNIVERSE) return null;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (below + Math.max(0, equal - 1) / 2) / (values.length - 1);
}

// Percentil de un valor que NO forma parte de la referencia: lo usan las
// empresas fuera del gate, que se miden contra el universo de calidad sin
// entrar en él. Así su llegada no mueve el percentil (ni el score) de las de
// calidad, que se siguen rankeando solo entre ellas con momentumPercentile.
export function percentileAgainst(value, reference) {
  if (value == null || !Number.isFinite(value)) return null;
  const values = (reference || []).filter((v) => v != null && Number.isFinite(v));
  if (values.length < MIN_UNIVERSE) return null;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (below + equal / 2) / values.length;
}

// Momentum combinado a partir de lo que guarda el snapshot en trendInputs.
export function momentumFromInputs(ti) {
  if (!ti) return null;
  if (ti.mom12_1 != null && ti.mom6_1 != null) return (ti.mom12_1 + ti.mom6_1) / 2;
  return ti.mom6_1 ?? null;
}

function relStrengthPoints(diff) {
  if (diff == null) return 0;
  if (diff > 0.05 + EPS) return 15;
  if (diff > EPS) return 10;
  if (diff > -0.05 + EPS) return 5;
  return 0;
}

function entryZonePoints(d, rsi) {
  if (d == null || rsi == null) return 0;
  if (rsi > 75 + EPS || d > 0.10 + EPS) return 0;
  if (d < -0.03 - EPS) return 5;
  if (d <= 0.05 + EPS && rsi >= 40 - EPS && rsi <= 60 + EPS) return 15;
  return 8;
}

// Estado de la tendencia. Primero la posición contra la SMA200; después
// retroceso, extensión y zona. ALCISTA cubre el hueco que deja el documento
// (sobre SMA200, entre +5% y +10% de la SMA50, RSI normal).
export function trendLabel(inputs) {
  const { price, sma50, sma200, rsi, distSma50: d } = inputs;
  if (!(price > sma200)) return price > sma50 ? 'RECUPERANDO' : 'ROTA';
  if (rsi < 40) return 'RETROCESO';
  if (d > 0.10 + EPS || rsi > 75 + EPS) return 'EXTENDIDA';
  if (Math.abs(d) <= 0.05 + EPS) return 'EN ZONA';
  return 'ALCISTA';
}

export function scoreTrend(inputs, { momentumPct = null, benchRet63 = null } = {}) {
  const flags = [];
  if (inputs.momentumPartial) flags.push('momentum_parcial');
  if (momentumPct == null) flags.push('sin_percentil');
  if (benchRet63 == null) flags.push('sin_benchmark');

  const rsDiff63 = inputs.ret63 != null && benchRet63 != null ? inputs.ret63 - benchRet63 : null;
  const breakdown = {
    aboveSma200: inputs.price > inputs.sma200 ? 20 : 0,
    sma200Slope: inputs.sma200 > inputs.sma200Prev20 ? 15 : 0,
    smaStack: inputs.sma50 > inputs.sma200 ? 10 : 0,
    momentum: Math.round(25 * (momentumPct ?? 0) * 10) / 10,
    relStrength: relStrengthPoints(rsDiff63),
    entryZone: entryZonePoints(inputs.distSma50, inputs.rsi),
  };
  const extended = inputs.distSma50 > 0.10 + EPS || inputs.rsi > 75 + EPS;
  if (extended) flags.push('extended');

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { score: Math.round(total), label: trendLabel(inputs), breakdown, flags, rsDiff63 };
}

export function computeTrendScore(candles, ctx = {}) {
  const inputs = computeTrendInputs(candles);
  if (!inputs) return { score: null, reason: 'insufficient_data' };
  return { ...scoreTrend(inputs, ctx), inputs };
}
