// api/events.js — Fechas de publicación de resultados (Fase 3, ítem 12).
//
// GET /api/events?tickers=DUOL,MU,AMZN   (máximo 25)
//
// Para cada ticker devuelve los últimos 8-K con ítem 2.02 de SEC EDGAR: fecha y
// si salió antes de abrir, en sesión o después del cierre. La reacción de
// precio la calcula el navegador con las velas de /api/candles. Sin key.
//
// Los emisores extranjeros (presentan 6-K, sin ítems) vuelven con events: [] y
// una nota: para ellos EDGAR no permite identificar la fecha de resultados.
//
// Respuesta: { success, data: [{ ticker, name, events, note }], meta }
//
// GET /api/events?recent=1   → empresas del universo que reportaron en las
// últimas 5 sesiones, con la reacción del precio. Lo arma el cron
// refresh-smart-money (11:00 UTC) en la fila 'events'; acá solo se lee.

import { fetchTickerCikMap, fetchRecentFilings } from '../lib/edgar.js';
import { extractEarnings, parseTickers } from '../lib/earningsEvents.js';
import { readRow } from '../lib/store.js';

export const config = { maxDuration: 30 };

const CIK_TTL_MS = 12 * 60 * 60 * 1000;
const BATCH_SIZE = 4;
const BATCH_PAUSE_MS = 500;  // 4 pedidos cada medio segundo: por debajo de los 10/s que pide SEC
const BUDGET_MS = 22000;     // se corta antes del maxDuration y se devuelve lo obtenido
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cikCache = { at: 0, map: null };

async function tickerCikMap() {
  if (cikCache.map && Date.now() - cikCache.at < CIK_TTL_MS) return cikCache.map;
  const map = await fetchTickerCikMap();
  cikCache = { at: Date.now(), map };
  return map;
}

async function eventsFor(ticker, cikMap) {
  // SEC escribe las clases con guion (BRK-B); en la web se escriben con punto (BRK.B).
  const cik = cikMap.get(ticker) ?? cikMap.get(ticker.replace('.', '-'));
  if (cik == null) return { ticker, name: null, events: [], note: 'No figura en SEC EDGAR (ETF, índice o ticker extranjero)' };
  try {
    const { name, recent } = await fetchRecentFilings(cik);
    const events = extractEarnings(recent);
    const foreign = !events.length && (recent?.form || []).includes('6-K');
    const note = events.length ? null : foreign ? 'Emisor extranjero (6-K): EDGAR no identifica la fecha de resultados' : 'Sin 8-K de resultados recientes';
    return { ticker, name, events, note };
  } catch (e) {
    console.error('[events]', ticker, e.message);
    return { ticker, name: null, events: [], note: 'EDGAR no respondió para este ticker', failed: true };
  }
}

async function recentEvents(res) {
  let row;
  try {
    row = await readRow('events');
  } catch (e) {
    console.error('[events] recent:', e);
    return res.status(500).json({ success: false, error: 'No se pudo leer el barrido de eventos' });
  }
  if (!row) return res.status(503).json({ success: false, error: 'Todavía no corrió el barrido de eventos (cron refresh-smart-money, 11:00 UTC)' });
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  const { events, ...meta } = row;
  return res.status(200).json({ success: true, data: events, meta: { ...meta, total: events.length } });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'método no permitido' });
  }
  if (req.query.recent === '1' || req.query.recent === 'true') return recentEvents(res);
  const tickers = parseTickers(req.query.tickers);
  const requested = parseTickers(req.query.tickers, 500).length;
  if (!tickers.length) return res.status(400).json({ success: false, error: 'Falta ?tickers=AAA,BBB (máximo 25)' });

  try {
    const startedAt = Date.now();
    const cikMap = await tickerCikMap();
    const data = [];
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      if (Date.now() - startedAt > BUDGET_MS) {
        // Sin tiempo: los que faltan vuelven marcados, en vez de que Vercel corte todo.
        data.push(...tickers.slice(i).map((ticker) => ({ ticker, name: null, events: [], note: 'Sin tiempo para consultarlo: reintentá', failed: true })));
        break;
      }
      if (i > 0) await sleep(BATCH_PAUSE_MS);
      data.push(...await Promise.all(tickers.slice(i, i + BATCH_SIZE).map((t) => eventsFor(t, cikMap))));
    }
    const incomplete = data.filter((d) => d.failed).length;
    // Una respuesta con fallos transitorios no se guarda en el CDN: al recargar se reintenta.
    res.setHeader('Cache-Control', incomplete ? 'no-store' : 's-maxage=3600, stale-while-revalidate=21600');
    return res.status(200).json({
      success: true,
      data: data.map(({ failed, ...rest }) => rest),
      meta: { total: data.length, incomplete, omitted: Math.max(0, requested - tickers.length), source: 'SEC EDGAR 8-K ítem 2.02' },
    });
  } catch (e) {
    console.error('[events]', e);
    return res.status(502).json({ success: false, error: 'No se pudo consultar SEC EDGAR' });
  }
}
