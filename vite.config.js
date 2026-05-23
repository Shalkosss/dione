import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Plugin de dev — simula la Vercel function api/quote/[ticker].js
  // En prod corre como serverless function en Vercel (con FINNHUB_KEY del entorno).
  // En dev `npm run dev`, este middleware atiende /api/quote/<ticker> con la key
  // local de .env.local — así el cliente nunca conoce la key.
  const devQuoteShim = {
    name: "dione-dev-quote-shim",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url && req.url.match(/^\/api\/quote\/([^?]+)/);
        if (!match) return next();

        const ticker = decodeURIComponent(match[1]).toUpperCase().trim();
        const key = env.FINNHUB_KEY || env.VITE_FINNHUB_KEY;

        res.setHeader("Content-Type", "application/json");

        if (!ticker) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: "Missing ticker" }));
        }
        if (!key) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: "FINNHUB_KEY no configurada en .env.local" }));
        }

        try {
          const [quote, profile] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`).then((r) => r.json()),
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`)
              .then((r) => r.json())
              .catch(() => ({})),
          ]);

          if (!quote.c && !quote.pc) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: `Ticker ${ticker} no encontrado en Finnhub` }));
          }

          res.end(JSON.stringify({
            ticker,
            fetchedAt: new Date().toISOString(),
            price: quote.c ?? null,
            change: quote.d ?? null,
            changePct: quote.dp != null ? quote.dp / 100 : null,
            high: quote.h ?? null,
            low: quote.l ?? null,
            open: quote.o ?? null,
            prevClose: quote.pc ?? null,
            timestamp: quote.t ? quote.t * 1000 : null,
            name: profile.name ?? null,
            sector: profile.finnhubIndustry ?? null,
            currency: profile.currency ?? "USD",
            exchange: profile.exchange ?? null,
            marketCap: profile.marketCapitalization ?? null,
          }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message, ticker }));
        }
      });
    },
  };

  return {
    plugins: [react(), devQuoteShim],
    server: {
      port: 5173,
      proxy: {
        // /api/candles/VOO?... → query1.finance.yahoo.com/v8/finance/chart/VOO?...
        // En prod lo levanta api/candles/[ticker].js (Vercel function).
        "/api/candles": {
          target: "https://query1.finance.yahoo.com",
          changeOrigin: true,
          rewrite: (path) => path.replace("/api/candles", "/v8/finance/chart"),
        },
      },
    },
  };
});
