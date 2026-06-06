// lib/finnhub.js — Enriquecimiento de metadata (sector/industry) vía Finnhub.
//
// Free tier: 30 req/sec, 60 req/min. Usamos throttle conservador a 25/sec
// y cacheamos en Supabase (tabla symbol_metadata) por 30 días — la mayor parte
// de las corridas del cron leen del cache y solo refrescan stale/missing.

import { createClient } from '@supabase/supabase-js';

const KEY = process.env.FINNHUB_KEY || '';
const TABLE = 'symbol_metadata';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

let _client = null;
function client() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE no configurado');
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

async function fetchProfile(symbol) {
  if (!KEY) return null;
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || typeof j !== 'object') return null;
    return {
      sector: j.gicsSector || j.finnhubIndustry || null,
      industry: j.finnhubIndustry || null,
      name: j.name || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Lee el cache para los symbols dados. Devuelve Map sym→{sector, industry, updated_at}.
async function readCache(symbols) {
  const out = new Map();
  if (!symbols.length) return out;
  try {
    const { data, error } = await client()
      .from(TABLE)
      .select('symbol, sector, industry, updated_at')
      .in('symbol', symbols);
    if (error) throw error;
    for (const row of data || []) out.set(row.symbol, row);
  } catch (e) {
    console.warn('[finnhub] readCache:', e.message);
  }
  return out;
}

async function writeCache(rows) {
  if (!rows.length) return;
  try {
    const { error } = await client().from(TABLE).upsert(rows, { onConflict: 'symbol' });
    if (error) throw error;
  } catch (e) {
    console.warn('[finnhub] writeCache:', e.message);
  }
}

// Enriquece una lista de symbols con sector/industry. Devuelve Map sym→{sector, industry}.
// Cachea por 30 días. Throttle ~25/s. Tolera fallos por símbolo (no rompe el batch).
export async function enrichSectors(symbols) {
  const cache = await readCache(symbols);
  const now = Date.now();
  const stale = [];
  const out = new Map();

  for (const s of symbols) {
    const c = cache.get(s);
    const age = c?.updated_at ? now - new Date(c.updated_at).getTime() : Infinity;
    if (c && age < TTL_MS && c.sector) {
      out.set(s, { sector: c.sector, industry: c.industry });
    } else {
      stale.push(s);
    }
  }

  if (!KEY || !stale.length) return out;

  // throttle: 25/sec → 40ms per request. Concurrencia 5 con jitter.
  const CONC = 5;
  let idx = 0;
  const fresh = [];
  const workers = Array.from({ length: Math.min(CONC, stale.length) }, async () => {
    while (idx < stale.length) {
      const s = stale[idx++];
      const profile = await fetchProfile(s);
      await new Promise((r) => setTimeout(r, 40));
      if (profile && profile.sector) {
        out.set(s, { sector: profile.sector, industry: profile.industry });
        fresh.push({
          symbol: s,
          sector: profile.sector,
          industry: profile.industry,
          name: profile.name,
          updated_at: new Date().toISOString(),
        });
      }
    }
  });
  await Promise.all(workers);

  // Persist en background-ish (await pero no rompe si falla)
  await writeCache(fresh);
  return out;
}
