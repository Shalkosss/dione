// lib/smartMoney.js — Computa señales smart money por símbolo desde Finnhub.
//
// Free tier de Finnhub cubre:
//   /stock/insider-transactions  → Form 4
//   /stock/recommendation        → consensus drift (analystas)
// NO cubre 13F directo ni dark pool — esos quedan como paste manual desde
// Bloomberg. Lo que sí podemos cuantificar es insider clusters + analyst drift.
//
// El score combinado va de 0 a 100, ponderando:
//   Insider cluster   (40) — net buying $ últimos 90d + nº de insiders únicos
//   Analyst drift     (30) — # de upgrades - downgrades en últimos 30d
//   Insider quality   (20) — CEO/CFO recientes con buys > $500K
//   Recency           (10) — penalty si la última señal es vieja
//
// Se llama dentro del cron refresh-smart-money. Es tolerante a fallos:
// si Finnhub responde 4xx para un símbolo, devuelve null en vez de tirar.

const KEY = process.env.FINNHUB_KEY || '';
const BASE = 'https://finnhub.io/api/v1';

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

// últimos 90 días en YYYY-MM-DD
function dateRange(daysBack) {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 86400_000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

async function insiderSignal(symbol) {
  if (!KEY) return { netUSD: 0, uniqueInsiders: 0, topExecBuy: 0, lastTransactionDays: null };
  const { from, to } = dateRange(90);
  const url = `${BASE}/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${KEY}`;
  const j = await fetchJson(url);
  const data = Array.isArray(j?.data) ? j.data : [];
  if (data.length === 0) return { netUSD: 0, uniqueInsiders: 0, topExecBuy: 0, lastTransactionDays: null };

  let netUSD = 0;
  let topExecBuy = 0;
  const insiders = new Set();
  let mostRecent = 0;
  for (const tx of data) {
    const change = Number(tx.change || 0);
    const price = Number(tx.transactionPrice || 0);
    const dollars = change * price; // change>0=buy, <0=sell
    if (Number.isFinite(dollars)) netUSD += dollars;
    if (tx.name) insiders.add(tx.name);
    const txDate = tx.transactionDate ? new Date(tx.transactionDate).getTime() : 0;
    if (txDate > mostRecent) mostRecent = txDate;
    // Heurística de CEO/CFO: el campo position en Finnhub viene como string libre.
    const pos = String(tx.position || '').toLowerCase();
    if ((pos.includes('chief executive') || pos.includes('chief financial') || pos.includes('ceo') || pos.includes('cfo')) && dollars > 500_000) {
      if (dollars > topExecBuy) topExecBuy = dollars;
    }
  }
  const lastTransactionDays = mostRecent
    ? Math.round((Date.now() - mostRecent) / 86400_000)
    : null;
  return { netUSD, uniqueInsiders: insiders.size, topExecBuy, lastTransactionDays };
}

async function analystSignal(symbol) {
  if (!KEY) return { upgradesMinusDowngrades: 0, latestTrendDate: null };
  const url = `${BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${KEY}`;
  const j = await fetchJson(url);
  const data = Array.isArray(j) ? j : [];
  if (data.length < 2) return { upgradesMinusDowngrades: 0, latestTrendDate: null };
  // ordenar por period asc y tomar últimos 2 meses
  data.sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const latest = data[data.length - 1];
  const prior = data[data.length - 2];
  const bullDelta = (latest.strongBuy + latest.buy) - (prior.strongBuy + prior.buy);
  const bearDelta = (latest.strongSell + latest.sell) - (prior.strongSell + prior.sell);
  return {
    upgradesMinusDowngrades: bullDelta - bearDelta,
    latestTrendDate: latest.period || null,
  };
}

export async function computeSmartMoneyScore(symbol) {
  const [insider, analyst] = await Promise.all([
    insiderSignal(symbol),
    analystSignal(symbol),
  ]);

  // 1. Insider cluster: net USD + diversidad de insiders.
  let cluster = 0;
  if (insider.netUSD > 0) {
    if (insider.netUSD > 5_000_000) cluster += 25;
    else if (insider.netUSD > 1_000_000) cluster += 15;
    else if (insider.netUSD > 250_000) cluster += 8;
    if (insider.uniqueInsiders >= 3) cluster += 15;
    else if (insider.uniqueInsiders === 2) cluster += 8;
  }
  cluster = Math.min(40, cluster);

  // 2. Analyst drift (-30 a +30 escalado a 0-30)
  const drift = Math.max(0, Math.min(30, insider ? analyst.upgradesMinusDowngrades * 3 : 0));

  // 3. Top exec quality
  let execQ = 0;
  if (insider.topExecBuy >= 5_000_000) execQ = 20;
  else if (insider.topExecBuy >= 1_000_000) execQ = 12;
  else if (insider.topExecBuy >= 500_000) execQ = 6;

  // 4. Recency penalty: si lastTransactionDays > 60 → -5; > 90 → -10.
  let recency = 10;
  if (insider.lastTransactionDays == null) recency = 0;
  else if (insider.lastTransactionDays > 90) recency = 0;
  else if (insider.lastTransactionDays > 60) recency = 5;

  const score = Math.round(cluster + drift + execQ + recency);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { cluster, drift, execQ, recency },
    insider,
    analyst,
  };
}

export async function computeSmartMoneyBatch(symbols, { concurrency = 4, throttleMs = 60 } = {}) {
  const out = new Map();
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (idx < symbols.length) {
      const s = symbols[idx++];
      try {
        out.set(s, await computeSmartMoneyScore(s));
      } catch (e) {
        console.warn('[smartMoney]', s, e.message);
        out.set(s, null);
      }
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}
