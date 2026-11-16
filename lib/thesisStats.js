// lib/thesisStats.js — Métricas de eficiencia de los deeps (función pura).
//
// Spec: project-docs/THESIS_LOG.md sección 6. Trabaja solo con la tabla
// `theses`: el tracker ya dejó en `perf` el retorno y el alfa a 20, 60 y 120
// sesiones medidos desde ref_price, así que no hace falta leer las marcas.

const HORIZON_KEYS = ['h20', 'h60', 'h120'];
const CLOSED_TRADES = ['CERRADA_TP', 'CERRADA_STOP', 'CERRADA_TIEMPO', 'CERRADA_TESIS'];
const LIMIT_RESOLVED = [...CLOSED_TRADES, 'ABIERTA', 'EXPIRADA', 'INVALIDADA'];

const round6 = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);
const mean = (xs) => (xs.length ? round6(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round6(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};
const present = (xs) => xs.filter((x) => x != null && Number.isFinite(x));

function horizonSummary(theses, field) {
  return Object.fromEntries(HORIZON_KEYS.map((hk) => {
    const xs = present(theses.map((t) => t.perf?.[hk]?.[field]));
    return [hk, { n: xs.length, mean: mean(xs), median: median(xs) }];
  }));
}

function groupBy(theses, keyFn, field) {
  const groups = new Map();
  for (const t of theses) {
    const key = keyFn(t);
    if (key == null || key === '') continue;
    groups.set(String(key), [...(groups.get(String(key)) || []), t]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({ key, n: items.length, ...horizonSummary(items, field) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

function alphaTables(theses, field) {
  return {
    overall: { n: theses.length, ...horizonSummary(theses, field) },
    byRating: groupBy(theses, (t) => t.rating, field),
    byConviction: groupBy(theses, (t) => t.conviction, field),
    bySector: groupBy(theses, (t) => t.sector, field),
    bySectorView: groupBy(theses, (t) => t.sector_view, field),
    byTrendLabel: groupBy(theses, (t) => t.trend_label, field),
  };
}

function limitStats(theses) {
  const limits = theses.filter((t) => t.order_type === 'LIMIT');
  const resolved = limits.filter((t) => LIMIT_RESOLVED.includes(t.status));
  const filled = resolved.filter((t) => t.filled_at != null);
  return {
    emitted: limits.length,
    resolved: resolved.length,
    filled: filled.length,
    fillRate: resolved.length ? round6(filled.length / resolved.length) : null,
    medianSessionsToFill: median(present(filled.map((t) => t.sessions_to_fill))),
  };
}

function expiredStats(theses) {
  const expired = theses.filter((t) => t.status === 'EXPIRADA');
  return {
    n: expired.length,
    avgMissedRet: mean(present(expired.map((t) => t.perf?.last?.ret))),
    avgMissedAlphaSpy: mean(present(expired.map((t) => t.perf?.last?.alpha_spy))),
  };
}

function tradeStats(theses) {
  const rs = present(theses.filter((t) => CLOSED_TRADES.includes(t.status)).map((t) => t.r_multiple));
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r <= 0);
  return {
    n: rs.length,
    winRate: rs.length ? round6(wins.length / rs.length) : null,
    avgR: mean(rs),          // con R por trade, la expectativa es el R promedio
    expectancy: mean(rs),
    avgWinR: mean(wins),
    avgLossR: mean(losses),
  };
}

export function computeThesisStats(theses) {
  const list = theses || [];
  const byStatus = list.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});
  return {
    total: list.length,
    flagged: list.filter((t) => (t.flags || []).length > 0).length,
    byStatus,
    limit: limitStats(list),
    expired: expiredStats(list),
    trades: tradeStats(list),
    alpha: alphaTables(list, 'alpha_spy'),
    alphaEtf: alphaTables(list, 'alpha_etf'),
  };
}
