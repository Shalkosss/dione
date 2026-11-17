// lib/finnhub.js — Enriquecimiento de metadata (sector/industry) vía Finnhub.
//
// Free tier: 30 req/sec, 60 req/min. Usamos throttle conservador a 25/sec
// y cacheamos en Supabase (tabla symbol_metadata) por 30 días — la mayor parte
// de las corridas del cron leen del cache y solo refrescan stale/missing.

import { createClient } from '@supabase/supabase-js';
import { fetchSubmissionsByCik } from './edgar.js';

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
// En tandas de 400: con el universo completo (~5.000 símbolos) un solo
// `in (...)` superaría el largo máximo de la URL de PostgREST.
async function readCache(symbols) {
  const out = new Map();
  for (let i = 0; i < symbols.length; i += 400) {
    try {
      const { data, error } = await client()
        .from(TABLE)
        .select('symbol, sector, industry, name, updated_at')
        .in('symbol', symbols.slice(i, i + 400));
      if (error) throw error;
      for (const row of data || []) out.set(row.symbol, row);
    } catch (e) {
      console.warn('[finnhub] readCache:', e.message);
    }
  }
  return out;
}

async function writeCache(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    try {
      const { error } = await client().from(TABLE).upsert(rows.slice(i, i + 500), { onConflict: 'symbol' });
      if (error) throw error;
    } catch (e) {
      console.warn('[finnhub] writeCache:', e.message);
    }
  }
}

// Enriquece una lista de symbols con sector/industry. Devuelve Map sym→{sector, industry}.
// Cachea por 30 días. Throttle ~25/s. Tolera fallos por símbolo (no rompe el batch).
export async function enrichSectors(symbols, opts = {}) {
  // opts.cikBySymbol: Map sym→cik. Si está, habilita fallback SEC submissions.
  // opts.skipFinnhub: no usar Finnhub (universo completo: 5.000 pedidos no entran).
  // opts.deadline: epoch ms; lo que no alcance queda para la corrida siguiente
  // (el cache dura 30 días, así que en pocos días queda completo).
  const cikBySymbol = opts.cikBySymbol || null;
  const deadline = opts.deadline ?? Infinity;
  const cache = await readCache(symbols);
  const now = Date.now();
  const stale = [];
  const out = new Map();

  for (const s of symbols) {
    const c = cache.get(s);
    const age = c?.updated_at ? now - new Date(c.updated_at).getTime() : Infinity;
    if (c && age < TTL_MS && c.sector) {
      out.set(s, { sector: c.sector, industry: c.industry, name: c.name ?? null });
    } else {
      stale.push(s);
    }
  }

  if (!stale.length) return out;

  const fresh = [];

  // Pasada 1 — Finnhub (rápido, pero gicsSector incompleto en free tier).
  if (KEY && !opts.skipFinnhub) {
    const CONC = 5;
    let idx = 0;
    const workers = Array.from({ length: Math.min(CONC, stale.length) }, async () => {
      while (idx < stale.length) {
        const s = stale[idx++];
        const profile = await fetchProfile(s);
        await new Promise((r) => setTimeout(r, 40));
        if (profile && profile.sector) {
          out.set(s, { sector: profile.sector, industry: profile.industry, name: profile.name });
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
  }

  // Pasada 2 — SEC submissions/CIK fallback (sicDescription como sector).
  // Yahoo quoteSummary v10/v7 cuelga sin crumb desde IPs no-browser, así que
  // ya no vale como fallback. SEC EDGAR sí responde estable.
  const stillMissing = stale.filter((s) => !out.has(s));
  if (stillMissing.length && cikBySymbol) {
    const ciks = stillMissing
      .map((s) => ({ sym: s, cik: cikBySymbol.get(s) }))
      .filter((x) => x.cik != null);
    const cikList = ciks.map((x) => x.cik);
    const subsMap = await fetchSubmissionsByCik(cikList, { concurrency: 3, throttleMs: 350, deadline });
    for (const { sym, cik } of ciks) {
      const s = subsMap.get(cik);
      if (!s?.sicDescription) continue;
      out.set(sym, { sector: s.sicDescription, industry: s.sicDescription, name: s.name });
      fresh.push({
        symbol: sym,
        sector: s.sicDescription,
        industry: s.sicDescription,
        name: s.name,
        updated_at: new Date().toISOString(),
      });
    }
  }

  await writeCache(fresh);
  return out;
}
