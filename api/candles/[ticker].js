/* Vercel serverless function — proxy para Yahoo Finance.
   Evita CORS: el browser llama /api/candles/VOO?..., esta función
   llama a Yahoo desde el servidor (sin restricción CORS) y reenvía. */

const ALLOWED_INTERVALS = new Set(["1d", "1wk", "1mo"]);

function asUnixInt(v) {
  // Yahoo period1/period2 son timestamps unix en segundos (10 dígitos).
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 9_999_999_999) return null;
  return n;
}

export default async function handler(req, res) {
  const { ticker, period1, period2, interval = "1d" } = req.query;

  if (!ticker || !/^[A-Za-z0-9._-]{1,12}$/.test(String(ticker))) {
    return res.status(400).json({ error: "ticker inválido" });
  }
  const p1 = asUnixInt(period1);
  const p2 = asUnixInt(period2);
  if (p1 == null || p2 == null || p2 <= p1) {
    return res.status(400).json({ error: "period1/period2 deben ser unix int y period2 > period1" });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return res.status(400).json({ error: `interval inválido (permitidos: ${[...ALLOWED_INTERVALS].join(", ")})` });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${p1}&period2=${p2}&interval=${interval}`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DIONE-research/1.0)" },
    });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
