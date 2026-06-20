// api/cron/refresh-gems.js — Precompute del universo Tier-3 (hidden gems).
//
// Fuentes 100% gratis y reachable desde la nube:
//   SEC EDGAR (XBRL) → universo + fundamentales + acciones en circulación.
//   Stooq           → precio + nombre.
//   Finnhub         → sector/industry (enriquecimiento, cache 30d).
// market cap = precio × acciones.
//
// Disparado por Vercel Cron 1x/día (GET), protegido por CRON_SECRET.

import {
  fetchTickerCikMap, fetchRawFactsByCik, fetchSharesByCik, computeMetrics,
} from '../../lib/edgar.js';
import { fetchPrices } from '../../lib/prices.js';
import { enrichSectors } from '../../lib/finnhub.js';
import { qualityGate, preScore } from '../../lib/scoring.js';
import { writeSnapshot } from '../../lib/store.js';
import { toGicsL1 } from '../../lib/gics.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();

  try {
    const year = process.env.GEMS_YEAR ? Number(process.env.GEMS_YEAR) : undefined;
    const [cikMap, edgar, sharesByCik] = await Promise.all([
      fetchTickerCikMap(),
      fetchRawFactsByCik({ year }),
      fetchSharesByCik(),
    ]);

    if (!edgar.coverage) {
      return res.status(502).json({ error: 'EDGAR sin datos — revisar SEC_USER_AGENT' });
    }

    const cikToTicker = new Map();
    for (const [t, c] of cikMap) if (!cikToTicker.has(c)) cikToTicker.set(c, t);

    // PASS 1 — quality gate. computeMetrics ya devuelve debtToEquity correcto
    // (LongTermDebt+ShortTermDebt)/Equity y altmanZ/piotroski cuando hay data.
    const passers = [];
    let nullDebt = 0;
    for (const [cik, raw] of edgar.facts) {
      const ticker = cikToTicker.get(cik);
      if (!ticker) continue;
      const f0 = computeMetrics(ticker, raw);
      if (f0.debtToEquity == null) nullDebt++;
      if (qualityGate(f0).pass) passers.push({ ticker, cik, raw });
    }

    // precios + sectores en paralelo
    const tickerList = passers.map((p) => p.ticker);
    const cikBySymbol = new Map(passers.map((p) => [p.ticker, p.cik]));
    const [prices, sectorMap] = await Promise.all([
      fetchPrices(tickerList),
      enrichSectors(tickerList, { cikBySymbol }).catch((e) => {
        console.warn('[refresh-gems] sector enrichment falló:', e.message);
        return new Map();
      }),
    ]);

    const now = Date.now();
    const gems = {};
    let priced = 0;
    let withSector = 0;
    let withGics = 0;
    for (const p of passers) {
      const pr = prices.get(p.ticker);
      const shares = sharesByCik.get(p.cik) ?? null;
      const cap = pr?.price != null && shares != null ? pr.price * shares : null;
      if (cap != null) priced++;
      const f = computeMetrics(p.ticker, p.raw, cap, pr?.price ?? null);
      const meta = sectorMap.get(p.ticker);
      if (meta?.sector) withSector++;
      // gicsSector: mapeo del raw heterogéneo a uno de los 11 GICS L1.
      // Probamos primero sector (Finnhub gicsSector si vino, sino finnhubIndustry),
      // y si no mapea, intentamos industry (a veces SIC mapea mejor).
      const gicsSector = toGicsL1(meta?.sector) || toGicsL1(meta?.industry) || null;
      if (gicsSector) withGics++;
      gems[p.ticker] = {
        symbol: p.ticker,
        name: pr?.name ?? meta?.name ?? null,
        sector: meta?.sector ?? null,
        industry: meta?.industry ?? null,
        gicsSector,
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
        withSector,
        withGics,
        nullDebtCount: nullDebt,
        totalTracked: Object.keys(gems).length,
        ms: Date.now() - t0,
        sources: {
          fundamentals: 'sec-edgar-xbrl',
          price: 'finnhub+yahoo',
          sector: 'finnhub+sec-submissions',
        },
      },
    };

    await writeSnapshot(snapshot);
    return res.status(200).json({ ok: true, ...snapshot.meta });
  } catch (e) {
    console.error('[refresh-gems]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
