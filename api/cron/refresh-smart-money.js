// api/cron/refresh-smart-money.js — Cron diario que computa Smart Money Score
// para el top N de gate-passers + watchlist + override SMART_MONEY_SYMBOLS.
//
// Corre después de refresh-gems y refresh-technical. Guarda un snapshot
// separado en Supabase (tabla smart_money_snapshot, fila 'latest') con la
// estructura: { meta, results: { [symbol]: { score, breakdown, insider, analyst } } }.
//
// El endpoint /api/smart-money sirve este snapshot.

import { readSnapshot } from '../../lib/store.js';
import { computeSmartMoneyBatch } from '../../lib/smartMoney.js';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 300 };

const TABLE = 'smart_money_snapshot';
const ROW_ID = 'latest';

const TOP_N = Number(process.env.SMART_MONEY_TOP_N || 100);
const EXTRA = (process.env.SMART_MONEY_SYMBOLS || '')
  .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE no configurado');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

async function writeSnapshot(data) {
  const { error } = await client()
    .from(TABLE)
    .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase smart_money writeSnapshot: ${error.message}`);
  return ROW_ID;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    const snap = await readSnapshot();
    if (!snap?.gems) {
      return res.status(503).json({ error: 'snapshot fundamental no existe' });
    }

    // Universo: top N por comboScore (o preScore si combo no existe) + override.
    const ranked = Object.values(snap.gems)
      .filter((g) => g.gatePass)
      .sort((a, b) => (b.comboScore ?? b.preScore ?? 0) - (a.comboScore ?? a.preScore ?? 0))
      .slice(0, TOP_N)
      .map((g) => g.symbol);

    const symbols = [...new Set([...ranked, ...EXTRA])];

    // Conservador con Finnhub free tier: 4 concurrentes, 60ms throttle ~ 50 req/s
    // pero solo lanzamos 2 calls por símbolo (insider + recommendation) — ~30 req/s neto.
    const map = await computeSmartMoneyBatch(symbols, { concurrency: 4, throttleMs: 60 });

    const results = {};
    let scored = 0;
    for (const [sym, sm] of map) {
      if (sm) {
        results[sym] = sm;
        scored++;
      }
    }

    const snapshot = {
      meta: {
        updatedAt: new Date().toISOString(),
        scored,
        attempted: symbols.length,
        topN: TOP_N,
        extraCount: EXTRA.length,
        ms: Date.now() - t0,
      },
      results,
    };

    await writeSnapshot(snapshot);
    return res.status(200).json({ ok: true, ...snapshot.meta });
  } catch (e) {
    console.error('[refresh-smart-money]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
