// lib/spyWeights.js — Pesos sectoriales del S&P 500 desde la ficha de SPY en
// SSGA (Fase 2.3). La página publica cada día el "Index Sector Breakdown"
// dentro de un atributo HTML con JSON escapado; no pide key.
//
//   parseSectorBreakdown(html)  puro: { asOf, weights } con nombres GICS y
//                               pesos en fracción, o null si no lo encuentra.
//   fetchSpyWeights()           baja la página y la parsea (null si falla).
//
// Lo llama refresh-technical (10:00 UTC) y lo guarda en meta.market.spyWeights.

export const SPY_PAGE = 'https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy';

const GICS_NAMES = new Set([
  'Communication Services', 'Consumer Discretionary', 'Consumer Staples', 'Energy', 'Financials',
  'Health Care', 'Industrials', 'Information Technology', 'Materials', 'Real Estate', 'Utilities',
]);
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

const decode = (s) => s.replace(/&#34;|&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function toIsoDate(text) {
  const m = String(text || '').match(/([A-Z][a-z]{2})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  return m && MONTHS[m[1]] ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, '0')}` : null;
}

function breakdown(html, label) {
  const re = new RegExp(`"(\\{(?:&#34;|&quot;)label(?:&#34;|&quot;):(?:&#34;|&quot;)${label}[^"]*)"`);
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(decode(m[1]));
  } catch {
    return null;
  }
}

export function parseSectorBreakdown(html) {
  if (typeof html !== 'string') return null;
  const data = breakdown(html, 'Index Sector Breakdown') || breakdown(html, 'Fund Sector Breakdown');
  if (!Array.isArray(data?.attrArray)) return null;
  const weights = {};
  for (const row of data.attrArray) {
    const name = row?.name?.value;
    const pct = Number(row?.weight?.originalValue ?? String(row?.weight?.value || '').replace('%', ''));
    if (GICS_NAMES.has(name) && Number.isFinite(pct) && pct >= 0) weights[name] = pct / 100;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  // Una tabla incompleta o rota no reemplaza a la anterior.
  // La cartera necesita los 11 sectores (benchFromGics): con menos no se guarda.
  if (Object.keys(weights).length < 11 || total < 0.95 || total > 1.05) return null;
  return { asOf: toIsoDate(data.asOfDateSimple || data.asOfDate), weights, source: 'SSGA (SPY)' };
}

export async function fetchSpyWeights({ timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(SPY_PAGE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      signal: ctrl.signal,
    });
    return res.ok ? parseSectorBreakdown(await res.text()) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
