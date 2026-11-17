/* ============================================================
   DIONE · thesisApi.js
   Cliente de /api/theses. La página Thesis ya no habla directo
   con Supabase: lee y escribe por los endpoints del servidor.
   ============================================================ */

const TOKEN_KEY = "dione.thesesToken";

// El token de escritura se guarda solo en este navegador.
export function loadToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function saveToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* modo privado: se pide de nuevo */ }
}

export async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("No se pudo conectar con la API de tesis");
  }
  const body = await res.json().catch(() => null);
  if (!body) {
    throw new Error(`La API de tesis no respondió JSON (HTTP ${res.status}). En local hace falta .env.local con las keys de Supabase.`);
  }
  if (!res.ok || !body.success) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.details = body.data ?? null;
    throw err;
  }
  return body.data;
}

export const fetchTheses = () => request("/api/theses");
export const fetchThesisStats = () => request("/api/theses/stats");
export const fetchThesis = (id) => request(`/api/theses/${encodeURIComponent(id)}`);

// `payload`: texto pegado del chat, un bloque o un array de bloques.
export function importTheses(payload, token) {
  const isText = typeof payload === "string";
  return request("/api/theses", {
    method: "POST",
    headers: {
      "Content-Type": isText ? "text/plain" : "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: isText ? payload : JSON.stringify(payload),
  });
}

// Reenvía el bloque original con cambios (post-mortem, cierre manual, revisión).
export function patchThesis(thesis, changes, token) {
  return importTheses({ ...(thesis.raw_json || {}), id: thesis.id, ...changes }, token);
}
