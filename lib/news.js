// lib/news.js — Titulares de un ticker desde la búsqueda de Yahoo Finance (sin key).
//
// GET https://query1.finance.yahoo.com/v1/finance/search?q=NVDA&quotesCount=0&newsCount=8
// Devuelve [{ title, publisher, link, time, tickers }], primero los que Yahoo
// asocia al ticker. Solo links https (se muestran como enlaces en la web).

export const NEWS_LIMIT = 6;

export function parseYahooNews(json, ticker, limit = NEWS_LIMIT) {
  const items = Array.isArray(json?.news) ? json.news : [];
  const clean = items
    .filter((n) => typeof n?.title === 'string' && typeof n?.link === 'string' && /^https:\/\//.test(n.link))
    .map((n) => ({
      title: n.title.slice(0, 300),
      publisher: typeof n.publisher === 'string' ? n.publisher.slice(0, 80) : null,
      link: n.link,
      time: Number.isFinite(n.providerPublishTime) ? new Date(n.providerPublishTime * 1000).toISOString() : null,
      tickers: Array.isArray(n.relatedTickers) ? n.relatedTickers.filter((t) => typeof t === 'string').slice(0, 8) : [],
    }));
  const newest = (a, b) => (b.time || '').localeCompare(a.time || '');
  const own = clean.filter((n) => n.tickers.includes(ticker)).sort(newest);
  const rest = clean.filter((n) => !n.tickers.includes(ticker)).sort(newest);
  // La búsqueda de Yahoo mezcla notas de mercado general: si hay al menos dos
  // propias del ticker, solo se muestran esas.
  return (own.length >= 2 ? own : [...own, ...rest]).slice(0, limit);
}

export function newsUrl(host, ticker) {
  return `https://${host}/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=10&enableFuzzyQuery=false`;
}
