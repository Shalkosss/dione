// api/cron/refresh-technical.js — Computa technical score sobre el snapshot.
//
// Corre 1h después de refresh-gems. Lee el snapshot fundamental, baja candles
// de Yahoo para los gate-passers, computa technicalScore + Wyckoff phase y
// mergea de vuelta al snapshot con comboScore (0.5*pre + 0.5*tech).
//
// Tolerante a fallos: símbolos sin candles quedan con technicalScore=null,
// el snapshot no se rompe.

import { readSnapshot, writeSnapshot } from '../../lib/store.js';
import { fetchCandlesBatch } from '../../lib/yahoo.js';
import { computeTechnicalScore } from '../../lib/technicalScore.js';

export const config = { maxDuration: 300 };

// límite duro de símbolos a procesar por corrida. Yahoo a 5 req/s = ~24s por 120.
const MAX_SYMBOLS = Number(process.env.TECHNICAL_MAX_SYMBOLS || 150);

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

    // ordenar gate-passers por preScore desc y limitar
    const passers = Object.values(snap.gems)
      .filter((g) => g.gatePass && g.preScore != null)
      .sort((a, b) => (b.preScore ?? 0) - (a.preScore ?? 0))
      .slice(0, MAX_SYMBOLS);

    const symbols = passers.map((p) => p.symbol);
    const candlesMap = await fetchCandlesBatch(symbols, {
      days: 400, concurrency: 5, throttleMs: 200,
    });

    let withTechnical = 0;
    for (const sym of symbols) {
      const candles = candlesMap.get(sym);
      const target = snap.gems[sym];
      if (!target) continue;

      if (!candles || candles.length < 250) {
        target.technicalScore = null;
        target.technicalBreakdown = null;
        target.wyckoffPhase = null;
        target.wyckoffEvents = [];
        target.comboScore = null;
        continue;
      }

      const tech = computeTechnicalScore(candles);
      target.technicalScore = tech.score;
      target.technicalBreakdown = tech.breakdown;
      target.wyckoffPhase = tech.phase;
      target.wyckoffEvents = tech.events || [];
      target.wyckoffLevels = tech.levels || null;
      target.rsi = tech.rsi ?? null;
      target.cmf = tech.cmf ?? null;

      if (tech.score != null && target.preScore != null) {
        target.comboScore = Math.round(0.5 * target.preScore + 0.5 * tech.score);
        withTechnical++;
      } else {
        target.comboScore = null;
      }
    }

    snap.meta = {
      ...snap.meta,
      technicalUpdatedAt: new Date().toISOString(),
      technicalScored: withTechnical,
      technicalAttempted: symbols.length,
    };

    await writeSnapshot(snap);
    return res.status(200).json({
      ok: true,
      scored: symbols.length,
      withTechnical,
      ms: Date.now() - t0,
    });
  } catch (e) {
    console.error('[refresh-technical]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
