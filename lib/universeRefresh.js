// lib/universeRefresh.js — Arma la fila 'universe': todas las empresas comunes
// de NYSE y Nasdaq con fundamentales, precio, sector y etiqueta del gate.
//
// Lo corre refresh-gems con ?part=universe (cron 12:00 UTC, ruta
// /api/cron/refresh-universe en vercel.json). No toca el snapshot `latest` ni
// /api/scan: es contexto para la pantalla de Universo y para el research.
//
// Tiempos medidos: EDGAR ~35 s, precios por spark ~70 s, sectores del cache.
// Los sectores que falten se piden a la SEC hasta el tope de tiempo y el resto
// queda para el día siguiente (cache de 30 días en symbol_metadata).

import { fetchExchangeTickers, fetchRawFactsByCik, fetchSharesByCik, computeMetrics } from './edgar.js';
import { enrichSectors } from './finnhub.js';
import { fetchSparkPrices } from './yahooSpark.js';
import { qualityGate, preScore } from './scoring.js';
import { gicsFor } from './gics.js';
import { MEGACAPS } from './universe.js';
import { listedTickers, universeRow, universeStats } from './marketUniverse.js';
import { readRow, writeRow } from './store.js';

export const FUND_RE = /\b(ETF|FUNDS?|TRUST|SPDR|ISHARES|PORTFOLIO)\b/i;
const NO_XBRL = 'Sin fundamentales XBRL en us-gaap (emisor extranjero con IFRS o sin 10-K reciente)';

export async function refreshUniverse({ t0 = Date.now() } = {}) {
  const [sec, edgar, sharesByCik] = await Promise.all([
    fetchExchangeTickers(),
    fetchRawFactsByCik({}),
    fetchSharesByCik(),
  ]);
  if (!edgar.coverage) throw new Error('EDGAR sin datos: revisar SEC_USER_AGENT');

  const listings = listedTickers(sec, { preferred: MEGACAPS });
  const symbols = listings.map((l) => l.ticker);
  const cikBySymbol = new Map(listings.map((l) => [l.ticker, l.cik]));

  // Precios (Yahoo) y sectores (cache + SEC) van a hosts distintos: en paralelo.
  const [{ prices, attempted }, sectorMap] = await Promise.all([
    fetchSparkPrices(symbols, { deadline: t0 + 170_000 }),
    enrichSectors(symbols, { cikBySymbol, skipFinnhub: true, deadline: t0 + 230_000 }).catch((e) => {
      console.warn('[universe] sectores:', e.message);
      return new Map();
    }),
  ]);

  // Si Yahoo no respondió para un símbolo, se conserva el precio de ayer marcado.
  let previous = null;
  try { previous = await readRow('universe'); } catch (e) { console.warn('[universe] fila anterior:', e.message); }
  const prevBySymbol = new Map((previous?.rows || []).map((r) => [r.symbol, r]));

  // Fondos y fideicomisos cotizados (SPY, GLD) figuran en la lista de la SEC
  // pero no son empresas: sin XBRL y con nombre de fondo, se excluyen.
  const companies = listings.filter((l) => edgar.facts.has(l.cik) || !FUND_RE.test(l.name || ''));

  let stalePrices = 0;
  const rows = companies.map((listing) => {
    const fresh = prices.get(listing.ticker);
    const old = prevBySymbol.get(listing.ticker);
    if (!fresh && old?.price != null) stalePrices++;
    const price = fresh?.price ?? old?.price ?? null;
    const volume = fresh?.volume ?? null;
    const shares = sharesByCik.get(listing.cik) ?? null;
    const cap = price != null && shares != null ? price * shares : null;
    const raw = edgar.facts.get(listing.cik);
    const f = raw ? computeMetrics(listing.ticker, raw, cap, price) : null;
    const gate = f ? qualityGate(f) : { pass: false, reasons: [NO_XBRL] };
    const meta = sectorMap.get(listing.ticker);
    const gicsSector = gicsFor(listing.ticker, meta?.sector, meta?.industry) ?? old?.gicsSector ?? null;
    const row = universeRow({ listing, f, gate, price, volume, cap, gicsSector, preScore: f ? preScore(f) : null });
    return fresh || price == null ? row : { ...row, priceStale: true };
  });

  const data = {
    meta: {
      updatedAt: new Date().toISOString(),
      fiscalYear: edgar.year,
      fundsExcluded: listings.length - companies.length,
      ...universeStats(rows),
      priceAttempted: attempted,
      stalePrices,
      ms: Date.now() - t0,
      sources: { listings: 'SEC company_tickers_exchange', fundamentals: 'sec-edgar-xbrl', price: 'yahoo-spark', sector: 'sec-submissions (cache 30d)' },
    },
    rows,
  };
  await writeRow('universe', data);
  return data.meta;
}
