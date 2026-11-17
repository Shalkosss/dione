// lib/insidersEdgar.js — Baja los Form 4 de SEC EDGAR para una lista de
// símbolos y devuelve el resumen de insiders de cada uno (lib/form4.js).
//
// SEC pide no pasar de 10 pedidos por segundo: se va en tandas de 8 con una
// pausa de 1 s. Si se acaba el tiempo, los símbolos con Form 4 sin bajar
// quedan fuera del mapa (mejor sin dato que con un neto a medias).

import { fetchRecentFilings, fetchArchiveText } from './edgar.js';
import { form4Filings, parseForm4, insiderSummary } from './form4.js';

export const INSIDER_DAYS = 90;
const SEC_BATCH = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Corre `fn` sobre `items` en tandas por segundo hasta `deadline` (epoch ms).
// Devuelve cuántos ítems alcanzó a procesar.
async function inBatches(items, fn, deadline) {
  let done = 0;
  for (let i = 0; i < items.length; i += SEC_BATCH) {
    if (Date.now() > deadline) break;
    await Promise.all(items.slice(i, i + SEC_BATCH).map(fn));
    done = Math.min(items.length, i + SEC_BATCH);
    if (done < items.length) await sleep(1000);
  }
  return done;
}

// symbols en orden de prioridad (los primeros se completan primero).
// filings: Map símbolo → { name, recent } que se reutiliza y se completa acá,
// para que el barrido de eventos no vuelva a pedir lo mismo.
export async function fetchInsiders(symbols, { cikMap, filings = new Map(), deadline, today = new Date().toISOString() }) {
  const since = new Date(new Date(today).getTime() - INSIDER_DAYS * 86400000).toISOString().slice(0, 10);
  const withCik = symbols.filter((s) => cikMap.get(s) != null);

  const needSubs = withCik.filter((s) => !filings.has(s));
  await inBatches(needSubs, async (s) => {
    try { filings.set(s, await fetchRecentFilings(cikMap.get(s))); } catch { /* sin dato */ }
  }, deadline);

  const docs = withCik.flatMap((s) =>
    filings.has(s) ? form4Filings(filings.get(s).recent, cikMap.get(s), since).map((f) => ({ ...f, symbol: s })) : []);
  const parsed = new Map(); // url → Form 4 parseado (null si falló)
  await inBatches(docs, async (d) => {
    try { parsed.set(d.url, parseForm4(await fetchArchiveText(d.url))); } catch { parsed.set(d.url, null); }
  }, deadline);

  const insiders = new Map();
  const incomplete = [];
  for (const s of withCik) {
    // Sin presentaciones legibles no es "cero actividad": queda sin dato.
    if (!filings.get(s)?.recent?.form) { incomplete.push(s); continue; }
    const mine = docs.filter((d) => d.symbol === s);
    if (mine.some((d) => !parsed.has(d.url))) { incomplete.push(s); continue; }
    insiders.set(s, insiderSummary(mine.map((d) => parsed.get(d.url)), today, cikMap.get(s), since));
  }
  return {
    insiders,
    filings,
    stats: { since, symbols: symbols.length, noCik: symbols.length - withCik.length, form4: docs.length, failed: [...parsed.values()].filter((p) => p == null).length, incomplete: incomplete.length },
  };
}
