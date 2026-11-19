import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Plugin de dev — atiende /api/quote/<ticker> con la misma función de Vercel
  // (api/quote/[ticker].js). No necesita key: usa Yahoo, y Finnhub solo si
  // FINNHUB_KEY está en .env.local.
  const devQuoteShim = {
    name: "dione-dev-quote-shim",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url && req.url.match(/^\/api\/quote\/([^?]+)/);
        if (!match) return next();

        // Ejecuta la misma función de Vercel (Yahoo sin key; Finnhub opcional).
        if (env.FINNHUB_KEY) process.env.FINNHUB_KEY = env.FINNHUB_KEY;
        const qs = new URLSearchParams(req.url.split("?")[1] || "");
        req.query = { ...Object.fromEntries(qs), ticker: decodeURIComponent(match[1]) };
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(obj));
        };
        try {
          const mod = await server.ssrLoadModule("/api/quote/[ticker].js");
          await mod.default(req, res);
        } catch (e) {
          res.status(500).json({ error: `dev shim: ${e.message}` });
        }
      });
    },
  };

  // Plugin de dev — sirve /api/theses, /api/theses/<id> (incluido /api/theses/ledger) y /api/events ejecutando las mismas
  // funciones de Vercel (api/theses.js y api/theses/[id].js). Necesita en
  // .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y THESES_TOKEN.
  const devThesesShim = {
    name: "dione-dev-theses-shim",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const isEvents = url.pathname === "/api/events";
        const match = isEvents ? ["/api/events"] : url.pathname.match(/^\/api\/theses(?:\/([^/]+))?$/);
        if (!match) return next();

        for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "THESES_TOKEN", "SEC_USER_AGENT"]) {
          if (env[k]) process.env[k] = env[k];
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString("utf8");
        const isJson = String(req.headers["content-type"] || "").includes("application/json");

        req.query = {
          ...Object.fromEntries(url.searchParams),
          ...(match[1] ? { id: decodeURIComponent(match[1]) } : {}),
        };
        try {
          req.body = isJson && text ? JSON.parse(text) : text;
        } catch {
          req.body = text;
        }
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(obj));
        };

        try {
          const file = isEvents ? "/api/events.js" : match[1] ? "/api/theses/[id].js" : "/api/theses.js";
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (e) {
          res.status(500).json({ success: false, error: `dev shim: ${e.message}` });
        }
      });
    },
  };

  return {
    plugins: [react(), devQuoteShim, devThesesShim],
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
