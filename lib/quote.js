// lib/quote.js — Cotización desde Yahoo chart v8, sin key (Fase 3, ítem 11). Puro.
//
// quoteFromChart(json, ticker) arma la misma respuesta que antes daba Finnhub
// en /api/quote. Pide range=1d&interval=1d: con ese rango chartPreviousClose
// es el cierre de la sesión anterior.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function quoteFromChart(json, ticker) {
  const r = json?.chart?.result?.[0];
  if (!r?.meta) return null;
  const m = r.meta;
  const q = r.indicators?.quote?.[0] || {};
  const idx = (r.timestamp || []).map((_, i) => i).filter((i) => num(q.close?.[i]) != null);
  const last = idx.at(-1);
  const prev = idx.at(-2);
  const price = num(m.regularMarketPrice) ?? (last != null ? q.close[last] : null);
  if (price == null) return null;
  const prevClose = num(m.previousClose) ?? num(m.chartPreviousClose) ?? (prev != null ? q.close[prev] : null);
  const change = prevClose != null ? price - prevClose : null;
  return {
    ticker,
    price,
    change,
    changePct: change != null && prevClose ? change / prevClose : null,
    high: num(m.regularMarketDayHigh) ?? (last != null ? num(q.high?.[last]) : null),
    low: num(m.regularMarketDayLow) ?? (last != null ? num(q.low?.[last]) : null),
    open: last != null ? num(q.open?.[last]) : null,
    prevClose,
    timestamp: num(m.regularMarketTime) != null ? m.regularMarketTime * 1000 : null,
    name: m.longName || m.shortName || null,
    currency: m.currency || 'USD',
    exchange: m.fullExchangeName || m.exchangeName || null,
    source: 'Yahoo',
  };
}
