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
import { writeSnapshot, readSnapshot, readRow, writeRow } from '../../lib/store.js';
import { gicsFor } from '../../lib/gics.js';
import { MEGACAPS, sectorPercentiles, rankMap, rollWeekly, weeklyMarks, carryTechnical, technicalMeta } from '../../lib/universe.js';
import { refreshUniverse } from '../../lib/universeRefresh.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();

  // ?part=universe (cron 12:00 UTC, /api/cron/refresh-universe): universo
  // completo de NYSE y Nasdaq en la fila 'universe'. No toca el snapshot.
  if (req.query?.part === 'universe') {
    try {
      return res.status(200).json({ ok: true, part: 'universe', ...(await refreshUniverse({ t0 })) });
    } catch (e) {
      console.error('[refresh-gems] universe', e);
      return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
    }
  }

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
    let untaggedDebtPassers = 0;
    let partialDebtPassers = 0;
    for (const [cik, raw] of edgar.facts) {
      const ticker = cikToTicker.get(cik);
      if (!ticker) continue;
      const f0 = computeMetrics(ticker, raw);
      if (f0.debtToEquity == null) nullDebt++;
      if (qualityGate(f0).pass) {
        passers.push({ ticker, cik, raw, megacap: MEGACAPS.includes(ticker) });
        if (f0.debtUntagged) untaggedDebtPassers++;
        if (f0.debtPartial) partialDebtPassers++;
      }
    }

    // Megacaps: entran aunque no pasen el gate (con gatePass false y sus razones).
    // Se buscan por ticker en el mapa de la SEC, no por CIK, porque la SEC puede
    // listar otro ticker primero para el mismo CIK (GOOG antes que GOOGL).
    // Se deduplica por CIK: si la empresa ya entró con otra clase (GOOG en vez
    // de GOOGL), se renombra a la de la lista y se marca megacap.
    const megacapsMissing = [];
    for (const ticker of MEGACAPS) {
      const cik = cikMap.get(ticker);
      const already = passers.findIndex((p) => p.cik === cik || p.ticker === ticker);
      if (already >= 0) {
        passers[already] = { ...passers[already], ticker, megacap: true };
        continue;
      }
      const raw = cik != null ? edgar.facts.get(cik) : null;
      if (!raw) { megacapsMissing.push(ticker); continue; }
      passers.push({ ticker, cik, raw, megacap: true, outsideGate: true });
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
      // gicsSector: override por ticker, después sector (Finnhub o descripción
      // SIC de la SEC) y después industria. Ver lib/gics.js.
      const gicsSector = gicsFor(p.ticker, meta?.sector, meta?.industry);
      if (gicsSector) withGics++;
      const gate = p.outsideGate ? qualityGate(f) : { pass: true, reasons: [] };
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
        gatePass: gate.pass,
        gateReasons: gate.reasons,
        megacap: p.megacap || false,
        preScore: preScore(f),
        lastChecked: now,
      };
    }

    // Percentil de preScore dentro del sector y marcas semanales del ranking.
    // Si no se pudo leer la fila 'weekly' no se marca ni se escribe: escribirla
    // con prev vacío borraría la foto de la semana pasada.
    const sectorPct = sectorPercentiles(gems);
    const ranks = rankMap(gems);
    let weekly = null;
    try {
      weekly = rollWeekly(await readRow('weekly'), new Date().toISOString(), ranks);
    } catch (e) {
      console.warn('[refresh-gems] no se leyó el ranking semanal:', e.message);
    }
    const marks = weekly ? weeklyMarks(ranks, weekly.prev?.ranks ?? null) : {};
    // Los campos técnicos de ayer se conservan hasta que corra refresh-technical
    // (10:00 UTC); si no, el Scan pasaría una hora sin tendencia ni régimen.
    const previous = await readSnapshot();
    for (const sym of Object.keys(gems)) {
      gems[sym] = {
        ...carryTechnical(previous?.gems?.[sym]),
        ...gems[sym],
        preScoreSectorPct: sectorPct[sym] ?? null,
        rank: ranks[sym] ?? null,
        rankPrevWeek: marks[sym]?.rankPrev ?? null,
        weeklyMark: marks[sym]?.mark ?? null,
      };
    }
    try {
      if (weekly) await writeRow('weekly', weekly);
    } catch (e) {
      console.warn('[refresh-gems] no se guardó el ranking semanal:', e.message);
    }

    const snapshot = {
      gems,
      meta: {
        updatedAt: new Date().toISOString(),
        fiscalYear: edgar.year,
        secCoverage: edgar.coverage,
        gatePassers: passers.filter((p) => !p.outsideGate).length,
        untaggedDebtPassers,
        partialDebtPassers,
        megacaps: passers.filter((p) => p.megacap).length,
        megacapsMissing,
        weekOf: weekly?.current.weekOf ?? null,
        prevWeekOf: weekly?.prev?.weekOf ?? null,
        priced,
        withSector,
        withGics,
        nullDebtCount: nullDebt,
        totalTracked: Object.keys(gems).length,
        // Régimen, tablero sectorial y estado técnico de la corrida anterior:
        // los reemplaza refresh-technical a las 10:00 UTC.
        ...technicalMeta(previous?.meta),
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
