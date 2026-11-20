// lib/ledgerOrder.js — Lógica pura de `npm run ledger:order`.
//
// Registra una compra o venta en el libro de Supabase desde la línea de
// comandos (o desde Claude Code cuando el usuario dice "compré 10 JMKE a 100").
// Usa las mismas validaciones que el servidor y el navegador: lib/ledgerSchema.js
// y validateInBook de lib/ledger.js.
//
//   parseOrderArgs(argv, today) → { order, account, check, url, errors }
//   planOrder(account, order, id) → { ok, tx, body, after, errors }
//   orderLines(accountId, plan)   → resumen legible

import { accountState, validateInBook } from './ledger.js';
import { ACCOUNT_IDS, normalizeTransaction } from './ledgerSchema.js';

const SIDE_WORDS = {
  B: 'BUY', BUY: 'BUY', C: 'BUY', COMPRA: 'BUY', COMPRAR: 'BUY',
  S: 'SELL', SELL: 'SELL', V: 'SELL', VENTA: 'SELL', VENDER: 'SELL',
};
const VALUE_FLAGS = ['price', 'account', 'date', 'stop', 'target', 'note', 'url'];
const NUMERIC = ['price', 'stop', 'target'];

function readFlags(argv) {
  const flags = { check: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check' || a === '--dry-run') { flags.check = true; continue; }
    const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
    if (m && VALUE_FLAGS.includes(m[1])) {
      flags[m[1]] = m[2] !== undefined ? m[2] : argv[i + 1];
      if (m[2] === undefined) i += 1;
      continue;
    }
    positional.push(a);
  }
  return { flags, positional };
}

export function parseOrderArgs(argv, today) {
  const { flags, positional } = readFlags(argv);
  const [word, rawTicker, rawQty] = positional;
  const errors = [];
  const side = SIDE_WORDS[String(word || '').toUpperCase()];
  if (!side) errors.push('falta el lado: buy/compra o sell/venta');
  const ticker = String(rawTicker || '').toUpperCase();
  if (!ticker) errors.push('falta el ticker');
  const qty = Number(rawQty);
  if (!(qty > 0)) errors.push('falta la cantidad de acciones (número mayor a cero)');

  const order = { side, ticker, qty, date: flags.date || today };
  for (const k of NUMERIC) {
    if (flags[k] == null) continue;
    order[k] = Number(flags[k]);
  }
  if (!(order.price > 0)) errors.push('falta --price (precio de ejecución)');
  if (flags.note) order.note = String(flags.note);

  const account = flags.account || 'paper';
  if (!ACCOUNT_IDS.includes(account)) errors.push(`cuenta desconocida: ${account} (paper o real)`);
  return { order, account, check: flags.check, url: flags.url || null, errors };
}

export function planOrder(account, order, id) {
  const { ok, errors, tx } = normalizeTransaction({ ...order, id });
  if (!ok) return { ok: false, errors };
  const check = validateInBook(account.initialCash, account.transactions, tx);
  if (!check.ok) return { ok: false, errors: check.errors };
  const transactions = [...account.transactions, tx];
  return {
    ok: true,
    tx,
    body: { baseVersion: account.version, transactions },
    after: accountState(account.initialCash, transactions),
    errors: [],
  };
}

const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function orderLines(accountId, plan) {
  if (!plan.ok) return plan.errors.map((e) => `  MAL  ${e}`);
  const { tx, after } = plan;
  const verb = tx.side === 'BUY' ? 'COMPRA' : 'VENTA';
  const levels = [tx.stop != null && `stop ${tx.stop}`, tx.target != null && `take profit ${tx.target}`].filter(Boolean);
  const held = after.positions[tx.ticker];
  return [
    `  ${verb} ${tx.qty} ${tx.ticker} a ${tx.price} (USD ${money(tx.qty * tx.price)}) · cuenta ${accountId} · ${tx.date}`,
    ...(levels.length ? [`  ${levels.join(' · ')}`] : []),
    `  Después: caja USD ${money(after.cash)} · ${tx.ticker} ${held ? `${held.qty} acciones a costo ${held.cost.toFixed(2)}` : 'cerrada'}`,
  ];
}
