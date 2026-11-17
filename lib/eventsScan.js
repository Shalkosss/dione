// lib/eventsScan.js — Empresas del universo que reportaron en las últimas
// sesiones, con la reacción del precio (Fase 3, ítem 12; insumo de /scan-eventos).
//
// Puro: recibe lo ya bajado (presentaciones de EDGAR y velas de Yahoo) y arma
// la lista. La descarga la hace el cron refresh-smart-money.

import { extractEarnings, earningsReaction } from './earningsEvents.js';

export const RECENT_SESSIONS = 5;

// Velas de Yahoo [{t, c}] → [{date, close}] (formato de earningsReaction).
export const toSeries = (candles) => (candles || []).map((k) => ({ date: new Date(k.t * 1000).toISOString().slice(0, 10), close: k.c }));

// Fecha de inicio de la ventana: la sesión que está `sessions - 1` antes de la
// última, según el calendario real de SPY (respeta feriados).
export function windowStart(spySeries, sessions = RECENT_SESSIONS) {
  if (!spySeries?.length) return null;
  return spySeries[Math.max(0, spySeries.length - sessions)].date;
}

// filings: Map ticker → { name, recent }. Devuelve los 8-K 2.02 dentro de la ventana.
export function recentReporters(filings, since) {
  const out = [];
  for (const [ticker, f] of filings) {
    const latest = extractEarnings(f?.recent, { limit: 1 })[0];
    if (latest && latest.nyDate >= since) out.push({ ticker, name: f.name ?? null, ...latest });
  }
  return out;
}

// Agrega la reacción de precio y ordena: lo más reciente primero, y dentro del
// mismo día, la reacción más grande en valor absoluto.
export function withReactions(reporters, candlesByTicker) {
  return reporters
    .map((r) => ({ ...r, ...earningsReaction(r, toSeries(candlesByTicker.get(r.ticker))) }))
    .sort((a, b) => (a.nyDate === b.nyDate
      ? Math.abs(b.reaction ?? 0) - Math.abs(a.reaction ?? 0)
      : a.nyDate < b.nyDate ? 1 : -1));
}
