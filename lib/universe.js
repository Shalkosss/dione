// lib/universe.js — Piezas puras del universo del Scan (Fase 3, ítems 3, 6, 9 y 10).
//
//   MEGACAPS            empresas de más de ~$200B que entran al snapshot aunque
//                       no pasen el gate (marcadas `megacap: true`).
//   sectorPercentiles   percentil de preScore dentro de su sector GICS.
//   weekKey / rankMap / rollWeekly / weeklyMarks   marcas NUEVO, SUBE, BAJA.
//   scanView            descubrimiento por sector (máx. 3) y tablero de megacaps.

// Lista mantenida a mano (como los pesos del S&P 500). Revisar cada trimestre.
export const MEGACAPS = Object.freeze([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA', 'BRK-B', 'LLY',
  'JPM', 'V', 'WMT', 'ORCL', 'MA', 'XOM', 'NFLX', 'COST', 'JNJ', 'HD',
  'PG', 'ABBV', 'BAC', 'PLTR', 'UNH', 'KO', 'AMD', 'CSCO', 'CRM', 'GE',
  'IBM', 'MU', 'CVX', 'WFC', 'TMUS', 'MS', 'AXP', 'PM', 'GS', 'LIN', 'MCD',
]);

const MIN_SECTOR_SIZE = 5;
const NO_SECTOR = 'Sin sector';

// Percentil de preScore (0 = peor, 1 = mejor) dentro del sector, entre los
// que pasan el gate. Sectores con menos de `minSize` nombres quedan en null.
export function sectorPercentiles(gems, minSize = MIN_SECTOR_SIZE) {
  const bySector = new Map();
  for (const g of Object.values(gems)) {
    if (!g.gatePass || g.preScore == null || !g.gicsSector) continue;
    bySector.set(g.gicsSector, [...(bySector.get(g.gicsSector) || []), g.preScore]);
  }
  const out = {};
  for (const g of Object.values(gems)) {
    const scores = g.gicsSector ? bySector.get(g.gicsSector) : null;
    if (!g.gatePass || g.preScore == null || !scores || scores.length < minSize) { out[g.symbol] = null; continue; }
    const below = scores.filter((s) => s < g.preScore).length;
    const equal = scores.filter((s) => s === g.preScore).length;
    out[g.symbol] = (below + (equal - 1) / 2) / (scores.length - 1);
  }
  return out;
}

// Lunes (YYYY-MM-DD) de la semana de `date`.
export function weekKey(date) {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // lunes = 0
  return new Date(d.getTime() - offset * 86400000).toISOString().slice(0, 10);
}

// Ranking por preScore entre los que pasan el gate: { SYM: 1, ... }.
export function rankMap(gems) {
  return Object.fromEntries(
    Object.entries(gems)
      .filter(([, g]) => g.gatePass && g.preScore != null)
      .sort(([, a], [, b]) => b.preScore - a.preScore)
      .map(([sym], i) => [sym, i + 1]),
  );
}

// Estado guardado: { current: { weekOf, ranks }, prev: { weekOf, ranks } | null }.
// Dentro de la misma semana se pisa `current`; al cambiar de semana, la última
// foto de la semana pasada pasa a `prev`.
export function rollWeekly(saved, today, ranks) {
  const weekOf = weekKey(today);
  if (!saved?.current) return { current: { weekOf, ranks }, prev: null };
  if (saved.current.weekOf === weekOf) return { current: { weekOf, ranks }, prev: saved.prev ?? null };
  return { current: { weekOf, ranks }, prev: saved.current };
}

// NUEVO: entra al top N y no estaba la semana pasada. SUBE/BAJA: se movió
// `move` puestos o más dentro del ranking.
export function weeklyMarks(now, prev, { topN = 100, move = 10 } = {}) {
  const out = {};
  for (const [sym, rank] of Object.entries(now)) {
    const rankPrev = prev ? prev[sym] ?? null : null;
    let mark = null;
    if (prev) {
      if (rankPrev == null || (rankPrev > topN && rank <= topN)) mark = rank <= topN ? 'NUEVO' : null;
      else if (rankPrev - rank >= move) mark = 'SUBE';
      else if (rank - rankPrev >= move) mark = 'BAJA';
    }
    out[sym] = { mark, rankPrev };
  }
  return out;
}

// Vista del Scan: los mejores `perSector` por preScore en cada sector y las
// megacaps aparte (pasen o no el gate), ordenadas por capitalización.
export function scanView(gems, { perSector = 3 } = {}) {
  const discovery = {};
  const passers = Object.values(gems)
    .filter((g) => g.gatePass && g.preScore != null)
    .sort((a, b) => b.preScore - a.preScore);
  for (const g of passers) {
    const key = g.gicsSector || NO_SECTOR;
    const list = discovery[key] || [];
    if (list.length < perSector) discovery[key] = [...list, g];
  }
  const megacaps = Object.values(gems)
    .filter((g) => g.megacap)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return { discovery, megacaps };
}

// Campos que escribe refresh-technical. refresh-gems los copia del snapshot
// anterior para que no desaparezcan entre las 09:00 y las 10:00 UTC.
export const TECHNICAL_FIELDS = Object.freeze([
  'trendScore', 'trendLabel', 'trendBreakdown', 'trendInputs', 'trendFlags',
  'technicalScore', 'technicalBreakdown', 'wyckoffPhase', 'wyckoffEvents', 'wyckoffLevels', 'rsi', 'cmf', 'comboScore',
]);
const TECHNICAL_META = ['market', 'trendVersion', 'trendUpdatedAt', 'trendScored', 'trendAttempted', 'trendSkipped', 'trendUniverseSize',
  'breadthAboveSma200', 'technicalVersion', 'technicalUpdatedAt', 'technicalScored', 'technicalAttempted', 'technicalCandleFailures', 'technicalDegraded'];

const pickDefined = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
export const carryTechnical = (gem) => pickDefined(gem, TECHNICAL_FIELDS);
export const technicalMeta = (meta) => pickDefined(meta, TECHNICAL_META);
