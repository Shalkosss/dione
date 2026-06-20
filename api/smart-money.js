// api/smart-money.js — Sirve el snapshot de smart-money computado por
// /api/cron/refresh-smart-money.
//
// GET /api/smart-money               → overview top N por score
// GET /api/smart-money?ticker=AAPL   → señal de un símbolo específico
//
// Query params:
//   ticker         filtra a un símbolo (mayúscula auto)
//   minScore       default 0
//   limit          default 25, max 100
//   sort           "score" (default)

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 5 };

const TABLE = 'smart_money_snapshot';
const ROW_ID = 'latest';

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE no configurado');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

async function readSnapshot() {
  const { data, error } = await client()
    .from(TABLE)
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const ticker = (q.ticker || '').toString().toUpperCase().trim() || null;
    const minScore = num(q.minScore, 0);
    const limit = Math.max(1, Math.min(num(q.limit, 25), 100));

    const snap = await readSnapshot();
    if (!snap || !snap.results) {
      return res.status(503).json({
        error: 'snapshot smart-money no generado — correr /api/cron/refresh-smart-money',
      });
    }

    if (ticker) {
      const r = snap.results[ticker];
      if (!r) {
        return res.status(404).json({
          error: `ticker ${ticker} no está en el snapshot smart-money (fuera del top N o sin data Finnhub)`,
          hint: 'agregarlo a SMART_MONEY_SYMBOLS env var',
        });
      }
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
      return res.status(200).json({ meta: snap.meta, ticker, result: r });
    }

    const rows = Object.entries(snap.results)
      .map(([symbol, r]) => ({ symbol, ...r }))
      .filter((r) => (r.score ?? 0) >= minScore)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({
      meta: { ...snap.meta, returned: rows.length, filters: { minScore, limit } },
      results: rows,
    });
  } catch (e) {
    console.error('[smart-money]', e);
    return res.status(500).json({ error: e.message });
  }
}

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
