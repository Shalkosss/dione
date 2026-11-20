// scripts/thesis-import.mjs — Importa bloques dione-thesis-v2 al tracker.
//
// Lee uno o varios archivos (o lo que llegue por stdin), encuentra los bloques
// de tesis, los valida en local con lib/thesisSchema.js y, si todos pasan, los
// manda a POST /api/theses. El servidor guarda y reconstruye el estado.
//
// Uso:
//   npm run thesis:import -- informe.md            valida y sube
//   npm run thesis:import -- informe.md --check    solo valida, no sube nada
//   npm run thesis:import -- informe.md --url http://localhost:5173
//   cat informe.md | npm run thesis:import
//
// Token: THESES_TOKEN del entorno o de .env.local. URL: --url, DIONE_API_URL
// o la de producción. Si un bloque falla, no se sube ninguno.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseEnvFile, prepareImport, previewLines, responseLines, parseArgs } from '../lib/thesisImport.js';

const DEFAULT_URL = 'https://dionee.vercel.app';
const HELP = `Uso: npm run thesis:import -- <archivo...> [--check] [--url <base>]
  --check   valida sin subir
  --url     base de la API (por defecto DIONE_API_URL o ${DEFAULT_URL})
Sin archivos lee stdin.`;

const out = (line = '') => process.stdout.write(`${line}\n`);

async function readInput(files) {
  if (files.length) {
    const texts = await Promise.all(files.map((f) => readFile(f, 'utf8')));
    return texts.join('\n');
  }
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function loadLocalEnv() {
  if (!existsSync('.env.local')) return {};
  return parseEnvFile(await readFile('.env.local', 'utf8'));
}

async function send(url, token, rows) {
  const res = await fetch(`${url.replace(/\/$/, '')}/api/theses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ blocks: rows.map((r) => r.raw_json) }),
  });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status} sin JSON` }));
  return { status: res.status, json };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { out(HELP); return 0; }

  const text = await readInput(opts.files);
  const prep = prepareImport(text);
  if (!prep.blocks.length) { out('No se encontró ningún bloque dione-thesis-v2.'); out(HELP); return 1; }

  out(`Bloques encontrados: ${prep.blocks.length}`);
  previewLines(prep).forEach((l) => out(l));
  if (prep.rejected.length || prep.duplicateIds.length) {
    out('\nCorregí los bloques marcados. No se subió nada.');
    return 1;
  }
  if (opts.check) { out('\n--check: todo válido, no se subió nada.'); return 0; }

  const env = { ...(await loadLocalEnv()), ...process.env };
  const token = env.THESES_TOKEN;
  if (!token) { out('\nFalta THESES_TOKEN (en el entorno o en .env.local).'); return 1; }
  const url = opts.url || env.DIONE_API_URL || DEFAULT_URL;

  out(`\nSubiendo ${prep.valid.length} tesis a ${url} …`);
  const { status, json } = await send(url, token, prep.valid);
  responseLines(json).forEach((l) => out(l));
  return status === 200 && json.success ? 0 : 1;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => {
    process.stderr.write(`Error al importar tesis: ${e.message}\n`);
    process.exitCode = 1;
  });
