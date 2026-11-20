// lib/thesisImport.js — Lógica pura del import de tesis por línea de comandos.
//
// La usa scripts/thesis-import.mjs: valida en local con el mismo parser del
// servidor (lib/thesisSchema.js) antes de mandar nada a POST /api/theses.
//
//   parseEnvFile(text)   → { CLAVE: valor } de un .env (sin imprimir valores)
//   prepareImport(input) → { blocks, valid, rejected, duplicateIds, ignored }
//   previewLines(prep)   → líneas de la vista previa
//   responseLines(json)  → líneas con el resultado del servidor
//   parseArgs(argv)      → { files, check, url, help }

import { extractBlocks, normalizeThesis } from './thesisSchema.js';

export function parseEnvFile(text) {
  const env = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

// Un objeto cuenta como tesis si declara el schema o trae ticker y fecha.
function looksLikeThesis(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (typeof obj.schema === 'string') return obj.schema.startsWith('dione-thesis');
  return Boolean((obj.ticker || obj.symbol) && obj.entry_date);
}

export function prepareImport(input) {
  const found = extractBlocks(input);
  const blocks = found.filter(looksLikeThesis);
  const checked = blocks.map((raw, index) => ({ index, id: raw?.id ?? null, ticker: raw?.ticker ?? null, ...normalizeThesis(raw) }));
  const valid = checked.filter((c) => c.ok).map((c) => c.row);
  const rejected = checked.filter((c) => !c.ok).map(({ index, id, ticker, errors }) => ({ index, id, ticker, errors }));

  const seen = new Set();
  const duplicateIds = [];
  for (const { id } of valid) {
    if (seen.has(id) && !duplicateIds.includes(id)) duplicateIds.push(id);
    seen.add(id);
  }
  return { blocks, valid, rejected, duplicateIds, ignored: found.length - blocks.length };
}

const fmt = (v) => (v == null ? '—' : String(v));

function rewardRisk(row) {
  const target = row.target_3m ?? row.tp1;
  if (row.entry == null || row.stop == null || target == null) return '—';
  return `${((target - row.entry) / (row.entry - row.stop)).toFixed(1)}R`;
}

export function previewLines({ valid, rejected, duplicateIds, ignored }) {
  const lines = [];
  for (const r of valid) {
    lines.push(`  OK   ${r.id.padEnd(22)} ${r.rating.padEnd(5)} ${r.order_type.padEnd(9)} entrada ${fmt(r.entry)} · stop ${fmt(r.stop)} · objetivo ${fmt(r.target_3m ?? r.tp1)} · ${rewardRisk(r)}`);
  }
  for (const r of rejected) {
    lines.push(`  MAL  bloque ${r.index + 1}${r.id || r.ticker ? ` (${r.id || r.ticker})` : ''}: ${r.errors.join('; ')}`);
  }
  if (duplicateIds.length) lines.push(`  ids repetidos en el lote: ${duplicateIds.join(', ')}`);
  if (ignored) lines.push(`  ${ignored} objeto(s) JSON ignorados: no son tesis`);
  return lines;
}

export function responseLines(json) {
  if (!json || json.success !== true) {
    const lines = [`  El servidor rechazó el import: ${json?.error || 'respuesta inválida'}`];
    for (const r of json?.data?.rejected || []) lines.push(`  MAL  bloque ${r.index + 1}: ${r.errors.join('; ')}`);
    return lines;
  }
  const { imported = [], rejected = [], refresh } = json.data || {};
  const n = imported.length;
  const lines = [`  ${n} tesis importada${n === 1 ? '' : 's'}: ${imported.map((r) => r.id).join(', ')}`];
  if (rejected.length) lines.push(`  ${rejected.length} rechazada(s) por el servidor`);
  if (refresh?.error) lines.push(`  Tracker: ${refresh.error}`);
  return lines;
}

export function parseArgs(argv) {
  const opts = { files: [], check: false, url: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check' || a === '--dry-run') opts.check = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '--url') { opts.url = argv[i + 1] ?? null; i += 1; }
    else if (a.startsWith('--url=')) opts.url = a.slice(6);
    else opts.files.push(a);
  }
  return opts;
}
