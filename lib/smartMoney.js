// lib/smartMoney.js — Señales smart money por símbolo.
//
// Fuentes (Fase 3, ítem 11: la web funciona sin key):
//   Insiders  → Form 4 de SEC EDGAR (lib/form4.js, los baja el cron). Sin key.
//   Analistas → /stock/recommendation de Finnhub. Opcional: sin FINNHUB_KEY
//               queda en null y no suma puntos.
// 13F y dark pool siguen fuera (se pegan a mano desde Bloomberg).
//
// El score va de 0 a 100:
//   Insider cluster   (40) — compras netas en $ últimos 90d + nº de compradores
//   Analyst drift     (30) — cambio de recomendaciones de compra contra el mes previo
//   Insider quality   (20) — CEO/CFO comprando más de $500K
//   Recency           (10) — penaliza si la última transacción es vieja

const KEY = process.env.FINNHUB_KEY || '';
const BASE = 'https://finnhub.io/api/v1';

export const analystsAvailable = () => Boolean(KEY);

async function fetchJson(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Diferencia de recomendaciones entre los dos últimos meses. Puro.
export function analystDrift(data) {
  const rows = Array.isArray(data) ? [...data] : [];
  if (rows.length < 2) return { upgradesMinusDowngrades: 0, latestTrendDate: null };
  rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const latest = rows[rows.length - 1];
  const prior = rows[rows.length - 2];
  const bullDelta = (latest.strongBuy + latest.buy) - (prior.strongBuy + prior.buy);
  const bearDelta = (latest.strongSell + latest.sell) - (prior.strongSell + prior.sell);
  return { upgradesMinusDowngrades: bullDelta - bearDelta, latestTrendDate: latest.period || null };
}

async function analystSignal(symbol) {
  if (!KEY) return null;
  const j = await fetchJson(`${BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${KEY}`);
  return j ? analystDrift(j) : null;
}

const NO_INSIDER = Object.freeze({ netUSD: 0, uniqueInsiders: 0, topExecBuy: 0, lastTransactionDays: null });

// Puntaje con las dos señales ya calculadas. Puro.
export function scoreSmartMoney(insider, analyst) {
  const ins = insider || NO_INSIDER;
  let cluster = 0;
  if (ins.netUSD > 0) {
    if (ins.netUSD > 5_000_000) cluster += 25;
    else if (ins.netUSD > 1_000_000) cluster += 15;
    else if (ins.netUSD > 250_000) cluster += 8;
    if (ins.uniqueInsiders >= 3) cluster += 15;
    else if (ins.uniqueInsiders === 2) cluster += 8;
  }
  cluster = Math.min(40, cluster);

  const drift = analyst ? Math.max(0, Math.min(30, analyst.upgradesMinusDowngrades * 3)) : 0;

  let execQ = 0;
  if (ins.topExecBuy >= 5_000_000) execQ = 20;
  else if (ins.topExecBuy >= 1_000_000) execQ = 12;
  else if (ins.topExecBuy >= 500_000) execQ = 6;

  let recency = 10;
  if (ins.lastTransactionDays == null || ins.lastTransactionDays > 90) recency = 0;
  else if (ins.lastTransactionDays > 60) recency = 5;

  const score = Math.round(cluster + drift + execQ + recency);
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { cluster, drift, execQ, recency },
    insider: insider ?? null,
    analyst: analyst ?? null,
  };
}

// insiders: Map símbolo → resumen de lib/form4.js. Los que no están quedan en null.
export async function computeSmartMoneyBatch(symbols, { insiders = new Map(), concurrency = 4, throttleMs = 60 } = {}) {
  const out = new Map();
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (idx < symbols.length) {
      const s = symbols[idx++];
      // Sin dato de insiders (sin CIK o el cron no llegó) no se puntúa: un 0
      // parecería una señal real.
      if (!insiders.has(s)) { out.set(s, null); continue; }
      try {
        out.set(s, scoreSmartMoney(insiders.get(s) ?? null, await analystSignal(s)));
      } catch (e) {
        console.warn('[smartMoney]', s, e.message);
        out.set(s, null);
      }
      if (KEY && throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}
