// api/cron/refresh-technical.js — Scores técnicos sobre el snapshot.
//
// Corre 1h después de refresh-gems. Baja velas de Yahoo para TODOS los que
// pasan el gate (antes solo el top 200) más SPY y los 11 ETFs sectoriales, y
// calcula:
//   - trendScore v4 (lib/trendScore.js): estado de tendencia, el que ordena.
//   - technicalScore v3 + Wyckoff: histórico, sigue alimentando comboScore.
//
// Presupuesto: corta a los 210 s de empezar para dejar margen al scoring y a la
// escritura. Los que no se alcanzaron conservan los datos del día anterior.
// Si falla más del 30% de las velas (Yahoo bloqueando), no se pisan los scores
// previos con null: solo se actualiza meta.

import { readSnapshot, writeSnapshot } from '../../lib/store.js';
import { fetchCandlesBatch } from '../../lib/yahoo.js';
import { buildTechnicalUpdates, BENCHMARKS, marketSummary } from '../../lib/trendRefresh.js';

export const config = { maxDuration: 300 };

const BUDGET_MS = 210_000;
// Tope opcional de símbolos (0 o sin valor = todos los que pasan el gate).
const MAX_SYMBOLS = Number(process.env.TECHNICAL_MAX_SYMBOLS || 0);

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    const snap = await readSnapshot();
    if (!snap?.gems) {
      return res.status(503).json({ error: 'snapshot fundamental no existe — correr refresh-gems primero' });
    }

    // Por preScore descendente: si se corta por tiempo, quedan afuera los peores.
    // Las megacaps van siempre, aunque el tope deje afuera su preScore.
    const sorted = Object.values(snap.gems)
      .filter((g) => (g.gatePass || g.megacap) && g.preScore != null)
      .sort((a, b) => (b.preScore ?? 0) - (a.preScore ?? 0));
    const top = MAX_SYMBOLS > 0 ? sorted.slice(0, MAX_SYMBOLS) : sorted;
    const passers = [...top, ...sorted.filter((g) => g.megacap && !top.includes(g))];

    // Benchmarks primero: sin ellos no hay fuerza relativa.
    const symbols = [...new Set([...BENCHMARKS, '^VIX', ...passers.map((p) => p.symbol)])];
    const candlesMap = await fetchCandlesBatch(symbols, {
      days: 400, concurrency: 5, throttleMs: 200, deadlineMs: t0 + BUDGET_MS,
    });

    const { updates, stats } = buildTechnicalUpdates({ passers, candlesMap });
    const gems = Object.fromEntries(Object.entries(snap.gems).map(([sym, g]) => [sym, updates[sym] ? { ...g, ...updates[sym] } : g]));
    const now = new Date().toISOString();

    const meta = {
      ...snap.meta,
      technicalVersion: 'v3',
      technicalUpdatedAt: now,
      technicalScored: stats.technicalScored,
      technicalAttempted: stats.attempted,
      technicalCandleFailures: stats.candleFailures,
      technicalDegraded: stats.degraded,
      trendVersion: 'v4',
      trendUpdatedAt: now,
      trendScored: stats.trendScored,
      trendAttempted: stats.attempted,
      trendSkipped: stats.skipped,
      trendUniverseSize: stats.universeSize,
      breadthAboveSma200: stats.breadthAboveSma200,
      // Régimen y tablero sectorial para /api/regime, /api/sectors y /api/scan.
      market: { ...marketSummary(candlesMap), breadthUniverse: stats.breadthAboveSma200, asOf: now },
    };

    await writeSnapshot({ ...snap, gems, meta });
    return res.status(200).json({ ok: true, ...stats, ms: Date.now() - t0 });
  } catch (e) {
    console.error('[refresh-technical]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
