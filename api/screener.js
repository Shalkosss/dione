// api/screener.js — Endpoint que DIONE consume para /hidden-gems.
//
// NO calcula nada en vivo: lee el snapshot precomputado y lo filtra/rankea en
// memoria (<200ms). Por eso nunca da timeout aunque el universo sea grande.
//
// Query params (todos opcionales):
//   capMin, capMax     market cap USD (default 300M–2B, rango Tier 3)
//   minScore           pre-score mínimo (default 60)
//   sector             filtro GICS (ej "Technology")
//   gateOnly           "1" → solo las que pasan el quality gate (default 1)
//   sort               "score" (default) | "roe" | "fcfYield" | "cap"
//   limit              default 25, max 100
//   includeFailed      "1" → incluir las que NO pasan el gate (con motivos)
//
// Ejemplo (lo que disparo yo en /hidden-gems):
//   GET /api/screener?capMin=300000000&capMax=2000000000&minScore=60&limit=25

import { readSnapshot } from '../lib/store.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const capMin = num(q.capMin, 300_000_000);
    const capMax = num(q.capMax, 2_000_000_000);
    const minScore = num(q.minScore, 60);
    const limit = Math.min(num(q.limit, 25), 100);
    const sector = (q.sector || '').toString().toLowerCase() || null;
    const gateOnly = q.gateOnly !== '0';
    const includeFailed = q.includeFailed === '1';
    const sort = (q.sort || 'score').toString();

    const snap = await readSnapshot();
    if (!snap || !snap.gems) {
      return res.status(503).json({
        error: 'snapshot todavía no generado — corré /api/cron/refresh-gems o esperá al primer cron',
      });
    }

    let rows = Object.values(snap.gems);

    // filtros
    rows = rows.filter((r) => {
      if (r.marketCap != null && (r.marketCap < capMin || r.marketCap > capMax)) return false;
      if (sector && (r.sector || '').toLowerCase() !== sector) return false;
      if (!includeFailed && gateOnly && !r.gatePass) return false;
      if (r.gatePass && r.preScore != null && r.preScore < minScore) return false;
      return true;
    });

    // orden
    const sorters = {
      score: (a, b) => (b.preScore ?? -1) - (a.preScore ?? -1),
      roe: (a, b) => (b.roe ?? -1) - (a.roe ?? -1),
      fcfYield: (a, b) => (b.fcfYield ?? -1) - (a.fcfYield ?? -1),
      cap: (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0),
    };
    rows.sort(sorters[sort] || sorters.score);

    const out = rows.slice(0, limit).map((r) => ({
      symbol: r.symbol,
      name: r.name,
      sector: r.sector,
      industry: r.industry,
      marketCap: r.marketCap,
      price: r.price,
      preScore: r.preScore,
      gatePass: r.gatePass,
      gateReasons: r.gatePass ? undefined : r.gateReasons,
      metrics: {
        roe: r.roe, roic: r.roic, fcfYield: r.fcfYield,
        debtToEquity: r.debtToEquity, currentRatio: r.currentRatio,
        grossMargin: r.grossMargin, netMargin: r.netMargin, pe: r.pe,
        altmanZ: r.altmanZ ?? null, piotroski: r.piotroski ?? null,
      },
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      meta: { ...snap.meta, returned: out.length, filters: { capMin, capMax, minScore, sector, sort } },
      results: out,
    });
  } catch (e) {
    console.error('[screener]', e);
    return res.status(500).json({ error: e.message });
  }
}

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
