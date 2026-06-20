// api/health.js — Healthcheck público del snapshot.
//
// GET /api/health → { status, fundamentalAge_h, technicalAge_h, technicalScored }
//
//   status:
//     "ok"                  ambos snapshots frescos (<26h)
//     "stale_technical"     fundamental fresco pero technicalUpdatedAt > 26h
//     "stale_fundamental"   updatedAt > 26h (peor caso, prioritario)
//
// Sin auth, sin cache (queremos lectura siempre actual). Lee el snapshot
// de Supabase igual que /api/screener.

import { readSnapshot } from '../lib/store.js';

export const config = { maxDuration: 5 };

const STALE_HOURS = 26;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const snap = await readSnapshot();
    if (!snap || !snap.meta) {
      return res.status(200).json({
        status: 'stale_fundamental',
        fundamentalAge_h: null,
        technicalAge_h: null,
        technicalScored: null,
      });
    }

    const now = Date.now();
    const fundamentalAge_h = hoursAgo(snap.meta.updatedAt, now);
    const technicalAge_h = hoursAgo(snap.meta.technicalUpdatedAt, now);

    let status = 'ok';
    if (fundamentalAge_h == null || fundamentalAge_h > STALE_HOURS) {
      status = 'stale_fundamental';
    } else if (technicalAge_h == null || technicalAge_h > STALE_HOURS) {
      status = 'stale_technical';
    }

    return res.status(200).json({
      status,
      fundamentalAge_h,
      technicalAge_h,
      technicalScored: snap.meta.technicalScored ?? null,
    });
  } catch (e) {
    console.error('[health]', e);
    return res.status(500).json({ status: 'error', error: e.message });
  }
}

function hoursAgo(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((now - t) / 36e5) * 10) / 10;
}
