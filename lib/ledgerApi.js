// lib/ledgerApi.js — /api/theses/ledger: libro de órdenes en Supabase.
//
// Vive dentro de api/theses/[id].js para no gastar otra función de Vercel.
//
//   GET /api/theses/ledger                       → { accounts: { paper, real }, benchmarks }
//   PUT /api/theses/ledger?account=paper         → reemplaza el libro de esa cuenta
//        cuerpo { baseVersion: number|null, initialCash?, transactions? }
//   PUT /api/theses/ledger?resource=benchmarks   → cuerpo { benchmarks: [...] }
//
// Todo exige el THESES_TOKEN, también la lectura: el libro de la cuenta real
// no debe quedar a la vista de cualquiera que conozca la URL.

import { tokenMatches } from './apiAuth.js';
import { ledgerIssues } from './ledger.js';
import { ACCOUNT_IDS, MAX_BENCHMARKS, MAX_TX_PER_ACCOUNT, normalizeBenchmark, normalizeTransaction } from './ledgerSchema.js';
import { readAccount, readLedger, replaceAccount, replaceBenchmarks } from './ledgerStore.js';

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const bad = (status, error, errors = []) => ({ ok: false, status, error, errors });

// Puro: a partir de la cuenta actual y el pedido decide qué escribir.
// `baseVersion` es obligatorio: un número (la versión que vio el navegador)
// o null para forzar ("subir este navegador" tras un conflicto).
export function planAccountWrite(current, body) {
  if (!isObject(body)) return bad(400, 'el cuerpo debe ser un objeto JSON');
  if (!('baseVersion' in body) || (body.baseVersion !== null && !Number.isInteger(body.baseVersion))) {
    return bad(400, 'falta baseVersion (número o null)');
  }
  const initialCash = body.initialCash == null ? current.initialCash : Number(body.initialCash);
  if (!(initialCash > 0)) return bad(400, 'capital inicial inválido');

  let book = current.transactions;
  if (body.transactions !== undefined) {
    if (!Array.isArray(body.transactions)) return bad(400, 'transactions debe ser una lista');
    if (body.transactions.length > MAX_TX_PER_ACCOUNT) return bad(400, `más de ${MAX_TX_PER_ACCOUNT} movimientos`);
    const normalized = body.transactions.map(normalizeTransaction);
    const errors = normalized.flatMap((n) => n.errors);
    if (errors.length) return bad(400, 'Libro inválido', errors);
    book = normalized.map((n) => n.tx);
    const ids = new Set(book.map((t) => t.id));
    if (ids.size !== book.length) return bad(400, 'Libro inválido', ['hay ids de movimiento repetidos']);
  }

  const issues = ledgerIssues(initialCash, book);
  if (issues.length) return bad(400, 'Libro inválido', issues);

  return {
    ok: true,
    rpc: {
      expectedVersion: body.baseVersion,
      initialCash: body.initialCash == null ? null : initialCash,
      rows: book,
    },
  };
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

async function putAccount(req, res) {
  const account = String(req.query.account || '');
  if (!ACCOUNT_IDS.includes(account)) return send(res, 400, { success: false, error: `cuenta desconocida: ${account}` });
  const current = await readAccount(account);
  if (!current) return send(res, 400, { success: false, error: `cuenta desconocida: ${account}` });

  const plan = planAccountWrite(current, req.body);
  if (!plan.ok) return send(res, plan.status, { success: false, error: plan.error, data: { errors: plan.errors } });

  try {
    await replaceAccount({ account, ...plan.rpc });
  } catch (e) {
    if (e.code !== 'CONFLICT') throw e;
    const latest = await readAccount(account);
    return send(res, 409, { success: false, error: 'conflicto de versión', data: { code: 'VERSION_CONFLICT', account: latest } });
  }
  return send(res, 200, { success: true, data: { account: await readAccount(account) } });
}

async function putBenchmarks(req, res) {
  const list = isObject(req.body) ? req.body.benchmarks : null;
  if (!Array.isArray(list) || list.length > MAX_BENCHMARKS) {
    return send(res, 400, { success: false, error: `benchmarks debe ser una lista de hasta ${MAX_BENCHMARKS}` });
  }
  const normalized = list.map(normalizeBenchmark);
  const errors = normalized.flatMap((n) => n.errors);
  if (errors.length) return send(res, 400, { success: false, error: 'Referencias inválidas', data: { errors } });
  const saved = await replaceBenchmarks(normalized.map((n) => n.benchmark));
  return send(res, 200, { success: true, data: { benchmarks: saved } });
}

export async function handleLedger(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT');
    return send(res, 405, { success: false, error: 'método no permitido' });
  }
  const secret = process.env.THESES_TOKEN;
  if (!secret) return send(res, 503, { success: false, error: 'THESES_TOKEN no configurado en el servidor' });
  if (!tokenMatches(req, secret)) return send(res, 401, { success: false, error: 'token inválido' });

  try {
    if (req.method === 'GET') return send(res, 200, { success: true, data: await readLedger() });
    if (req.query.resource === 'benchmarks') return await putBenchmarks(req, res);
    return await putAccount(req, res);
  } catch (e) {
    if (e.code === 'CONFIG') return send(res, 503, { success: false, error: e.message });
    if (e.code === 'NOT_MIGRATED') {
      return send(res, 503, { success: false, error: 'Falta aplicar migrations/003_transactions.sql en Supabase', data: { code: 'LEDGER_NOT_MIGRATED' } });
    }
    console.error('[theses/ledger]', e);
    return send(res, 500, { success: false, error: 'Error interno en el libro de órdenes' });
  }
}
