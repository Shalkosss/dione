import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { validateInBook, ledgerIssues } from "../lib/ledger.js";
import { useLedgerSync } from "./useLedgerSync.js";

/* Portafolio ficticio: dos cuentas (paper y real) con su libro de órdenes, y
   las carteras de referencia para comparar. La copia de trabajo vive en
   localStorage; con token se sincroniza con Supabase (useLedgerSync.js). */

const STORAGE_KEY = "dione:ledger:v1";
const today = () => new Date().toISOString().slice(0, 10);

export const ACCOUNTS = {
  paper: { label: "Paper", initialCash: 1000000 },
  real: { label: "Real", initialCash: 5000 },
};

const DEFAULT_STATE = {
  active: "paper",
  accounts: {
    paper: { initialCash: ACCOUNTS.paper.initialCash, transactions: [] },
    real: { initialCash: ACCOUNTS.real.initialCash, transactions: [] },
  },
  // Carteras de referencia. Vacías hasta que se carguen sus posiciones.
  benchmarks: [
    { id: "claude", name: "Claude", color: "#d98a5f", startDate: today(), weights: {} },
    { id: "grok", name: "Grok", color: "#b08cff", startDate: today(), weights: {} },
  ],
  // Estado de sincronización. version null = nunca se sincronizó desde este navegador.
  sync: {
    paper: { version: null, pending: false },
    real: { version: null, pending: false },
    benchmarks: { pending: false },
  },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const saved = JSON.parse(raw);
    // Un dato con forma inesperada dejaría la app en blanco: se valida antes de usarlo.
    const accounts = { ...DEFAULT_STATE.accounts, ...(saved?.accounts || {}) };
    const valid = Object.values(accounts).every((a) => a && a.initialCash > 0 && Array.isArray(a.transactions))
      && accounts[saved?.active] && (saved.benchmarks == null || Array.isArray(saved.benchmarks));
    if (!valid) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...saved, accounts, sync: { ...DEFAULT_STATE.sync, ...(saved.sync || {}) } };
  } catch {
    return DEFAULT_STATE; // dato corrupto o almacenamiento bloqueado: se empieza de cero
  }
}

const LedgerContext = createContext(null);

export function LedgerProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* almacenamiento lleno o bloqueado */ }
  }, [state]);

  const account = state.accounts[state.active];
  const sync = useLedgerSync(state, setState);
  const { scheduleSync } = sync;

  const setActive = useCallback((id) => setState((s) => (s.accounts[id] ? { ...s, active: id } : s)), []);

  // Toda escritura va a la cuenta que se validó (`activeId` capturado), nunca a
  // "la activa en ese momento": así un cambio de cuenta a mitad de una operación
  // no puede hacer que se valide contra una cuenta y se escriba en otra.
  const activeId = state.active;
  // Cada cambio local queda pendiente de subir a Supabase.
  const updateAccount = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      accounts: { ...s.accounts, [id]: { ...s.accounts[id], ...patch(s.accounts[id]) } },
      sync: { ...s.sync, [id]: { ...s.sync[id], pending: true } },
    }));
    scheduleSync();
  }, [scheduleSync]);

  const updateBenchmarks = useCallback((change) => {
    setState((s) => ({ ...s, benchmarks: change(s.benchmarks), sync: { ...s.sync, benchmarks: { pending: true } } }));
    scheduleSync();
  }, [scheduleSync]);

  // Devuelve { ok, errors }. Solo guarda si la orden es válida contra el libro completo.
  const placeOrder = useCallback((order) => {
    const check = validateInBook(account.initialCash, account.transactions, order);
    if (!check.ok) return check;
    const tx = { ...order, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    updateAccount(activeId, (a) => ({ transactions: [...a.transactions, tx] }));
    return check;
  }, [account, activeId, updateAccount]);

  // No deja borrar un movimiento si el libro queda incoherente (por ejemplo,
  // una compra de la que depende una venta posterior).
  const removeTransaction = useCallback((id) => {
    const remaining = account.transactions.filter((t) => t.id !== id);
    const errors = ledgerIssues(account.initialCash, remaining);
    if (errors.length) return { ok: false, errors };
    updateAccount(activeId, () => ({ transactions: remaining }));
    return { ok: true, errors: [] };
  }, [account, activeId, updateAccount]);

  // Carga varias órdenes de una vez (cartera de ejemplo). Todo o nada.
  // `forAccount` es la cuenta para la que se armaron: si ya no es la activa, no se cargan.
  const placeOrders = useCallback((orders, forAccount = activeId) => {
    if (forAccount !== activeId) return { ok: false, errors: ["Cambiaste de cuenta mientras se armaba la carga: no se guardó nada"] };
    const withIds = orders.map((o, i) => ({ ...o, id: `${Date.now()}-${i}` }));
    const errors = ledgerIssues(account.initialCash, [...account.transactions, ...withIds]);
    if (errors.length) return { ok: false, errors };
    updateAccount(activeId, (a) => ({ transactions: [...a.transactions, ...withIds] }));
    return { ok: true, errors: [] };
  }, [account, activeId, updateAccount]);

  const resetAccount = useCallback(() => updateAccount(activeId, () => ({ transactions: [] })), [activeId, updateAccount]);

  const setInitialCash = useCallback((initialCash) => {
    if (initialCash > 0) updateAccount(activeId, () => ({ initialCash }));
  }, [activeId, updateAccount]);

  const saveBenchmark = useCallback((bench) => {
    updateBenchmarks((list) => (list.some((b) => b.id === bench.id)
      ? list.map((b) => (b.id === bench.id ? { ...b, ...bench } : b))
      : [...list, bench]));
  }, [updateBenchmarks]);

  const removeBenchmark = useCallback((id) => {
    updateBenchmarks((list) => list.filter((b) => b.id !== id));
  }, [updateBenchmarks]);

  const transactionCount = useCallback((id) => state.accounts[id]?.transactions.length ?? 0, [state.accounts]);

  const value = useMemo(() => ({
    activeId,
    account,
    benchmarks: state.benchmarks,
    sync,
    transactionCount,
    setActive, placeOrder, placeOrders, removeTransaction, resetAccount, setInitialCash, saveBenchmark, removeBenchmark,
  }), [state, account, activeId, sync, transactionCount, setActive, placeOrder, placeOrders, removeTransaction, resetAccount, setInitialCash, saveBenchmark, removeBenchmark]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger debe usarse dentro de <LedgerProvider>");
  return ctx;
}
