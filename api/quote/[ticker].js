// api/quote/[ticker].js — Quote en tiempo real via Finnhub.
// GET /api/quote/AAPL  ->  { ticker, price, change, changePct, high, low, open, prevClose, ... }
//
// Lee la API key de Finnhub desde el entorno. En Vercel, configurar como FINNHUB_KEY
// (sin prefijo VITE_) en Settings → Environment Variables, así no se expone al bundle.
// Para dev local fallbackea a VITE_FINNHUB_KEY del .env.local.

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function getKey() {
  return process.env.FINNHUB_KEY || process.env.VITE_FINNHUB_KEY || "";
}

async function finnhub(path) {
  const key = getKey();
  if (!key) throw new Error("FINNHUB_KEY no configurada");
  const url = `${FINNHUB_BASE}${path}${path.includes("?") ? "&" : "?"}token=${key}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Finnhub HTTP ${resp.status}: ${text.slice(0, 160)}`);
  }
  return resp.json();
}

export default async function handler(req, res) {
  const ticker = String(req.query.ticker || "").toUpperCase().trim();
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  try {
    // Quote y profile en paralelo. Profile puede fallar (símbolos no-US) — lo toleramos.
    const [quote, profile] = await Promise.all([
      finnhub(`/quote?symbol=${encodeURIComponent(ticker)}`),
      finnhub(`/stock/profile2?symbol=${encodeURIComponent(ticker)}`).catch(() => ({})),
    ]);

    // Finnhub devuelve 0 en todos los campos si el ticker no existe.
    if (!quote.c && !quote.pc) {
      return res.status(404).json({ error: `Ticker ${ticker} no encontrado en Finnhub` });
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      ticker,
      fetchedAt: new Date().toISOString(),
      price: quote.c ?? null,
      change: quote.d ?? null,
      changePct: quote.dp != null ? quote.dp / 100 : null, // Finnhub manda 1.23 = 1.23%
      high: quote.h ?? null,
      low: quote.l ?? null,
      open: quote.o ?? null,
      prevClose: quote.pc ?? null,
      timestamp: quote.t ? quote.t * 1000 : null,
      // Profile (puede venir vacío)
      name: profile.name ?? null,
      sector: profile.finnhubIndustry ?? null,
      currency: profile.currency ?? "USD",
      exchange: profile.exchange ?? null,
      marketCap: profile.marketCapitalization ?? null, // en millones USD
      logo: profile.logo ?? null,
      weburl: profile.weburl ?? null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, ticker });
  }
}
