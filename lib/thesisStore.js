// lib/thesisStore.js — Acceso a las tablas `theses` y `thesis_marks` (Supabase).
//
// Solo server-side: usa la service_role key, igual que lib/store.js.
// Esquema en migrations/002_theses.sql.

import { createClient } from '@supabase/supabase-js';
import { initialState } from './thesisTracker.js';

const THESES = 'theses';
const MARKS = 'thesis_marks';
const PAGE = 1000;          // tope de filas por request de PostgREST
const CHUNK = 500;

// Columnas que escribe el tracker en cada corrida.
export const TRACKER_COLUMNS = Object.freeze([
  'status', 'filled_at', 'fill_price', 'closed_at', 'close_price', 'close_reason',
  'r_multiple', 'tp1_hit_at', 'sessions_to_fill', 'sessions_tracked',
  'tracking_done', 'flags', 'perf', 'last_checked',
]);

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // code = 'CONFIG' → los endpoints responden 503 con este mensaje (no expone secretos).
    throw Object.assign(new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas'), { code: 'CONFIG' });
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]));
const fail = (op, error) => new Error(`Supabase ${op}: ${error.message}`);

// Fila normalizada → fila con el estado inicial del tracker. Importar de nuevo
// una tesis reinicia su seguimiento; el refresco la reconstruye desde precios.
export function toInsertRow(row) {
  return {
    ...row,
    ...pick(initialState(row), TRACKER_COLUMNS),
    flags: [],
    sessions_tracked: 0,
    tracking_done: false,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertTheses(rows) {
  const { data, error } = await client()
    .from(THESES)
    .upsert(rows.map(toInsertRow), { onConflict: 'id' })
    .select('id, ticker, status');
  if (error) throw fail('upsertTheses', error);
  return data ?? [];
}

export async function listTheses({ statuses = [], ids = [], onlyTrackable = false } = {}) {
  let query = client().from(THESES).select('*').order('entry_date', { ascending: false }).limit(PAGE);
  if (statuses.length) query = query.in('status', statuses);
  if (ids.length) query = query.in('id', ids);
  if (onlyTrackable) query = query.eq('tracking_done', false);
  const { data, error } = await query;
  if (error) throw fail('listTheses', error);
  return data ?? [];
}

export async function getThesis(id) {
  const { data, error } = await client().from(THESES).select('*').eq('id', id).maybeSingle();
  if (error) throw fail('getThesis', error);
  return data ?? null;
}

export async function getMarks(thesisId) {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client()
      .from(MARKS).select('*').eq('thesis_id', thesisId)
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw fail('getMarks', error);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return all;
  }
}

// Guarda el resultado de replayThesis: columnas del tracker y marcas del día.
export async function saveReplay(thesis, marks) {
  for (let i = 0; i < marks.length; i += CHUNK) {
    const { error } = await client()
      .from(MARKS)
      .upsert(marks.slice(i, i + CHUNK), { onConflict: 'thesis_id,date' });
    if (error) throw fail('saveReplay(marks)', error);
  }
  const { error } = await client()
    .from(THESES)
    .update({ ...pick(thesis, TRACKER_COLUMNS), updated_at: new Date().toISOString() })
    .eq('id', thesis.id);
  if (error) throw fail('saveReplay(thesis)', error);
}
