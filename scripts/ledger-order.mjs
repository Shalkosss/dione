// scripts/ledger-order.mjs — Registra una compra o venta en el libro de Supabase.
//
// Uso:
//   npm run ledger:order -- buy JMKE 10 --price 100 --account real
//   npm run ledger:order -- sell NU 50 --price 12.5 --date 2026-11-19 --note "toma de ganancia"
//   npm run ledger:order -- buy MU 5 --price 720 --stop 655 --target 900 --check
//
// Baja el libro de la cuenta (GET /api/theses/ledger), valida la orden con las
// mismas reglas del navegador y lo vuelve a subir con la versión que vio. Si
// otro navegador escribió en el medio, reintenta una vez con el libro nuevo.
// El navegador adopta el cambio solo la próxima vez que sincroniza.
//
// Token: THESES_TOKEN del entorno o de .env.local. URL: --url, DIONE_API_URL o producción.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnvFile } from '../lib/thesisImport.js';
import { parseOrderArgs, planOrder, orderLines } from '../lib/ledgerOrder.js';

const DEFAULT_URL = 'https://dionee.vercel.app';
const HELP = `Uso: npm run ledger:order -- <buy|sell> <TICKER> <cantidad> --price <p>
  [--account paper|real] [--date YYYY-MM-DD] [--stop s] [--target t] [--note "..."] [--check] [--url base]`;

const out = (line = '') => process.stdout.write(`${line}\n`);
const todayLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const newId = () => `${Date.now()}-${randomBytes(3).toString('hex')}`;

async function loadEnv() {
  const local = existsSync('.env.local') ? parseEnvFile(await readFile('.env.local', 'utf8')) : {};
  return { ...local, ...process.env };
}

async function api(base, token, path, init = {}) {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status} sin JSON` }));
  return { status: res.status, json };
}

async function readAccount(base, token, accountId) {
  const { status, json } = await api(base, token, '/api/theses/ledger');
  if (status !== 200 || !json.success) throw new Error(json.error || `HTTP ${status}`);
  const account = json.data?.accounts?.[accountId];
  if (!account) throw new Error(`la cuenta ${accountId} no existe en Supabase`);
  return account;
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) { out(HELP); return argv.length ? 0 : 1; }
  const parsed = parseOrderArgs(argv, todayLima());
  if (parsed.errors.length) { parsed.errors.forEach((e) => out(`  MAL  ${e}`)); out(HELP); return 1; }

  const env = await loadEnv();
  if (!env.THESES_TOKEN) { out('Falta THESES_TOKEN (en el entorno o en .env.local).'); return 1; }
  const base = parsed.url || env.DIONE_API_URL || DEFAULT_URL;
  const id = newId();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const account = await readAccount(base, env.THESES_TOKEN, parsed.account);
    const plan = planOrder(account, parsed.order, id);
    orderLines(parsed.account, plan).forEach((l) => out(l));
    if (!plan.ok) return 1;
    if (parsed.check) { out('  --check: la orden es válida, no se registró.'); return 0; }

    const { status, json } = await api(base, env.THESES_TOKEN, `/api/theses/ledger?account=${parsed.account}`, {
      method: 'PUT', body: JSON.stringify(plan.body),
    });
    if (status === 200 && json.success) { out(`  Registrada en Supabase (versión ${json.data.account.version}).`); return 0; }
    if (status !== 409) { out(`  El servidor rechazó la orden: ${json.error}${json.data?.errors?.length ? ` (${json.data.errors[0]})` : ''}`); return 1; }
    out('  Otro navegador escribió antes; reintento con el libro nuevo…');
  }
  out('  No se pudo registrar: el libro cambió dos veces seguidas. Probá de nuevo.');
  return 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => {
    process.stderr.write(`Error al registrar la orden: ${e.message}\n`);
    process.exitCode = 1;
  });
