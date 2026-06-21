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
//   includeBorderline  "true" → agregar clave `borderline` con candidatos de
//                                divergencia (combo 50-64, o fund/tech muy
//                                asimétricos). Default false para no romper
//                                la UI existente. Cuando es true, results se
//                                limita a Diamond (combo≥65, pre≥60, tech≥60,
//                                max 8) y borderline a max 5.
//
// Ejemplos:
//   /hidden-gems       → GET /api/screener?mode=gems&minScore=60&limit=25
//   /scan-fundamental  → GET /api/screener?mode=fundamental&minScore=60&limit=25
//   /scan-combo        → GET /api/screener?mode=combo&limit=10
//   /scan-combo +bord  → GET /api/screener?mode=combo&includeBorderline=true

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
    // Acepta "true" o "1" (los clientes humanos tipean true, los crons mandan 1).
    const includeBorderline = q.includeBorderline === 'true' || q.includeBorderline === '1';
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

    // ============================================================
    // Partición Diamond / Borderline (cuando includeBorderline=true)
    // ============================================================
    // Diamond: comboScore >= 65 AND preScore >= 60 AND technicalScore >= 60.
    // Borderline (1 razón gana, en orden): "fundamental fuerte, técnico
    // deprimido" (pre>=70 + tech<55) > "técnico fuerte, fundamental marginal"
    // (tech>=75 + pre<55) > "comboScore borderline" (50<=combo<=64).
    function borderlineReason(r) {
      const pre = r.preScore, tech = r.technicalScore, combo = r.comboScore;
      if (pre != null && tech != null && pre >= 70 && tech < 55) {
        return 'fundamental fuerte, técnico deprimido';
      }
      if (pre != null && tech != null && tech >= 75 && pre < 55) {
        return 'técnico fuerte, fundamental marginal';
      }
      if (combo != null && combo >= 50 && combo <= 64) {
        return 'comboScore borderline (50-64)';
      }
      return null;
    }
    function isDiamond(r) {
      return r.comboScore != null && r.preScore != null && r.technicalScore != null
        && r.comboScore >= 65 && r.preScore >= 60 && r.technicalScore >= 60;
    }

    let resultRows;
    let borderlineRows = null;
    if (includeBorderline) {
      const diamonds = rows.filter(isDiamond).slice(0, Math.min(8, limit));
      const diamondSet = new Set(diamonds.map((r) => r.symbol));
      const bordersUnsorted = rows
        .filter((r) => !diamondSet.has(r.symbol))
        .map((r) => ({ row: r, reason: borderlineReason(r) }))
        .filter((x) => x.reason != null);
      // Sort por comboScore desc (fallback preScore) y cap 5.
      bordersUnsorted.sort((a, b) => {
        const av = a.row.comboScore ?? a.row.preScore ?? -1;
        const bv = b.row.comboScore ?? b.row.preScore ?? -1;
        return bv - av;
      });
      resultRows = diamonds;
      // El cap de 5 hardcoded dejaba afuera nombres legítimos cuando hay 5+
      // candidatos por encima en combo (caso TILE: comboScore=54, 5 nombres
      // con combo 55-64 lo desplazaban). Ahora usamos el limit del query
      // (con piso de 5 para compat).
      const borderlineCap = Math.max(5, limit);
      borderlineRows = bordersUnsorted.slice(0, borderlineCap);
    } else {
      resultRows = rows.slice(0, limit);
    }

    function project(r, extra = {}) {
      return {
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
        ...extra,
      };
    }

    const out = resultRows.map((r) => project(r));
    const borderlineOut = borderlineRows
      ? borderlineRows.map((x) => project(x.row, { borderlineReason: x.reason }))
      : null;

    // Headers de observabilidad: edad del snapshot fundamental + técnico.
    const now = Date.now();
    const fundAgeH = hoursAgo(snap.meta?.updatedAt, now);
    const techAgeH = hoursAgo(snap.meta?.technicalUpdatedAt, now);
    if (fundAgeH != null) res.setHeader('X-Snapshot-Age-Hours', String(fundAgeH));
    if (techAgeH != null) res.setHeader('X-Technical-Age-Hours', String(techAgeH));
    if (sortFallback) res.setHeader('X-Sort-Fallback', '1');

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const body = {
      meta: {
        ...snap.meta,
        returned: out.length,
        returnedBorderline: borderlineOut ? borderlineOut.length : 0,
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
          includeBorderline,
        },
      },
      results: out,
    };
    if (borderlineOut) body.borderline = borderlineOut;
    return res.status(200).json(body);
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
