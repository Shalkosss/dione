// lib/store.js — Persistencia del snapshot en Supabase Postgres.
//
// El filesystem serverless es efímero: hace falta storage externo. Como el
// proyecto ya usa Supabase, guardamos el snapshot como una única fila JSONB
// en la tabla `hidden_gems_snapshot` (id fijo 'latest'). Cero dependencias
// nuevas: @supabase/supabase-js ya está instalado.
//
// Requiere en el entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL                 https://<proj>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    key service_role (saltea RLS, solo server-side)

import { createClient } from '@supabase/supabase-js';

const TABLE = 'hidden_gems_snapshot';
const ROW_ID = 'latest';

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Escribe (upsert) el snapshot completo en la fila 'latest'.
export async function writeSnapshot(data) {
  const { error } = await client()
    .from(TABLE)
    .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase writeSnapshot: ${error.message}`);
  return ROW_ID;
}

// Lee el snapshot. Devuelve null si todavía no se generó.
export async function readSnapshot() {
  try {
    const { data, error } = await client()
      .from(TABLE)
      .select('data')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return data?.data || null;
  } catch (e) {
    console.error('[store] readSnapshot:', e.message);
    return null;
  }
}

// Filas auxiliares de la misma tabla (por ejemplo 'weekly', el ranking de la
// semana pasada para las marcas NUEVO/SUBE/BAJA). Devuelve null solo si la fila
// no existe; un error de Supabase se lanza, para que nadie lo confunda con
// "no hay datos" y pise la fila con algo vacío.
export async function readRow(id) {
  const { data, error } = await client().from(TABLE).select('data').eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase readRow(${id}): ${error.message}`);
  return data?.data || null;
}

// Solo un campo de primer nivel del JSON (por ejemplo 'meta'), sin bajar la
// fila entera: las filas del universo pesan cientos de KB.
export async function readRowField(id, field) {
  const { data, error } = await client().from(TABLE).select(`value:data->${field}`).eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase readRowField(${id}.${field}): ${error.message}`);
  return data?.value ?? null;
}

export async function writeRow(id, data) {
  const { error } = await client().from(TABLE).upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase writeRow(${id}): ${error.message}`);
  return id;
}
