// lib/ledgerSchema.js — Validación de lo que llega a /api/theses/ledger.
//
// Funciones puras. Normalizan una transacción o una cartera de referencia y
// convierten las filas de Supabase a la forma que usa el navegador.

export const MAX_TX_PER_ACCOUNT = 2000;
export const MAX_BENCHMARKS = 12;
export const ACCOUNT_IDS = ["paper", "real"];

const SIDES = new Set(["BUY", "SELL", "DEPOSIT", "WITHDRAW"]);
const TX_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const TICKER_RE = /^[A-Z^][A-Z0-9.^-]{0,11}$/;
const BENCH_ID_RE = /^[a-z0-9-]{2,24}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const isObject = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

export function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function textField(value, max, label, errors) {
  if (value == null || value === "") return undefined;
  const s = String(value);
  if (s.length > max) errors.push(`${label} supera ${max} caracteres`);
  return s;
}

export function normalizeTransaction(raw) {
  if (!isObject(raw)) return { ok: false, errors: ["la transacción no es un objeto"], tx: null };
  const errors = [];
  const side = String(raw.side || "").toUpperCase();
  const id = String(raw.id || "");
  if (!TX_ID_RE.test(id)) errors.push(`id inválido: "${id}"`);
  if (!validDate(raw.date)) errors.push(`fecha inválida en ${id}`);
  if (!SIDES.has(side)) errors.push(`lado desconocido en ${id}: ${raw.side}`);
  if (!positive(raw.qty)) errors.push(`cantidad inválida en ${id}`);

  const tx = { id, date: raw.date, side, qty: Number(raw.qty) };
  if (side === "BUY" || side === "SELL") {
    const ticker = String(raw.ticker || "").toUpperCase();
    if (!TICKER_RE.test(ticker)) errors.push(`ticker inválido en ${id}`);
    if (!positive(raw.price)) errors.push(`precio inválido en ${id}`);
    tx.ticker = ticker;
    tx.price = Number(raw.price);
  }
  const sector = textField(raw.sector, 40, "sector", errors);
  const note = textField(raw.note, 280, "nota", errors);
  if (sector) tx.sector = sector;
  if (note) tx.note = note;
  return { ok: errors.length === 0, errors, tx: errors.length ? null : tx };
}

export function normalizeBenchmark(raw) {
  if (!isObject(raw)) return { ok: false, errors: ["la referencia no es un objeto"], benchmark: null };
  const errors = [];
  const id = String(raw.id || "");
  if (!BENCH_ID_RE.test(id)) errors.push(`id de referencia inválido: "${id}"`);
  const name = String(raw.name || "").trim();
  if (!name || name.length > 40) errors.push(`nombre inválido en ${id}`);
  if (raw.color != null && !COLOR_RE.test(raw.color)) errors.push(`color inválido en ${id}`);
  if (!validDate(raw.startDate)) errors.push(`fecha de inicio inválida en ${id}`);
  const weights = isObject(raw.weights) ? raw.weights : null;
  if (!weights) errors.push(`pesos inválidos en ${id}`);
  const entries = Object.entries(weights || {});
  if (entries.length > 50) errors.push(`más de 50 tickers en ${id}`);
  const clean = {};
  for (const [t, w] of entries) {
    const ticker = t.toUpperCase();
    if (!TICKER_RE.test(ticker) || !(Number(w) > 0 && Number(w) <= 1)) errors.push(`peso inválido de ${t} en ${id}`);
    else clean[ticker] = Number(w);
  }
  const benchmark = { id, name, color: raw.color ?? null, startDate: raw.startDate, weights: clean };
  return { ok: errors.length === 0, errors, benchmark: errors.length ? null : benchmark };
}

// Fila de `transactions` → transacción del navegador (sin campos de SQL ni nulos).
export function rowToTx(row) {
  const tx = { id: row.id, date: row.date, side: row.side };
  if (row.ticker != null) tx.ticker = row.ticker;
  tx.qty = Number(row.qty);
  if (row.price != null) tx.price = Number(row.price);
  if (row.sector != null) tx.sector = row.sector;
  if (row.note != null) tx.note = row.note;
  return tx;
}

export function rowToBenchmark(row) {
  return { id: row.id, name: row.name, color: row.color, startDate: row.start_date, weights: row.weights || {} };
}
