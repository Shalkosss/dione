// lib/foreignFacts.js — Cache de fundamentales desde companyfacts para los
// emisores que los frames USD de EDGAR no traen (IFRS, us-gaap en otra moneda).
//
// Fila 'foreign_facts' de hidden_gems_snapshot: { updatedAt, byCik: { cik:
// { fetchedAt, raw | null, reason? } } }. Cada corrida baja, en orden de
// prioridad y hasta el tope de tiempo, los que no están o tienen más de 30
// días (los anuales cambian una vez por año). El resto queda para mañana.

import { fetchCompanyFacts } from './edgar.js';
import { factsToRaw } from './companyFacts.js';
import { readRow, writeRow } from './store.js';

export const FOREIGN_TTL_MS = 30 * 86400000;
const BATCH = 4;           // 4 en paralelo + pausa: por debajo de 10 pedidos/s de la SEC
const PAUSE_MS = 600;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Puro: qué CIKs hay que bajar, en el orden dado.
export function staleCiks(ciks, byCik, now = Date.now(), ttl = FOREIGN_TTL_MS) {
  return ciks.filter((c) => {
    const hit = byCik[c];
    return !hit?.fetchedAt || now - Date.parse(hit.fetchedAt) > ttl;
  });
}

export async function loadForeignFacts(ciks, { deadline = Infinity, today = new Date().toISOString() } = {}) {
  let byCik = {};
  try { byCik = (await readRow('foreign_facts'))?.byCik || {}; } catch (e) { console.warn('[foreignFacts] cache:', e.message); }
  const todo = staleCiks(ciks, byCik);
  let fetched = 0;
  let failed = 0;
  for (let i = 0; i < todo.length && Date.now() < deadline; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (cik) => {
      try {
        const json = await fetchCompanyFacts(cik);
        const raw = json ? factsToRaw(json, today) : null;
        return [cik, { fetchedAt: new Date().toISOString(), raw, ...(raw ? {} : { reason: json ? 'sin anuales en XBRL' : 'sin XBRL en EDGAR' }) }];
      } catch (e) {
        failed++;
        return null; // error de red: se reintenta mañana
      }
    }));
    byCik = { ...byCik, ...Object.fromEntries(results.filter(Boolean)) };
    fetched += results.filter(Boolean).length;
    await sleep(PAUSE_MS);
  }
  if (fetched) {
    try { await writeRow('foreign_facts', { updatedAt: new Date().toISOString(), byCik }); } catch (e) { console.warn('[foreignFacts] escribir:', e.message); }
  }
  return { byCik, stats: { candidates: ciks.length, fetched, failed, pending: Math.max(0, todo.length - fetched - failed) } };
}
