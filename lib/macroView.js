// lib/macroView.js — Vista sectorial de /macro (regla 3 de vigencia). Puro.
//
// El research emite en /macro qué sectores sobrepondera. La web la guarda en la
// fila 'macro_view' de hidden_gems_snapshot (PUT /api/theses/ledger?resource=macro,
// con token) y el tracker la usa para levantar la bandera SECTOR en las tesis
// emitidas con sector_view "OW" cuyo sector ya no está en la lista.
//
// Forma guardada: { overweight: [GICS], underweight: [GICS], asOf: 'YYYY-MM-DD', note }

import { GICS_SECTORS, toGicsL1 } from './gics.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 500;
// Una vista de hace más de 60 días ya no dice nada sobre el presente.
export const MACRO_MAX_AGE_DAYS = 60;

// Acepta nombres GICS ("Information Technology") o cortos ("Technology", "XLK" no).
function toSector(name) {
  const exact = GICS_SECTORS.find((g) => g.toLowerCase() === String(name).trim().toLowerCase());
  return exact || toGicsL1(String(name));
}

export function normalizeMacroView(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: ['cuerpo inválido'] };
  const list = (key) => {
    const raw = body[key] ?? [];
    if (!Array.isArray(raw)) { errors.push(`${key} debe ser una lista`); return []; }
    const out = [];
    for (const name of raw) {
      const s = toSector(name);
      if (!s) errors.push(`sector desconocido en ${key}: ${name}`);
      else if (!out.includes(s)) out.push(s);
    }
    return out;
  };
  const overweight = list('overweight');
  const underweight = list('underweight');
  const both = overweight.filter((s) => underweight.includes(s));
  if (both.length) errors.push(`un sector no puede estar en las dos listas: ${both.join(', ')}`);
  const asOf = body.asOf ?? new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) errors.push('asOf debe ser YYYY-MM-DD');
  const note = body.note == null ? null : String(body.note).slice(0, MAX_NOTE);
  if (errors.length) return { ok: false, errors };
  return { ok: true, view: { overweight, underweight, asOf, note } };
}

// Lista de sobreponderados para el tracker, o null si no hay vista vigente
// (sin vista la regla queda inactiva en vez de marcar todo).
export function overweightFor(view, today = new Date().toISOString()) {
  if (!view || !Array.isArray(view.overweight) || !view.asOf) return null;
  const age = (Date.parse(`${String(today).slice(0, 10)}T00:00:00Z`) - Date.parse(`${view.asOf}T00:00:00Z`)) / 86400000;
  return age <= MACRO_MAX_AGE_DAYS ? view.overweight : null;
}
