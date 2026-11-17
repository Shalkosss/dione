// api/cron/refresh-smart-money.js — Cron diario que computa Smart Money Score
// para el top N de gate-passers + override SMART_MONEY_SYMBOLS.
//
// Insiders desde el Form 4 de SEC EDGAR (sin key). Analistas desde Finnhub solo
// si hay FINNHUB_KEY; sin ella el drift queda en null (Fase 3, ítem 11).
//
// Corre después de refresh-gems y refresh-technical. Guarda un snapshot
// separado en Supabase (tabla smart_money_snapshot, fila 'latest') con la
// estructura: { meta, results: { [symbol]: { score, breakdown, insider, analyst } } }.
//
// El endpoint /api/smart-money sirve este snapshot.
//
// Segundo paso, independiente: barre SEC EDGAR para ver qué empresas del
// universo publicaron resultados (8-K ítem 2.02) en las últimas 5 sesiones y
// guarda la lista con la reacción del precio en la fila 'events' de
// hidden_gems_snapshot. Lo sirve /api/events?recent=1. Si falla, smart money
// ya quedó guardado.

import { readSnapshot, writeRow } from '../../lib/store.js';
import { fetchTickerCikMap, fetchRecentFilings } from '../../lib/edgar.js';
import { fetchCandlesBatch } from '../../lib/yahoo.js';
import { RECENT_SESSIONS, toSeries, windowStart, recentReporters, withReactions } from '../../lib/eventsScan.js';
import { computeSmartMoneyBatch, analystsAvailable } from '../../lib/smartMoney.js';
import { fetchInsiders } from '../../lib/insidersEdgar.js';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 300 };

const TABLE = 'smart_money_snapshot';
const ROW_ID = 'latest';

const TOP_N = Number(process.env.SMART_MONEY_TOP_N || 100);
const EXTRA = (process.env.SMART_MONEY_SYMBOLS || '')
  .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE no configurado');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

async function writeSnapshot(data) {
  const { error } = await client()
    .from(TABLE)
    .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase smart_money writeSnapshot: ${error.message}`);
  return ROW_ID;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    const snap = await readSnapshot();
    if (!snap?.gems) {
      return res.status(503).json({ error: 'snapshot fundamental no existe' });
    }

    // Universo: top N por preScore + override. (Antes ordenaba por comboScore,
    // pero desde v4 el comboScore existe para todo el universo y no decide.)
    const ranked = Object.values(snap.gems)
      .filter((g) => g.gatePass)
      .sort((a, b) => (b.preScore ?? 0) - (a.preScore ?? 0))
      .slice(0, TOP_N)
      .map((g) => g.symbol);

    const symbols = [...new Set([...ranked, ...EXTRA])];

    // Form 4 de los últimos 90 días. Las presentaciones bajadas acá se
    // reutilizan en el barrido de eventos.
    const cikMap = await fetchTickerCikMap();
    const { insiders, filings, stats: insiderStats } = await fetchInsiders(symbols, { cikMap, deadline: t0 + INSIDERS_DEADLINE_MS });
    const map = await computeSmartMoneyBatch(symbols, { insiders, concurrency: 4, throttleMs: 60 });

    const results = {};
    let scored = 0;
    for (const [sym, sm] of map) {
      if (sm) {
        results[sym] = sm;
        scored++;
      }
    }

    const snapshot = {
      meta: {
        updatedAt: new Date().toISOString(),
        scored,
        attempted: symbols.length,
        topN: TOP_N,
        extraCount: EXTRA.length,
        insiderSource: 'SEC EDGAR Form 4',
        insiders: insiderStats,
        analystSource: analystsAvailable() ? 'Finnhub' : null,
        ms: Date.now() - t0,
      },
      results,
    };

    await writeSnapshot(snapshot);
    let events = null;
    try {
      events = await refreshRecentEvents(snap, t0, { cikMap, filings });
    } catch (e) {
      console.error('[refresh-smart-money] eventos:', e);
      events = { error: e.message };
    }
    return res.status(200).json({ ok: true, ...snapshot.meta, events });
  } catch (e) {
    console.error('[refresh-smart-money]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}

const INSIDERS_DEADLINE_MS = 110_000; // desde el inicio del cron
const EVENTS_DEADLINE_MS = 240_000;
const SEC_BATCH = 8;                // SEC pide no pasar de 10 pedidos por segundo
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function refreshRecentEvents(snap, t0, { cikMap, filings }) {
  const spy = toSeries((await fetchCandlesBatch(['SPY'], { days: 20 })).get('SPY'));
  const since = windowStart(spy, RECENT_SESSIONS);
  if (!since) throw new Error('sin velas de SPY para fijar la ventana');

  const universe = Object.values(snap.gems).filter((g) => g.gatePass || g.megacap).map((g) => g.symbol);
  let reached = 0;
  for (let i = 0; i < universe.length && Date.now() - t0 < EVENTS_DEADLINE_MS; i += SEC_BATCH) {
    const batch = universe.slice(i, i + SEC_BATCH);
    if (batch.every((t) => filings.has(t) || cikMap.get(t) == null)) { reached = i + batch.length; continue; }
    const results = await Promise.all(batch.map(async (ticker) => {
      const cik = cikMap.get(ticker);
      if (cik == null || filings.has(ticker)) return null;
      try { return [ticker, await fetchRecentFilings(cik)]; } catch { return null; }
    }));
    for (const r of results) if (r) filings.set(r[0], r[1]);
    reached = i + batch.length;
    await sleep(1000);
  }

  // filings también trae los símbolos de SMART_MONEY_SYMBOLS: solo cuenta el universo.
  const inUniverse = new Set(universe);
  const reporters = recentReporters(new Map([...filings].filter(([t]) => inUniverse.has(t))), since);
  const candles = await fetchCandlesBatch(reporters.map((r) => r.ticker), { days: 40 });
  const list = withReactions(reporters, candles).map((e) => ({
    ...e,
    gicsSector: snap.gems[e.ticker]?.gicsSector ?? null,
    marketCap: snap.gems[e.ticker]?.marketCap ?? null,
    preScore: snap.gems[e.ticker]?.preScore ?? null,
  }));

  const row = {
    asOf: new Date().toISOString(),
    since,
    sessions: RECENT_SESSIONS,
    universe: universe.length,
    scanned: reached,
    incomplete: reached < universe.length,
    events: list,
  };
  await writeRow('events', row);
  return { since, scanned: reached, universe: universe.length, reporters: list.length };
}
