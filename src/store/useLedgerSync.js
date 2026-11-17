import { useCallback, useEffect, useRef, useState } from "react";
import { loadToken } from "../lib/thesisApi.js";
import { fetchLedger, putAccount, putBenchmarks } from "../lib/ledgerApi.js";
import { decideAccountSync, decideBenchmarkSync } from "../lib/ledgerSync.js";

/* Sincroniza el libro local (localStorage) con Supabase vía /api/theses/ledger.
   La app funciona igual sin red ni token: en ese caso todo queda en este navegador.

   Cada cambio local marca la cuenta como `pending` y agenda una sincronización
   (800 ms de espera para juntar cambios seguidos). La sincronización baja el
   libro del servidor y decide por cuenta con `decideAccountSync`.
   Nunca corren dos sincronizaciones a la vez: si se pide una durante otra,
   queda anotada y corre al terminar. */

const DEBOUNCE_MS = 800;

const MESSAGES = {
  local: "Sin token: las órdenes viven solo en este navegador",
  syncing: "Sincronizando con Supabase…",
  synced: "Guardado en Supabase",
  pending: "Cambios sin subir: se reintenta al volver la conexión",
  unauthorized: "El token guardado no es válido",
  notMigrated: "Sincronización apagada: falta aplicar migrations/003_transactions.sql en Supabase",
  conflict: "Este navegador y Supabase tienen libros distintos",
};

function errorStatus(e) {
  if (e.details?.code === "LEDGER_NOT_MIGRATED") return { status: "unavailable", message: MESSAGES.notMigrated };
  if (e.status === 401) return { status: "needToken", message: MESSAGES.unauthorized };
  // 400: el servidor rechaza los datos; reintentar no sirve.
  if (e.status === 400) return { status: "invalid", message: `Supabase rechazó los datos: ${e.details?.errors?.[0] || e.message}` };
  return { status: "pending", message: `${MESSAGES.pending} (${e.message})` };
}

export function useLedgerSync(state, setState) {
  const stateRef = useRef(state);
  stateRef.current = state;
  const [status, setStatus] = useState({ status: "local", message: MESSAGES.local });
  const [conflicts, setConflicts] = useState({}); // { [accountId]: remoteAccount }
  const timer = useRef(null);
  const running = useRef(false);
  const rerun = useRef(false);

  // Adopta la cuenta del servidor, salvo que el libro local haya cambiado
  // mientras viajaba el pedido: en ese caso registra la versión, deja la
  // cuenta pendiente y pide otra vuelta.
  const adoptAccount = useCallback((id, remote, snapshot) => {
    const current = stateRef.current.accounts[id];
    if (current.transactions !== snapshot.transactions || current.initialCash !== snapshot.initialCash) rerun.current = true;
    setState((s) => {
      const changed = s.accounts[id].transactions !== snapshot.transactions || s.accounts[id].initialCash !== snapshot.initialCash;
      const accounts = changed ? s.accounts : { ...s.accounts, [id]: { initialCash: remote.initialCash, transactions: remote.transactions } };
      return { ...s, accounts, sync: { ...s.sync, [id]: { version: remote.version, pending: changed } } };
    });
  }, [setState]);

  const pushAccount = useCallback(async (id, baseVersion, token) => {
    const snapshot = stateRef.current.accounts[id];
    try {
      const { account } = await putAccount(id, { baseVersion, initialCash: snapshot.initialCash, transactions: snapshot.transactions }, token);
      adoptAccount(id, account, snapshot);
      return null;
    } catch (e) {
      if (e.status === 409 && e.details?.account) return e.details.account;
      throw e;
    }
  }, [adoptAccount]);

  const syncBenchmarks = useCallback(async (remoteList, token) => {
    const { benchmarks, sync } = stateRef.current;
    const action = decideBenchmarkSync(benchmarks, sync?.benchmarks?.pending, remoteList);
    if (action === "push") {
      await putBenchmarks(benchmarks, token);
      // Solo se baja la marca si nadie editó las referencias mientras viajaba el PUT.
      setState((s) => (s.benchmarks === benchmarks ? { ...s, sync: { ...s.sync, benchmarks: { pending: false } } } : s));
      if (stateRef.current.benchmarks !== benchmarks) rerun.current = true;
    }
    if (action === "adopt") {
      setState((s) => (s.sync?.benchmarks?.pending ? s : { ...s, benchmarks: remoteList }));
    }
  }, [setState]);

  const runSync = useCallback(async () => {
    const token = loadToken();
    if (!token) { setStatus({ status: "local", message: MESSAGES.local }); return; }
    if (running.current) { rerun.current = true; return; }
    running.current = true;
    setStatus({ status: "syncing", message: MESSAGES.syncing });
    try {
      const remote = await fetchLedger(token);
      const found = {};
      for (const id of Object.keys(stateRef.current.accounts)) {
        const local = { ...stateRef.current.accounts[id], ...(stateRef.current.sync?.[id] || { version: null, pending: false }) };
        const remoteAccount = remote.accounts?.[id] || null;
        const action = decideAccountSync(local, remoteAccount, true);
        if (action === "adopt") adoptAccount(id, remoteAccount, stateRef.current.accounts[id]);
        if (action === "push") {
          const conflictWith = await pushAccount(id, local.version ?? remoteAccount.version, token);
          if (conflictWith) found[id] = conflictWith;
        }
        if (action === "conflict") found[id] = remoteAccount;
      }
      await syncBenchmarks(remote.benchmarks || null, token);
      setConflicts(found);
      setStatus(Object.keys(found).length ? { status: "conflict", message: MESSAGES.conflict } : { status: "synced", message: MESSAGES.synced });
    } catch (e) {
      setStatus(errorStatus(e));
    } finally {
      running.current = false;
      if (rerun.current) {
        rerun.current = false;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => runSyncRef.current(), DEBOUNCE_MS);
      }
    }
  }, [adoptAccount, pushAccount, syncBenchmarks]);
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;

  const scheduleSync = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSyncRef.current(), DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const onOnline = () => runSyncRef.current();
    onOnline();
    window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("online", onOnline); clearTimeout(timer.current); };
  }, []);

  // Conflicto de una cuenta: 'server' descarta lo local; 'local' sube este
  // navegador pisando el servidor. Después se sincroniza todo de nuevo, así
  // se ve si quedó otra cuenta en conflicto.
  const resolve = useCallback(async (accountId, choice) => {
    const remote = conflicts[accountId];
    if (!remote || running.current) return;
    running.current = true;
    setConflicts((c) => { const { [accountId]: _done, ...rest } = c; return rest; });
    try {
      if (choice === "server") adoptAccount(accountId, remote, stateRef.current.accounts[accountId]);
      else await pushAccount(accountId, null, loadToken());
    } catch (e) {
      setStatus(errorStatus(e));
    } finally {
      running.current = false;
    }
    runSyncRef.current();
  }, [conflicts, adoptAccount, pushAccount]);

  return { ...status, conflicts, resolve, retry: runSync, scheduleSync };
}
