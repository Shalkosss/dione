/* Vercel serverless function — proxy para Yahoo Finance.
   Evita CORS: el browser llama /api/candles/VOO?..., esta función
   llama a Yahoo desde el servidor (sin restricción CORS) y reenvía. */

export default async function handler(req, res) {
  const { ticker, period1, period2, interval = "1d" } = req.query;

  if (!ticker || !period1 || !period2) {
    return res.status(400).json({ error: "params requeridos: ticker, period1, period2" });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${period1}&period2=${period2}&interval=${interval}`;

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DIONE-research/1.0)" },
    });
    const data = await r.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
