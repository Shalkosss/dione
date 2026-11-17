// lib/universeTechRefresh.js — Tanda `part` del técnico del universo (paso 2).
//
// La corre refresh-technical con ?part=1 o ?part=2 (crons 13:00 y 14:00 UTC,
// rutas /api/cron/refresh-universe-tech-1 y -2 en vercel.json). Lee la fila
// 'universe' y el snapshot de calidad, baja velas de las invertibles que no
// están en el snapshot y escribe la fila universe_tech_<part>. No toca
// `latest`: los scores de calidad no cambian.

import { readSnapshot, readRow, writeRow } from './store.js';
import { fetchCandlesBatch } from './yahoo.js';
import { SECTOR_ETF_BY_GICS } from './trendScore.js';
import { UNIVERSE_TECH_PARTS, referenceMomentum, partSymbols, universeTrendRows, dropIntraday } from './universeTech.js';

const BUDGET_MS = 220_000;
const dayIndex = (ms) => Math.floor(ms / 86400000);

export async function refreshUniverseTech(part, { t0 = Date.now() } = {}) {
  if (!Number.isInteger(part) || part < 1 || part > UNIVERSE_TECH_PARTS) throw new Error(`part inválida: ${part}`);
  const id = `universe_tech_${part}`;
  const [snap, universe, previous] = await Promise.all([
    readSnapshot(),
    readRow('universe'),
    readRow(id).catch(() => null),
  ]);
  if (!snap?.gems) throw new Error('snapshot de calidad no existe');
  if (!universe?.rows) throw new Error('fila universe no existe (cron refresh-universe)');

  const reference = referenceMomentum(snap.gems);
  const quality = { symbols: Object.keys(snap.gems), ciks: Object.values(snap.gems).map((g) => g.cik) };
  const candidates = partSymbols(universe.rows, quality, part, UNIVERSE_TECH_PARTS, dayIndex(t0));
  const benchmarks = ['SPY', ...Object.values(SECTOR_ETF_BY_GICS)];
  const raw = await fetchCandlesBatch([...benchmarks, ...candidates.map((c) => c.symbol)], {
    days: 400, concurrency: 5, throttleMs: 200, deadlineMs: t0 + BUDGET_MS,
  });
  const candlesMap = new Map([...raw].map(([sym, candles]) => [sym, candles ? dropIntraday(candles) : candles]));
  const { rows, stats } = universeTrendRows({ candidates, candlesMap, reference });

  // Yahoo bloqueando: no se reemplaza la fila de ayer por una casi vacía.
  if (stats.degraded) return { id, written: false, ...stats, ms: Date.now() - t0 };

  // Las candidatas que no se alcanzaron a pedir conservan el dato de ayer.
  const keep = new Set(candidates.filter((c) => !candlesMap.has(c.symbol)).map((c) => c.symbol));
  const carried = Object.fromEntries(Object.entries(previous?.rows || {}).filter(([sym]) => keep.has(sym)));
  const merged = { ...carried, ...rows };

  await writeRow(id, { meta: { asOf: new Date().toISOString(), part, ...stats, carried: Object.keys(carried).length, ms: Date.now() - t0 }, rows: merged });
  return { id, written: true, ...stats, carried: Object.keys(carried).length, ms: Date.now() - t0 };
}
