// lib/yahooSpark.js — Último precio y volumen de muchos símbolos por pedido.
//
// Yahoo /v7/finance/spark acepta hasta 20 símbolos por llamada y no pide crumb.
// Para el universo completo (~5.000) son ~250 pedidos en vez de 5.000. No está
// documentado: si deja de responder, los que falten quedan sin precio y el
// universo lo informa (no se rompe nada del scan de calidad).

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
export const SPARK_BATCH = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Puro: respuesta de spark → Map símbolo → { price, volume }.
export function parseSpark(json) {
  const out = new Map();
  for (const entry of json?.spark?.result || []) {
    const r = entry?.response?.[0];
    const meta = r?.meta;
    if (!entry?.symbol || !meta) continue;
    const closes = (r.indicators?.quote?.[0]?.close || []).filter((c) => typeof c === 'number' && c > 0);
    const price = typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0 ? meta.regularMarketPrice : closes.at(-1) ?? null;
    if (price == null) continue;
    out.set(entry.symbol, { price, volume: typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : null });
  }
  return out;
}

async function fetchOne(symbols) {
  const list = symbols.map(encodeURIComponent).join(',');
  for (const host of HOSTS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`https://${host}/v7/finance/spark?symbols=${list}&range=5d&interval=1d`, { headers: HEADERS, signal: ctrl.signal });
      if (res.ok) return parseSpark(await res.json());
      if (res.status === 429) await sleep(1000);
    } catch {
      // siguiente host
    } finally {
      clearTimeout(t);
    }
  }
  return new Map();
}

// Precio y volumen de `symbols` en tandas de 20, `concurrency` en paralelo,
// hasta `deadline` (epoch ms). Devuelve { prices, attempted }.
export async function fetchSparkPrices(symbols, { concurrency = 4, pauseMs = 250, deadline = Infinity } = {}) {
  const batches = [];
  for (let i = 0; i < symbols.length; i += SPARK_BATCH) batches.push(symbols.slice(i, i + SPARK_BATCH));
  const prices = new Map();
  let next = 0;
  let attempted = 0;
  const worker = async () => {
    while (next < batches.length && Date.now() < deadline) {
      const batch = batches[next++];
      attempted += batch.length;
      for (const [k, v] of await fetchOne(batch)) prices.set(k, v);
      if (pauseMs > 0) await sleep(pauseMs);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
  return { prices, attempted };
}
