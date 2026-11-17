// lib/ledgerStore.js — Acceso a las tablas del libro de órdenes (Supabase).
//
// Solo server-side (service_role). Esquema en migrations/003_transactions.sql.
// Errores con `code`: CONFIG (faltan keys), NOT_MIGRATED (falta la 003),
// CONFLICT (otra escritura cambió la versión), NO_ACCOUNT.

import { createClient } from '@supabase/supabase-js';
import { ACCOUNT_IDS, rowToTx, rowToBenchmark } from './ledgerSchema.js';

const PAGE = 1000;
const NOT_MIGRATED = new Set(['42P01', '42883', 'PGRST202', 'PGRST205']);

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw Object.assign(new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas'), { code: 'CONFIG' });
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

function fail(op, error) {
  const code = NOT_MIGRATED.has(error.code) ? 'NOT_MIGRATED'
    : error.code === 'DN409' || error.code === '23505' ? 'CONFLICT'
      : error.code === 'DN404' ? 'NO_ACCOUNT'
        : 'DB';
  return Object.assign(new Error(`Supabase ${op}: ${error.message}`), { code });
}

async function readTransactions(accountIds) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client()
      .from('transactions')
      .select('*')
      .in('account', accountIds)
      .order('account')
      .order('pos')
      .range(from, from + PAGE - 1);
    if (error) throw fail('readTransactions', error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function toAccount(row, txRows) {
  return {
    id: row.id,
    initialCash: Number(row.initial_cash),
    version: Number(row.version),
    updatedAt: row.updated_at,
    transactions: txRows.filter((t) => t.account === row.id).map(rowToTx),
  };
}

async function readAccounts(ids) {
  const { data, error } = await client().from('ledger_accounts').select('*').in('id', ids);
  if (error) throw fail('readAccounts', error);
  const txRows = await readTransactions(ids);
  return Object.fromEntries((data ?? []).map((row) => [row.id, toAccount(row, txRows)]));
}

export async function readAccount(accountId) {
  const accounts = await readAccounts([accountId]);
  return accounts[accountId] ?? null;
}

export async function readLedger() {
  const accounts = await readAccounts(ACCOUNT_IDS);
  const { data, error } = await client().from('benchmark_portfolios').select('*').order('pos');
  if (error) throw fail('readBenchmarks', error);
  return { accounts, benchmarks: (data ?? []).map(rowToBenchmark) };
}

// Reemplaza el libro entero de una cuenta. Devuelve la versión nueva.
export async function replaceAccount({ account, expectedVersion, initialCash, rows }) {
  const { data, error } = await client().rpc('ledger_replace', {
    p_account: account,
    p_expected_version: expectedVersion,
    p_initial_cash: initialCash,
    p_rows: rows,
  });
  if (error) throw fail('replaceAccount', error);
  return Number(data);
}

// Guarda la lista completa de referencias: actualiza las que vienen y borra las demás.
export async function replaceBenchmarks(benchmarks) {
  const now = new Date().toISOString();
  const rows = benchmarks.map((b, pos) => ({
    id: b.id, name: b.name, color: b.color, start_date: b.startDate, weights: b.weights, pos, updated_at: now,
  }));
  if (rows.length) {
    const { error } = await client().from('benchmark_portfolios').upsert(rows, { onConflict: 'id' });
    if (error) throw fail('upsertBenchmarks', error);
  }
  const keep = rows.map((r) => r.id);
  let del = client().from('benchmark_portfolios').delete();
  del = keep.length ? del.not('id', 'in', `(${keep.map((id) => `"${id}"`).join(',')})`) : del.neq('id', '');
  const { error } = await del;
  if (error) throw fail('deleteBenchmarks', error);
  return benchmarks;
}
