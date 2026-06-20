// api/screener.js — Endpoint que DIONE consume para /scan-fundamental, /hidden-gems, /scan-combo.
//
// NO calcula nada en vivo: lee el snapshot precomputado y lo filtra/rankea en
// memoria (<200ms).
//
// Query params (todos opcionales):
//   mode               "gems" (default) | "fundamental" | "technical" | "combo"
//                        gems        → 300M–2B   (Tier 3, hidden gems)
//                        fundamental → 500M–200B (universo fundamental, UNIVERSE.md)
//                        technical   → mismo universo gems pero rankeado por technicalScore
//                        combo       → mismo universo gems rankeado por 0.5*pre + 0.5*tech
//   capMin, capMax     market cap USD. Override explícito.
//   minScore           pre-score mínimo (default 60) — solo aplica a mode=gems/fundamental
//   sector             filtro GICS (ej "Technology") — case-insensitive contains
//   gateOnly           "1" → solo las que pasan el quality gate (default 1)
//   sort               "score" (default) | "roe" | "fcfYield" | "cap" | "technical" | "combo"
//   limit              default 25, max 100
//   includeFailed      "1" → incluir las que NO pasan el gate (con motivos)
//   includeNoCap       "1" → incluir filas con marketCap null
//
// Ejemplos:
//   /hidden-gems       → GET /api/screener?mode=gems&minScore=60&limit=25
//   /scan-fundamental  → GET /api/screener?mode=fundamental&minScore=60&limit=25
//   /scan-combo        → GET /api/screener?mode=combo&limit=10

import { readSnapshot } from '../lib/store.js';

export const config = { maxDuration: 10 };

const MODE_DEFAULTS = {
  gems:        { capMin: 300_000_000,  capMax: 2_000_000_000   },
  fundamental: { capMin: 500_000_000,  capMax: 200_000_000_000 },
  technical:   { capMin: 300_000_000,  capMax: 50_000_000_000  },
  combo:       { capMin: 1_000_000_000, capMax: 100_000_000_000 },
};

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const mode = (q.mode || 'gems').toString().toLowerCase();
    const def = MODE_DEFAULTS[mode] || MODE_DEFAULTS.gems;

    const capMin = num(q.capMin, def.capMin);
    const capMax = num(q.capMax, def.capMax);
    const minScore = num(q.minScore, mode === 'technical' || mode === 'combo' ? 0 : 60);
    const limit = Math.max(1, Math.min(num(q.limit, 25), 100));
    const sector = (q.sector || '').toString().toLowerCase() || null;
    // gicsSector matchea exacto (case-insensitive) contra uno de los 11 GICS L1.
    const gicsSector = (q.gicsSector || '').toString().toLowerCase() || null;
    const gateOnly = q.gateOnly !== '0';
    const includeFailed = q.includeFailed === '1';
    const includeNoCap = q.includeNoCap === '1';
    const requestedSort = (q.sort || defaultSort(mode)).toString();

    const snap = await readSnapshot();
    if (!snap || !snap.gems) {
      return res.status(503).json({
        error: 'snapshot todavía no generado — corré /api/cron/refresh-gems',
      });
    }

    let rows = Object.values(snap.gems);

    rows = rows.filter((r) => {
      if (r.marketCap == null) {
        if (!includeNoCap) return false;
      } else if (r.marketCap < capMin || r.marketCap > capMax) {
        return false;
      }
      if (sector) {
        const s = (r.sector || '').toLowerCase();
        if (!s.includes(sector)) return false;
      }
      if (gicsSector) {
        const g = (r.gicsSector || '').toLowerCase();
        if (g !== gicsSector) return false;
      }
      if (!includeFailed && gateOnly && !r.gatePass) return false;
      if (r.gatePass && r.preScore != null && r.preScore < minScore && mode !== 'technical' && mode !== 'combo') return false;
      return true;
    });

    // Fallback de sort: si el snapshot no tiene los scores precomputados
    // (Phase B pendiente), technical/combo caen a preScore. Se documenta en meta.
    const hasTechScore = rows.some((r) => r.technicalScore != null);
    const hasComboScore = rows.some((r) => r.comboScore != null);
    let sort = requestedSort;
    let sortFallback = null;
    if (sort === 'technical' && !hasTechScore) {
      sort = 'score';
      sortFallback = 'preScore (technicalScore no precomputado en snapshot — Phase B pendiente)';
    }
    if (sort === 'combo' && !hasComboScore) {
      sort = 'score';
      sortFallback = 'preScore (comboScore no precomputado en snapshot — Phase B pendiente)';
    }

    const sorters = {
      score: (a, b) => (b.preScore ?? -1) - (a.preScore ?? -1),
      roe: (a, b) => (b.roe ?? -1) - (a.roe ?? -1),
      fcfYield: (a, b) => (b.fcfYield ?? -1) - (a.fcfYield ?? -1),
      cap: (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0),
      technical: (a, b) => (b.technicalScore ?? -1) - (a.technicalScore ?? -1),
      combo: (a, b) => (b.comboScore ?? -1) - (a.comboScore ?? -1),
    };
    rows.sort(sorters[sort] || sorters.score);

    const out = rows.slice(0, limit).map((r) => ({
      symbol: r.symbol,
      name: r.name,
      sector: r.sector,
      industry: r.industry,
      gicsSector: r.gicsSector ?? null,
      marketCap: r.marketCap,
      price: r.price,
      preScore: r.preScore,
      technicalScore: r.technicalScore ?? null,
      comboScore: r.comboScore ?? null,
      wyckoffPhase: r.wyckoffPhase ?? null,
      wyckoffEvents: r.wyckoffEvents ?? [],
      gatePass: r.gatePass,
      gateReasons: r.gatePass ? undefined : r.gateReasons,
      metrics: {
        roe: r.roe, roic: r.roic, fcfYield: r.fcfYield,
        debtToEquity: r.debtToEquity, currentRatio: r.currentRatio,
        grossMargin: r.grossMargin, netMargin: r.netMargin, pe: r.pe,
        altmanZ: r.altmanZ ?? null,
        altmanModel: r.altmanModel ?? null,
        piotroski: r.piotroski ?? null,
        piotroskiPartial: r.piotroskiPartial ?? null,
        rsi: r.rsi ?? null,
        cmf: r.cmf ?? null,
      },
      technicalBreakdown: r.technicalBreakdown ?? null,
    }));

    // Headers de observabilidad: edad del snapshot fundamental + técnico.
    const now = Date.now();
    const fundAgeH = hoursAgo(snap.meta?.updatedAt, now);
    const techAgeH = hoursAgo(snap.meta?.technicalUpdatedAt, now);
    if (fundAgeH != null) res.setHeader('X-Snapshot-Age-Hours', String(fundAgeH));
    if (techAgeH != null) res.setHeader('X-Technical-Age-Hours', String(techAgeH));
    if (sortFallback) res.setHeader('X-Sort-Fallback', '1');

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      meta: {
        ...snap.meta,
        returned: out.length,
        filters: {
          mode,
          capMin,
          capMax,
          minScore,
          sector,
          gicsSector,
          sort,
          sortRequested: requestedSort,
          sortFallback,
        },
      },
      results: out,
    });
  } catch (e) {
    console.error('[screener]', e);
    return res.status(500).json({ error: e.message });
  }
}

function defaultSort(mode) {
  if (mode === 'technical') return 'technical';
  if (mode === 'combo') return 'combo';
  return 'score';
}

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

function hoursAgo(iso, now) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((now - t) / 36e5) * 10) / 10;
}
