// api/cron/refresh-gems.js — Precompute del universo Tier-3 (hidden gems).
//
// Fuentes 100% gratis y reachable desde la nube:
//   SEC EDGAR (XBRL) → universo + fundamentales + acciones en circulación.
//   Stooq           → precio + nombre (el XBRL no tiene cotización).
// market cap = precio × acciones. (NASDAQ se descartó: bloquea IPs de nube.)
//
// EDGAR vía "frames" trae todas las empresas en pocas llamadas → recomputa el
// universo COMPLETO en una corrida (<60s), sin rotación por chunks.
//
// Disparado por Vercel Cron 1x/día (GET), protegido por CRON_SECRET.

import {
  fetchTickerCikMap, fetchRawFactsByCik, fetchSharesByCik, computeMetrics,
} from '../../lib/edgar.js';
import { fetchPrices } from '../../lib/stooq.js';
import { qualityGate, preScore } from '../../lib/scoring.js';
import { writeSnapshot } from '../../lib/store.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();

  // --- DIAGNÓSTICO: /api/cron/refresh-gems?probe=ping|tickers|edgar|stooq ---
  // Aísla cada fuente para detectar timeouts/bloqueos desde la nube. Borrar
  // cuando el pipeline esté estable.
  const probe = (req.query && req.query.probe) || '';
  if (probe) {
    try {
      if (probe === 'ping') return res.status(200).json({ ok: true, probe, ms: Date.now() - t0 });
      if (probe === 'tickers') {
        const m = await fetchTickerCikMap();
        return res.status(200).json({ ok: true, probe, size: m.size, ms: Date.now() - t0 });
      }
      if (probe === 'stooq') {
        const p = await fetchPrices(['AAPL', 'CRMD', 'ADMA']);
        return res.status(200).json({ ok: true, probe, got: [...p.entries()], ms: Date.now() - t0 });
      }
      if (probe === 'edgar') {
        const e = await fetchRawFactsByCik({});
        return res.status(200).json({ ok: true, probe, coverage: e.coverage, year: e.year, ms: Date.now() - t0 });
      }
      return res.status(400).json({ error: 'probe inválido', got: probe });
    } catch (e) {
      return res.status(500).json({ error: e.message, probe, ms: Date.now() - t0 });
    }
  }

  try {
    // 1) EDGAR en paralelo: mapa ticker→cik, fundamentales, acciones
    const year = process.env.GEMS_YEAR ? Number(process.env.GEMS_YEAR) : undefined;
    const [cikMap, edgar, sharesByCik] = await Promise.all([
      fetchTickerCikMap(),
      fetchRawFactsByCik({ year }),
      fetchSharesByCik(),
    ]);

    if (!edgar.coverage) {
      return res.status(502).json({ error: 'EDGAR sin datos — revisar SEC_USER_AGENT o data.sec.gov' });
    }

    // cik → ticker (primer ticker por cik)
    const cikToTicker = new Map();
    for (const [t, c] of cikMap) if (!cikToTicker.has(c)) cikToTicker.set(c, t);

    // 2) PASS 1 — quality gate con métricas cap-independientes (ROE, FCF, D/E).
    //    Esto filtra ~5k empresas a unos cientos sin necesitar precio todavía.
    const passers = [];
    for (const [cik, raw] of edgar.facts) {
      const ticker = cikToTicker.get(cik);
      if (!ticker) continue; // sin ticker mapeado (no cotiza, etc.)
      const f0 = computeMetrics(ticker, raw);
      if (qualityGate(f0).pass) passers.push({ ticker, cik, raw });
    }

    // 3) precio de los que pasan (Stooq, en batches) → market cap
    const prices = await fetchPrices(passers.map((p) => p.ticker));

    const now = Date.now();
    const gems = {};
    let priced = 0;
    for (const p of passers) {
      const pr = prices.get(p.ticker);
      const shares = sharesByCik.get(p.cik) ?? null;
      const cap = pr?.price != null && shares != null ? pr.price * shares : null;
      if (cap != null) priced++;
      const f = computeMetrics(p.ticker, p.raw, cap, pr?.price ?? null);
      gems[p.ticker] = {
        symbol: p.ticker,
        name: pr?.name ?? null,
        sector: null, // EDGAR/Stooq no lo dan acá; se enriquece en /deep
        marketCap: cap,
        price: pr?.price ?? null,
        sharesOutstanding: shares,
        ...f,
        gatePass: true,
        gateReasons: [],
        preScore: preScore(f),
        lastChecked: now,
      };
    }

    const snapshot = {
      gems,
      meta: {
        updatedAt: new Date().toISOString(),
        fiscalYear: edgar.year,
        secCoverage: edgar.coverage,
        gatePassers: passers.length,
        priced,
        totalTracked: Object.keys(gems).length,
        ms: Date.now() - t0,
        sources: { fundamentals: 'sec-edgar-xbrl', price: 'stooq' },
      },
    };

    await writeSnapshot(snapshot);
    return res.status(200).json({ ok: true, ...snapshot.meta });
  } catch (e) {
    console.error('[refresh-gems]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
