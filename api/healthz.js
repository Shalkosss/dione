// api/healthz.js — Healthcheck del snapshot.
//
// GET /api/healthz
//   200 → snapshot fresco (fundamental < 26h, técnico < 26h)
//   200 con degraded:true → fundamental fresco pero técnico viejo o ausente
//   503 → snapshot fundamental viejo o ausente
//
// Pensado para que un monitor externo (UptimeRobot, BetterStack) lo pollee
// cada 15-60 min y alerte cuando degraded=true o status≠200.

import { readSnapshot } from '../lib/store.js';

export const config = { maxDuration: 5 };

const STALE_HOURS = Number(process.env.HEALTHZ_STALE_HOURS || 26);

export default async function handler(req, res) {
  const t0 = Date.now();
  try {
    const snap = await readSnapshot();
    res.setHeader('Cache-Control', 'no-store');
    if (!snap || !snap.gems || !snap.meta) {
      return res.status(503).json({
        ok: false,
        status: 'no_snapshot',
        message: 'snapshot todavia no generado — correr /api/cron/refresh-gems',
        elapsedMs: Date.now() - t0,
      });
    }

    const now = Date.now();
    const fundAgeH = hoursAgo(snap.meta.updatedAt, now);
    const techAgeH = hoursAgo(snap.meta.technicalUpdatedAt, now);

    const fundStale = fundAgeH == null || fundAgeH > STALE_HOURS;
    const techStale = techAgeH == null || techAgeH > STALE_HOURS;

    const out = {
      ok: !fundStale,
      degraded: !fundStale && techStale,
      fundamental: {
        updatedAt: snap.meta.updatedAt || null,
        ageHours: fundAgeH,
        stale: fundStale,
        gatePassers: snap.meta.gatePassers ?? null,
        withSector: snap.meta.withSector ?? null,
      },
      technical: {
        updatedAt: snap.meta.technicalUpdatedAt || null,
        ageHours: techAgeH,
        stale: techStale,
        scored: snap.meta.technicalScored ?? null,
        attempted: snap.meta.technicalAttempted ?? null,
        degradedRunFlag: snap.meta.technicalDegraded ?? false,
      },
      thresholds: { staleHours: STALE_HOURS },
      elapsedMs: Date.now() - t0,
    };

    return res.status(fundStale ? 503 : 200).json(out);
  } catch (e) {
    console.error('[healthz]', e);
    return res.status(500).json({ ok: false, error: e.message, elapsedMs: Date.now() - t0 });
  }
}

function hoursAgo(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((now - t) / 36e5) * 10) / 10;
}
