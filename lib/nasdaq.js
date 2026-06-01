// lib/nasdaq.js — Universo del screener vía el screener público de NASDAQ.
//
// api.nasdaq.com devuelve TODO el listado US (NASDAQ/NYSE/AMEX) con market cap
// y último precio en una llamada por exchange. De acá sale el DESCUBRIMIENTO:
// filtramos a Tier 3 ($300M–$2B, precio > $3) y el resultado es dinámico —
// cada corrida trae el universo vivo, así aparecen tickers nuevos solos.
//
// Es un endpoint no-oficial: requiere User-Agent de browser y puede cambiar.
// El XBRL de EDGAR no tiene precio/market cap, por eso esta pieza vive aparte.

const NASDAQ_BASE = 'https://api.nasdaq.com/api/screener/stocks';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; DIONE-research/1.0)',
  Accept: 'application/json',
};

// "$1,234,567" | "$12.34" → número, o null si no parsea.
function parseMoney(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

async function fetchExchange(exchange) {
  const url = `${NASDAQ_BASE}?tableonly=true&download=true&exchange=${exchange}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    const json = await res.json();
    return json?.data?.table?.rows || json?.data?.rows || [];
  } finally {
    clearTimeout(t);
  }
}

export async function fetchUniverse({
  capMin = 300_000_000,
  capMax = 2_000_000_000,
  priceMin = 3,
} = {}) {
  const exchanges = ['NASDAQ', 'NYSE', 'AMEX'];
  const seen = new Set();
  const out = [];

  for (const ex of exchanges) {
    let rows = [];
    try { rows = await fetchExchange(ex); }
    catch (e) { console.warn(`[nasdaq] ${ex} falló: ${e.message}`); continue; }

    for (const r of rows) {
      const symbol = (r.symbol || '').trim().toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      if (/[^A-Z]/.test(symbol)) continue; // saca warrants/units/clases con . ^ /
      const cap = parseMoney(r.marketCap);
      const price = parseMoney(r.lastsale);
      if (cap == null || cap < capMin || cap > capMax) continue;
      if (price == null || price < priceMin) continue;
      seen.add(symbol);
      out.push({
        symbol,
        name: (r.name || '').replace(/\s+Common Stock$/i, '').trim() || null,
        sector: r.sector || null,
        industry: r.industry || null,
        marketCap: cap,
        price,
        exchange: ex,
      });
    }
  }
  return out;
}
