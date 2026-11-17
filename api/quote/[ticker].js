// api/quote/[ticker].js — Cotización de un ticker.
// GET /api/quote/AAPL  ->  { ticker, price, change, changePct, high, low, open, prevClose, ... }
//
// Fuente principal: Yahoo chart v8, sin key (Fase 3, ítem 11). Si Yahoo no
// responde y hay FINNHUB_KEY en el entorno, se usa Finnhub como respaldo.

import { quoteFromChart } from '../../lib/quote.js';

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const TICKER_RE = /^[A-Z0-9.^=-]{1,15}$/;

async function fetchJson(url, headers, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function yahooQuote(ticker) {
  // Yahoo escribe las clases con guion (BRK-B).
  const symbol = encodeURIComponent(ticker.replace('.', '-'));
  for (const host of YAHOO_HOSTS) {
    const q = quoteFromChart(await fetchJson(`https://${host}/v8/finance/chart/${symbol}?range=1d&interval=1d`, HEADERS), ticker);
    if (q) return q;
  }
  return null;
}

async function finnhubQuote(ticker) {
  const key = process.env.FINNHUB_KEY || '';
  if (!key) return null;
  const q = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`);
  if (!q || (!q.c && !q.pc)) return null;
  return {
    ticker, price: q.c ?? null, change: q.d ?? null, changePct: q.dp != null ? q.dp / 100 : null,
    high: q.h ?? null, low: q.l ?? null, open: q.o ?? null, prevClose: q.pc ?? null,
    timestamp: q.t ? q.t * 1000 : null, name: null, currency: 'USD', exchange: null, source: 'Finnhub',
  };
}

export default async function handler(req, res) {
  const ticker = String(req.query.ticker || '').toUpperCase().trim();
  if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: 'Ticker inválido' });

  const quote = (await yahooQuote(ticker)) || (await finnhubQuote(ticker));
  if (!quote) return res.status(404).json({ error: `Sin cotización para ${ticker}`, ticker });
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({ ...quote, fetchedAt: new Date().toISOString() });
}
