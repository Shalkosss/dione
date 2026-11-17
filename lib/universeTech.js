// lib/universeTech.js — Tendencia para el universo NYSE/Nasdaq fuera del gate
// (paso 2). Puro.
//
// Reglas (del conclave del 17-nov-2026):
//   1. El percentil de momentum se mide CONTRA el universo de calidad (los del
//      snapshot `latest`), sin sumarse a él. Los trend scores de calidad no
//      cambian por agregar 2.000 empresas más.
//   2. Cada tanda escribe su propia fila (universe_tech_1, universe_tech_2):
//      Vercel Hobby corre los crons en cualquier minuto de la hora, así que dos
//      tandas sobre la misma fila se pisarían.
//   3. Todo lo de acá lleva la bandera `fuera_validado`: el score v4 se validó
//      en large caps del S&P 500 (TECHNICAL_VALIDATED.md), no en small caps.

import { computeTrendInputs, percentileAgainst, momentumFromInputs, scoreTrend, SECTOR_ETF_BY_GICS } from './trendScore.js';

export const UNIVERSE_TECH_PARTS = 2;
export const DEGRADED_FAILURE_RATE = 0.3;
export const BREADTH_MAX_AGE_MS = 36 * 3600 * 1000;

// Momentum de referencia: el universo de calidad tal como quedó en el snapshot.
export function referenceMomentum(gems) {
  return Object.values(gems || {})
    .map((g) => momentumFromInputs(g.trendInputs))
    .filter((v) => v != null && Number.isFinite(v));
}

// Candidatas de la tanda `part` (1..parts): invertibles del universo que no
// están en el snapshot de calidad (por símbolo o por CIK: GOOG y GOOGL son la
// misma empresa). Reparto estable por orden alfabético; el punto de partida
// rota cada día para que, si la tanda se corta por tiempo, no queden siempre
// afuera las mismas (las no alcanzadas conservan el dato del día anterior).
export function partSymbols(universeRows, quality, part, parts = UNIVERSE_TECH_PARTS, day = 0) {
  const symbols = new Set(quality?.symbols || []);
  const ciks = new Set((quality?.ciks || []).filter((c) => c != null));
  const mine = (universeRows || [])
    .filter((r) => r.investable && r.price != null && !symbols.has(r.symbol) && !(r.cik != null && ciks.has(r.cik)))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .filter((_, i) => i % parts === part - 1)
    .map((r) => ({ symbol: r.symbol, gicsSector: r.gicsSector ?? null }));
  if (!mine.length) return mine;
  const start = ((day % mine.length) * 97) % mine.length;
  return [...mine.slice(start), ...mine.slice(0, start)];
}

const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const NY_MINUTE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// Saca la vela de hoy si la sesión de Nueva York todavía no cerró: los crons
// de Hobby pueden caer con el mercado abierto y una vela a medio hacer mueve
// precio, medias y RSI. La referencia de calidad (10:00 UTC) usa velas cerradas.
export function dropIntraday(candles, now = Date.now()) {
  if (!Array.isArray(candles) || !candles.length) return candles;
  const today = NY_DATE.format(now);
  const [h, m] = NY_MINUTE.format(now).split(':').map(Number);
  const closed = h * 60 + m >= 16 * 60 + 15;
  const last = candles[candles.length - 1];
  return !closed && NY_DATE.format(last.t * 1000) === today ? candles.slice(0, -1) : candles;
}

const ret63 = (candles) => computeTrendInputs(candles)?.ret63 ?? null;

// candidates: [{ symbol, gicsSector }]; candlesMap: Map símbolo → velas | null
// (los que no están en el Map no se alcanzaron a pedir).
export function universeTrendRows({ candidates, candlesMap, reference }) {
  const attempted = candidates.filter((c) => candlesMap.has(c.symbol));
  const failures = attempted.filter((c) => !candlesMap.get(c.symbol)).length;
  const benchRet = Object.fromEntries(['SPY', ...Object.values(SECTOR_ETF_BY_GICS)].map((b) => [b, ret63(candlesMap.get(b))]));
  const rows = {};
  let above = 0;
  let withSma = 0;
  for (const c of attempted) {
    const inputs = computeTrendInputs(candlesMap.get(c.symbol));
    if (!inputs) continue;
    withSma++;
    if (inputs.price > inputs.sma200) above++;
    const etf = SECTOR_ETF_BY_GICS[c.gicsSector];
    const bench = etf && benchRet[etf] != null ? etf : 'SPY';
    const r = scoreTrend(inputs, { momentumPct: percentileAgainst(inputs.momentum, reference), benchRet63: benchRet[bench] });
    rows[c.symbol] = {
      trendScore: r.score,
      trendLabel: r.label,
      aboveSma200: inputs.price > inputs.sma200,
      distSma50: inputs.distSma50,
      rsi: inputs.rsi,
      flags: ['fuera_validado', ...r.flags, ...(bench === 'SPY' ? ['benchmark_spy'] : [])],
    };
  }
  return {
    rows,
    stats: {
      candidates: candidates.length,
      attempted: attempted.length,
      skipped: candidates.length - attempted.length,
      candleFailures: failures,
      degraded: attempted.length > 0 && failures / attempted.length > DEGRADED_FAILURE_RATE,
      scored: Object.keys(rows).length,
      above,
      withSma,
      referenceSize: (reference || []).length,
    },
  };
}

// Amplitud del mercado completo: calidad (del snapshot) más las tandas del
// universo del mismo día UTC que la corrida técnica de calidad (si esa no
// tiene fecha, las de las últimas 36 h). Null si falta la parte de calidad.
export function combinedBreadth(qualityMeta, partMetas = [], now = Date.now()) {
  const qShare = qualityMeta?.breadthAboveSma200;
  const qN = qualityMeta?.trendUniverseSize;
  if (qShare == null || !qN) return null;
  const qDay = qualityMeta?.technicalUpdatedAt ? String(qualityMeta.technicalUpdatedAt).slice(0, 10) : null;
  const sameRun = (m) => (qDay ? String(m.asOf).slice(0, 10) === qDay : now - Date.parse(m.asOf) < BREADTH_MAX_AGE_MS);
  const fresh = partMetas.filter((m) => m?.asOf && m.withSma > 0 && sameRun(m));
  const above = qShare * qN + fresh.reduce((s, m) => s + m.above, 0);
  const total = qN + fresh.reduce((s, m) => s + m.withSma, 0);
  return { share: above / total, size: total, parts: fresh.length };
}
