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

import { fetchTickerCikMap, fetchRecentFilings } from '../lib/edgar.js';
import { extractEarnings, parseTickers } from '../lib/earningsEvents.js';

export const config = { maxDuration: 30 };

const CIK_TTL_MS = 12 * 60 * 60 * 1000;
let cikCache = { at: 0, map: null };

async function tickerCikMap() {
  if (cikCache.map && Date.now() - cikCache.at < CIK_TTL_MS) return cikCache.map;
  const map = await fetchTickerCikMap();
  cikCache = { at: Date.now(), map };
  return map;
}

async function eventsFor(ticker, cikMap) {
  const cik = cikMap.get(ticker);
  if (cik == null) return { ticker, name: null, events: [], note: 'No figura en SEC EDGAR (ETF, índice o ticker extranjero)' };
  try {
    const { name, recent } = await fetchRecentFilings(cik);
    const events = extractEarnings(recent);
    const foreign = !events.length && (recent?.form || []).includes('6-K');
    const note = events.length ? null : foreign ? 'Emisor extranjero (6-K): EDGAR no identifica la fecha de resultados' : 'Sin 8-K de resultados recientes';
    return { ticker, name, events, note };
  } catch (e) {
    console.error('[events]', ticker, e.message);
    return { ticker, name: null, events: [], note: 'EDGAR no respondió para este ticker' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'método no permitido' });
  }
  const tickers = parseTickers(req.query.tickers);
  if (!tickers.length) return res.status(400).json({ success: false, error: 'Falta ?tickers=AAA,BBB (máximo 25)' });

  try {
    const cikMap = await tickerCikMap();
    const data = [];
    // De a 4 a la vez: SEC pide menos de 10 pedidos por segundo.
    for (let i = 0; i < tickers.length; i += 4) {
      data.push(...await Promise.all(tickers.slice(i, i + 4).map((t) => eventsFor(t, cikMap))));
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    return res.status(200).json({ success: true, data, meta: { total: data.length, source: 'SEC EDGAR 8-K ítem 2.02' } });
  } catch (e) {
    console.error('[events]', e);
    return res.status(502).json({ success: false, error: 'No se pudo consultar SEC EDGAR' });
  }
}
