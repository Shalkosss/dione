// src/lib/ledgerSync.js — Qué hacer al comparar el libro local con el de Supabase.
//
// Funciones puras. localStorage sigue siendo la copia de trabajo; el servidor
// manda cuando hay conexión. Nunca se mezclan libros automáticamente: unir por
// id podría duplicar posiciones (la cartera de ejemplo cargada en dos navegadores).
//
// local:  { initialCash, transactions, version: number|null, pending: boolean }
//         version null = esta cuenta nunca se sincronizó desde este navegador.
// remote: { initialCash, transactions, version } | null (sin respuesta)
// → 'none' | 'adopt' | 'push' | 'conflict' | 'needToken'

export function sameBook(a, b) {
  if (Number(a.initialCash) !== Number(b.initialCash)) return false;
  if (a.transactions.length !== b.transactions.length) return false;
  const ids = new Set(a.transactions.map((t) => t.id));
  return b.transactions.every((t) => ids.has(t.id));
}

export function decideAccountSync(local, remote, hasToken) {
  if (!remote) return "none";
  const push = hasToken ? "push" : "needToken";

  if (local.version == null) {
    // Libro local vacío: se adopta, salvo un capital cambiado a mano contra un servidor vacío.
    if (!local.transactions.length) return local.pending && !remote.transactions.length ? push : "adopt";
    if (!remote.transactions.length) return push;
    return sameBook(local, remote) ? "adopt" : "conflict";
  }
  // Versión del servidor más vieja que la local: la base se recreó. No se
  // adopta en silencio (vaciaría el libro); que el usuario decida.
  if (remote.version < local.version) return "conflict";
  const sameVersion = local.version === remote.version;
  if (!local.pending) return sameVersion ? "none" : "adopt";
  return sameVersion ? push : "conflict";
}

// Referencias: gana la última escritura. Sin pendientes se adopta lo del
// servidor; si el servidor está vacío, se suben las locales.
export function decideBenchmarkSync(localList, pending, remoteList) {
  if (!remoteList) return "none";
  if (pending || (!remoteList.length && localList.length)) return "push";
  return "adopt";
}
