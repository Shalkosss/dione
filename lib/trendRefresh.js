// lib/trendRefresh.js — Arma las actualizaciones técnicas del snapshot.
//
// Puro: recibe los gate-passers y las velas ya bajadas, devuelve los campos
// nuevos por símbolo sin tocar el snapshot. Calcula el score de tendencia v4
// (el que ordena) y el technicalScore v3 (histórico, sigue alimentando
// comboScore y la vista Diamond/Borderline).

import { computeTechnicalScore } from './technicalScore.js';
import { computeTrendInputs, momentumPercentile, scoreTrend, SECTOR_ETF_BY_GICS } from './trendScore.js';

export const BENCHMARKS = ['SPY', ...Object.values(SECTOR_ETF_BY_GICS)];
export const DEGRADED_FAILURE_RATE = 0.3;

const ret63 = (candles) => computeTrendInputs(candles)?.ret63 ?? null;

function v3Fields(candles, universeReturns12_1, preScore) {
  if (!candles || candles.length < 250) {
    return { technicalScore: null, technicalBreakdown: null, wyckoffPhase: null, wyckoffEvents: [], wyckoffLevels: null, rsi: null, cmf: null, comboScore: null };
  }
  const tech = computeTechnicalScore(candles, { universeReturns12_1 });
  return {
    technicalScore: tech.score,
    technicalBreakdown: tech.breakdown,
    wyckoffPhase: tech.phase,
    wyckoffEvents: tech.events || [],
    wyckoffLevels: tech.levels || null,
    rsi: tech.rsi ?? null,
    cmf: tech.cmf ?? null,
    comboScore: tech.score != null && preScore != null ? Math.round(0.5 * preScore + 0.5 * tech.score) : null,
  };
}

function v4Fields(inputs, momentumPct, benchmark, benchRet63, extraFlags) {
  if (!inputs) return { trendScore: null, trendLabel: null, trendBreakdown: null, trendInputs: null, trendFlags: ['insufficient_data'] };
  const r = scoreTrend(inputs, { momentumPct, benchRet63 });
  return {
    trendScore: r.score,
    trendLabel: r.label,
    trendBreakdown: r.breakdown,
    trendInputs: {
      sma50: inputs.sma50, sma200: inputs.sma200, distSma50: inputs.distSma50, distSma200: inputs.distSma200,
      rsi14: inputs.rsi, atr14: inputs.atr14, mom12_1: inputs.mom12_1, mom6_1: inputs.mom6_1,
      momentumPct, ret63: inputs.ret63, rsBenchmark: benchmark, rsDiff63: r.rsDiff63,
    },
    trendFlags: [...r.flags, ...extraFlags],
  };
}

// passers: [{ symbol, preScore, gicsSector }]; candlesMap: Map symbol → velas | null.
// Un símbolo que no está en el Map no se intentó (corte por tiempo): no se actualiza.
export function buildTechnicalUpdates({ passers, candlesMap }) {
  const attempted = passers.filter((p) => candlesMap.has(p.symbol));
  const inputsBySymbol = new Map(attempted.map((p) => [p.symbol, computeTrendInputs(candlesMap.get(p.symbol))]));
  const withInputs = [...inputsBySymbol.values()].filter(Boolean);
  const universe = withInputs.map((x) => x.momentum);
  const universeReturns12_1 = withInputs.filter((x) => x.mom12_1 != null).map((x) => x.mom12_1);
  const benchRet = Object.fromEntries(BENCHMARKS.map((b) => [b, ret63(candlesMap.get(b))]));

  const failures = attempted.filter((p) => !candlesMap.get(p.symbol)).length;
  const degraded = attempted.length > 0 && failures / attempted.length > DEGRADED_FAILURE_RATE;
  const updates = {};
  let trendScored = 0;

  for (const p of attempted) {
    const candles = candlesMap.get(p.symbol);
    // Corrida degradada (Yahoo bloqueó): no se pisan los scores del día anterior con null.
    if (degraded && !candles) continue;
    const inputs = inputsBySymbol.get(p.symbol);
    const sectorEtf = SECTOR_ETF_BY_GICS[p.gicsSector];
    const useSector = sectorEtf && benchRet[sectorEtf] != null;
    const benchmark = useSector ? sectorEtf : 'SPY';
    const v4 = v4Fields(inputs, momentumPercentile(inputs?.momentum, universe), benchmark, benchRet[benchmark], useSector ? [] : ['benchmark_spy']);
    if (v4.trendScore != null) trendScored++;
    updates[p.symbol] = { ...v3Fields(candles, universeReturns12_1, p.preScore), ...v4 };
  }

  return {
    updates,
    stats: {
      attempted: attempted.length,
      skipped: passers.length - attempted.length,
      candleFailures: failures,
      degraded,
      trendScored,
      technicalScored: Object.values(updates).filter((u) => u.comboScore != null).length,
      universeSize: universe.length,
      // Amplitud: parte del universo sobre su SMA200 (adelanta /api/regime).
      breadthAboveSma200: withInputs.length ? withInputs.filter((x) => x.price > x.sma200).length / withInputs.length : null,
    },
  };
}
