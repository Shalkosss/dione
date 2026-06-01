// lib/stooq.js — Precios desde Stooq (CSV gratis, sin key, reachable desde nube).
//
// El XBRL de EDGAR no tiene cotización; Stooq la da en batches (varios símbolos
// por llamada) y de yapa el nombre de la empresa. Con precio × acciones (EDGAR)
// armamos el market cap. api.nasdaq.com quedó descartado: bloquea IPs de
// datacenter (cuelga desde Vercel), Stooq no.

const BASE = 'https://stooq.com/q/l/';

async function fetchBatch(chunk, out) {
  const s = chunk.map((x) => x.toLowerCase().replace(/\./g, '-') + '.us').join('+');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${BASE}?s=${s}&f=sd2t2ohlcvn&h&e=csv`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DIONE-research/1.0)' },
      signal: ctrl.signal,
    });
    const text = await res.text();
    for (const line of text.trim().split('\n').slice(1)) {
      const cols = line.split(',');
      const sym = (cols[0] || '').replace(/\.US$/i, '').replace(/-/g, '.').toUpperCase();
      const close = Number(cols[6]);
      const name = (cols[8] || '').trim();
      if (sym && Number.isFinite(close) && close > 0) out.set(sym, { price: close, name: name || null });
    }
  } catch (e) {
    console.warn('[stooq] batch falló:', e.message);
  } finally {
    clearTimeout(t);
  }
}

// symbols: array de tickers en MAYÚSCULA. → Map ticker→{ price, name }.
// Batches grandes y en paralelo (limitado) para entrar cómodo en el budget de
// la serverless function.
export async function fetchPrices(symbols, { batch = 100, concurrency = 5 } = {}) {
  const out = new Map();
  const chunks = [];
  for (let i = 0; i < symbols.length; i += batch) chunks.push(symbols.slice(i, i + batch));

  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
    while (i < chunks.length) await fetchBatch(chunks[i++], out);
  });
  await Promise.all(workers);
  return out;
}
