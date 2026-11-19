// Titulares de un ticker vía /api/quote/<ticker>?news=1 (Yahoo, sin key).
// Cache en memoria de 15 minutos por sesión.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map();

export function fetchNews(ticker) {
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetch(`/api/quote/${encodeURIComponent(ticker)}?news=1`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => (Array.isArray(body?.news) ? body.news : []))
    .catch(() => []);
  promise.then((list) => { if (!list.length) cache.delete(ticker); });
  cache.set(ticker, { at: Date.now(), promise });
  return promise;
}
