// lib/universeRefresh.js — Arma la fila 'universe': todas las empresas comunes
// de NYSE y Nasdaq con fundamentales, precio, sector y etiqueta del gate.
//
// Lo corre refresh-gems con ?part=universe (cron 12:00 UTC, ruta
// /api/cron/refresh-universe en vercel.json). No toca el snapshot `latest` ni
// /api/scan: es contexto para la vista Mercado completo y para el research.
//
// Orden y tiempos (máx. 300 s):
//   1. Lista de la SEC; después frames de EDGAR (~35 s) en paralelo con los
//      precios de Yahoo spark (~50 s): hosts distintos.
//   2. Sectores faltantes desde la SEC hasta los 170 s (cache de 30 días).
//   3. Emisores sin frames USD (IFRS, us-gaap en otra moneda) desde companyfacts
//      hasta los 215 s (cache de 30 días, fila foreign_facts).
// Lo que no alcanza queda para la corrida siguiente.

import { fetchExchangeTickers, fetchRawFactsByCik, fetchSharesByCik, computeMetrics } from './edgar.js';
import { enrichSectors } from './finnhub.js';
import { fetchSparkPrices } from './yahooSpark.js';
import { qualityGate, preScore } from './scoring.js';
import { gicsFor } from './gics.js';
import { MEGACAPS } from './universe.js';
import { listedTickers, universeRow, universeStats } from './marketUniverse.js';
import { loadForeignFacts } from './foreignFacts.js';
import { readRow, readSnapshot, writeRow } from './store.js';

export const FUND_RE = /\b(ETF|FUNDS?|TRUST|SPDR|ISHARES|PORTFOLIO)\b/i;
const NO_XBRL = 'Sin fundamentales XBRL en EDGAR todavía';

// Tendencia del snapshot de calidad (refresh-technical, 10:00 UTC), validada.
function qualityTrend(gem) {
  if (!gem || gem.trendScore == null) return null;
  const d200 = gem.trendInputs?.distSma200;
  return { trendScore: gem.trendScore, trendLabel: gem.trendLabel ?? null, aboveSma200: d200 != null ? d200 > 0 : null, trendFlags: gem.trendFlags ?? [] };
}

export async function refreshUniverse({ t0 = Date.now() } = {}) {
  // Lecturas de Supabase desde el principio (el snapshot pesa ~10 MB) y cada
  // una con su propio fallback: si falla una, la otra sirve igual.
  const previousP = readRow('universe').catch((e) => { console.warn('[universe] fila anterior:', e.message); return null; });
  const snapP = readSnapshot();
  const sec = await fetchExchangeTickers();
  const listings = listedTickers(sec, { preferred: MEGACAPS });
  const symbols = listings.map((l) => l.ticker);

  const [edgar, sharesByCik, { prices, attempted }] = await Promise.all([
    fetchRawFactsByCik({}),
    fetchSharesByCik(),
    fetchSparkPrices(symbols, { deadline: t0 + 150_000 }),
  ]);
  if (!edgar.coverage) throw new Error('EDGAR sin datos: revisar SEC_USER_AGENT');

  // Fondos y fideicomisos cotizados (SPY, GLD) figuran en la lista de la SEC
  // pero no son empresas: sin frames USD y con nombre de fondo, se excluyen.
  const companies = listings.filter((l) => edgar.facts.has(l.cik) || !FUND_RE.test(l.name || ''));

  const sectorMap = await enrichSectors(companies.map((l) => l.ticker), {
    cikBySymbol: new Map(companies.map((l) => [l.ticker, l.cik])), skipFinnhub: true, deadline: t0 + 170_000,
  }).catch((e) => { console.warn('[universe] sectores:', e.message); return new Map(); });

  // Sin frames USD: companyfacts, priorizando por volumen negociado.
  const dollarVol = (l) => (prices.get(l.ticker)?.price ?? 0) * (prices.get(l.ticker)?.volume ?? 0);
  const foreignCiks = companies.filter((l) => !edgar.facts.has(l.cik)).sort((a, b) => dollarVol(b) - dollarVol(a)).map((l) => l.cik);
  // Hasta 215 s: una tanda que empieza al límite puede tardar ~12 s más, y
  // después quedan la escritura del cache y la del universo.
  const foreign = await loadForeignFacts(foreignCiks, { deadline: t0 + 215_000 }).catch((e) => {
    console.warn('[universe] companyfacts:', e.message);
    return { byCik: {}, stats: { error: e.message } };
  });

  const [previous, snap] = await Promise.all([previousP, snapP]);
  const gemByCik = new Map(Object.values(snap?.gems || {}).filter((g) => g.cik != null).map((g) => [g.cik, g]));
  const prevBySymbol = new Map((previous?.rows || []).map((r) => [r.symbol, r]));

  let stalePrices = 0;
  const rows = companies.map((listing) => {
    const fresh = prices.get(listing.ticker);
    const old = prevBySymbol.get(listing.ticker);
    if (!fresh && old?.price != null) stalePrices++;
    const price = fresh?.price ?? old?.price ?? null;
    const volume = fresh?.volume ?? null;
    const usdRaw = edgar.facts.get(listing.cik);
    const foreignRaw = usdRaw ? null : foreign.byCik[listing.cik]?.raw ?? null;
    // Capitalización solo con datos en USD de la SEC: en un ADR, precio por
    // acciones da mal (un ADR de TSM son 5 acciones, uno de Toyota 10).
    const shares = usdRaw ? sharesByCik.get(listing.cik) ?? null : null;
    const cap = price != null && shares != null ? price * shares : null;
    const raw = usdRaw || foreignRaw;
    const f = raw ? computeMetrics(listing.ticker, raw, cap, usdRaw ? price : null) : null;
    const gate = f ? qualityGate(f) : { pass: false, reasons: [NO_XBRL] };
    const meta = sectorMap.get(listing.ticker);
    const gicsSector = gicsFor(listing.ticker, meta?.sector, meta?.industry) ?? old?.gicsSector ?? null;
    const row = universeRow({
      listing, f, gate, price, volume, cap, gicsSector, preScore: f ? preScore(f) : null,
      foreign: foreignRaw ? { currency: foreignRaw.currency, taxonomy: foreignRaw.taxonomy, fyEnd: foreignRaw.fyEnd } : null,
    });
    const trend = qualityTrend(snap?.gems?.[listing.ticker] ?? gemByCik.get(listing.cik));
    return { ...row, ...(trend || {}), ...(fresh || price == null ? {} : { priceStale: true }) };
  });

  const data = {
    meta: {
      updatedAt: new Date().toISOString(),
      fiscalYear: edgar.year,
      fundsExcluded: listings.length - companies.length,
      ...universeStats(rows),
      foreignFacts: foreign.stats,
      priceAttempted: attempted,
      stalePrices,
      ms: Date.now() - t0,
      sources: {
        listings: 'SEC company_tickers_exchange', fundamentals: 'sec-edgar-xbrl frames (USD) + companyfacts (IFRS y otras monedas)',
        price: 'yahoo-spark', sector: 'sec-submissions (cache 30d)', trend: 'snapshot de calidad + universe_tech_1/2',
      },
    },
    rows,
  };
  await writeRow('universe', data);
  return data.meta;
}
