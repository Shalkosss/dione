// lib/yahoo.js — Helper minimalista para bajar candles desde Yahoo Finance.
//
// Yahoo no requiere API key, sí headers de browser real. Rate limit conservador.
// Tolerante a fallos: símbolo individual que falla devuelve null, no rompe el batch.

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com/',
};

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

async function fetchOne(symbol, period1, period2, interval = '1d') {
  // 2 intentos por host, con backoff y jitter. Yahoo a veces tira 429 esporádicos.
  for (const host of HOSTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}` +
                  `?period1=${period1}&period2=${period2}&interval=${interval}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
        if (res.status === 429 || res.status >= 500) {
          // backoff exponencial con jitter (250-750ms, luego 500-1500ms)
          const base = 250 * (attempt + 1);
          await new Promise((r) => setTimeout(r, base + Math.random() * base));
          continue;
        }
        if (!res.ok) break; // 4xx no recuperable → next host
        const j = await res.json();
        const r = j?.chart?.result?.[0];
        if (!r) break;
        const ts = r.timestamp || [];
        const q = r.indicators?.quote?.[0] || {};
        const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];
        const candles = [];
        for (let i = 0; i < ts.length; i++) {
          if (c[i] == null || h[i] == null || l[i] == null) continue;
          candles.push({
            t: ts[i],
            o: o[i] ?? c[i],
            h: h[i],
            l: l[i],
            c: c[i],
            v: v[i] ?? 0,
          });
        }
        return candles;
      } catch {
        // network error → reintenta si attempt 0, sino break al next host
        if (attempt === 0) await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
      } finally {
        clearTimeout(t);
      }
    }
  }
  return null;
}

// quoteSummary assetProfile: sector + industry + longName (sin API key).
async function fetchProfileOne(symbol) {
  for (const host of HOSTS) {
    const url = `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.quoteSummary?.result?.[0];
      if (!r) continue;
      const ap = r.assetProfile || {};
      const pr = r.price || {};
      const sector = ap.sector || null;
      const industry = ap.industry || null;
      const name = pr.longName || pr.shortName || null;
      if (!sector && !industry && !name) continue;
      return { sector, industry, name };
    } catch {
      // try next host
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

export async function fetchProfilesBatch(symbols, { concurrency = 4, throttleMs = 250 } = {}) {
  const out = new Map();
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (idx < symbols.length) {
      const s = symbols[idx++];
      const p = await fetchProfileOne(s);
      if (p) out.set(s, p);
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}

// Bajada en paralelo limitado. Devuelve Map symbol → candles[] (o null si falló).
export async function fetchCandlesBatch(symbols, { days = 400, concurrency = 5, throttleMs = 200 } = {}) {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - days * 24 * 3600;
  const out = new Map();
  let idx = 0;

  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (idx < symbols.length) {
      const s = symbols[idx++];
      const candles = await fetchOne(s, period1, period2);
      out.set(s, candles);
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}
