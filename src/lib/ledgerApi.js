// src/lib/ledgerApi.js — Cliente de /api/theses/ledger (libro de órdenes en Supabase).
// Usa el mismo token que la importación de tesis, guardado en este navegador.

import { request } from "./thesisApi.js";

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const json = (token) => ({ ...auth(token), "Content-Type": "application/json" });

export const fetchLedger = (token) => request("/api/theses/ledger", { headers: auth(token) });

// Reemplaza el libro de una cuenta. baseVersion null = forzar sin comprobar versión.
export function putAccount(accountId, { baseVersion, initialCash, transactions }, token) {
  return request(`/api/theses/ledger?account=${encodeURIComponent(accountId)}`, {
    method: "PUT",
    headers: json(token),
    body: JSON.stringify({ baseVersion, initialCash, transactions }),
  });
}

export function putBenchmarks(benchmarks, token) {
  const clean = benchmarks.map(({ id, name, color, startDate, weights }) => ({ id, name, color, startDate, weights }));
  return request("/api/theses/ledger?resource=benchmarks", {
    method: "PUT",
    headers: json(token),
    body: JSON.stringify({ benchmarks: clean }),
  });
}
