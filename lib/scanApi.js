// lib/scanApi.js — Respuestas de /api/scan, /api/sectors y /api/regime.
//
// Las tres salen del snapshot (los crons ya calcularon todo), así que viven
// dentro de api/screener.js con `mode=scan|sectors|regime` y no gastan
// funciones nuevas de Vercel. vercel.json las expone con rutas propias.

import { scanView } from './universe.js';
import { combinedBreadth } from './universeTech.js';

export const SCAN_MODES = ['scan', 'sectors', 'regime'];

// Campos que el research necesita de cada candidata.
export function scanRow(g) {
  return {
    symbol: g.symbol,
    name: g.name ?? null,
    gicsSector: g.gicsSector ?? null,
    marketCap: g.marketCap ?? null,
    price: g.price ?? null,
    preScore: g.preScore ?? null,
    preScoreSectorPct: g.preScoreSectorPct ?? null,
    rank: g.rank ?? null,
    weeklyMark: g.weeklyMark ?? null,
    rankPrevWeek: g.rankPrevWeek ?? null,
    trendScore: g.trendScore ?? null,
    trendLabel: g.trendLabel ?? null,
    gatePass: g.gatePass ?? false,
    gateReasons: g.gatePass ? [] : g.gateReasons ?? [],
    megacap: g.megacap ?? false,
    metrics: { roe: g.roe ?? null, roic: g.roic ?? null, fcfYield: g.fcfYield ?? null, pe: g.pe ?? null, debtToEquity: g.debtToEquity ?? null },
  };
}

// breadthUniverse: % del universo de calidad sobre su SMA200 (sesgado: son
// empresas buenas). breadthMarket: % de NYSE y Nasdaq invertibles, sumando las
// tandas del universo del mismo día (null si todavía no corrieron).
function regimeBlock(meta, partMetas, now) {
  const market = meta?.market;
  if (!market?.regime) return null;
  const wide = combinedBreadth(meta, partMetas, now);
  return {
    ...market.regime,
    breadthUniverse: market.breadthUniverse ?? null,
    breadthMarket: wide && wide.parts > 0 ? wide.share : null,
    breadthMarketSize: wide && wide.parts > 0 ? wide.size : null,
    asOf: market.asOf ?? null,
  };
}

export function buildScanResponse(snap, mode, { perSector = 3, partMetas = [], now = Date.now() } = {}) {
  const meta = snap?.meta || {};
  const updatedAt = { fundamentals: meta.updatedAt ?? null, technical: meta.technicalUpdatedAt ?? null, weekOf: meta.weekOf ?? null };
  if (mode === 'regime') return { regime: regimeBlock(meta, partMetas, now), updatedAt };
  // spyWeights: pesos sectoriales del S&P 500 (SSGA) para la vista de cartera.
  if (mode === 'sectors') return { sectors: meta.market?.sectors ?? [], spyWeights: meta.market?.spyWeights ?? null, updatedAt };

  const { discovery, megacaps } = scanView(snap.gems || {}, { perSector });
  return {
    regime: regimeBlock(meta, partMetas, now),
    sectors: meta.market?.sectors ?? [],
    spyWeights: meta.market?.spyWeights ?? null,
    discovery: Object.fromEntries(Object.entries(discovery).map(([sector, list]) => [sector, list.map(scanRow)])),
    megacaps: megacaps.map(scanRow),
    movers: Object.values(snap.gems || {})
      .filter((g) => g.weeklyMark)
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9))
      .slice(0, 30)
      .map(scanRow),
    updatedAt,
  };
}
