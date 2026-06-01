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
