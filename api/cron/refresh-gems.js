// api/cron/refresh-gems.js — Precompute del universo Tier-3 (hidden gems).
//
// Fuentes 100% gratis: NASDAQ (universo + cap + precio) y SEC EDGAR (XBRL).
// Como EDGAR vía "frames" trae todas las empresas en ~15 llamadas, NO hay
// rotación por chunks: cada corrida recomputa el universo COMPLETO en <60s.
//
// Disparado por Vercel Cron 1x/día. Cron triggers = GET, protegido por
// CRON_SECRET (Vercel lo manda como `Authorization: Bearer <secret>`).

import { fetchUniverse } from '../../lib/nasdaq.js';
import { fetchTickerCikMap, fetchRawFactsByCik, computeMetrics } from '../../lib/edgar.js';
import { qualityGate, preScore } from '../../lib/scoring.js';
import { writeSnapshot } from '../../lib/store.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    // 1) universo dinámico (NASDAQ) + mapa ticker→CIK + facts XBRL (EDGAR)
    const [universe, cikMap, edgar] = await Promise.all([
      fetchUniverse(),
      fetchTickerCikMap(),
      fetchRawFactsByCik({ year: process.env.GEMS_YEAR ? Number(process.env.GEMS_YEAR) : undefined }),
    ]);

    if (!universe.length) {
      return res.status(502).json({ error: 'universo NASDAQ vacío — revisar api.nasdaq.com' });
    }

    // 2) cruzar: para cada ticker del universo, buscar sus facts por CIK
    const now = Date.now();
    const gems = {};
    let withFacts = 0, passing = 0;

    for (const u of universe) {
      const cik = cikMap.get(u.symbol);
      const raw = cik != null ? edgar.facts.get(cik) : null;
      if (!raw) continue; // sin datos SEC (ADR extranjero, sin filings, etc.)
      withFacts++;

      const f = computeMetrics(u.symbol, raw, u.marketCap, u.price);
      const gate = qualityGate(f);
      if (gate.pass) passing++;

      gems[u.symbol] = {
        ...u,
        ...f,
        gatePass: gate.pass,
        gateReasons: gate.reasons,
        preScore: gate.pass ? preScore(f) : null,
        lastChecked: now,
      };
    }

    const snapshot = {
      gems,
      meta: {
        updatedAt: new Date().toISOString(),
        fiscalYear: edgar.year,
        universeCount: universe.length,
        secCoverage: edgar.coverage,
        withFacts,
        passing,
        totalTracked: Object.keys(gems).length,
        ms: Date.now() - t0,
        sources: { universe: 'nasdaq', fundamentals: 'sec-edgar-xbrl' },
      },
    };

    await writeSnapshot(snapshot);
    return res.status(200).json({ ok: true, ...snapshot.meta });
  } catch (e) {
    console.error('[refresh-gems]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
