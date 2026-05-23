/* ============================================================
   DIONE · thesis.js
   CRUD sobre thesis_log (Supabase), parser de JSON DIONE,
   checkpoints automáticos y estadísticas de hit rate.
   ============================================================ */

import { supabase } from "./supabase.js";
import { fetchQuote } from "./marketData.js";

const TABLE = "thesis_log";

// ---- parser JSON ----

// Acepta el JSON que genera DIONE en el chat (varios nombres posibles)
export function parseThesisJson(raw) {
  let obj;
  try {
    obj = typeof raw === "string" ? JSON.parse(raw.trim()) : raw;
  } catch {
    throw new Error("JSON inválido — verificá comillas y llaves");
  }

  const get = (...keys) => {
    for (const k of keys) if (obj[k] != null) return obj[k];
    return null;
  };
  const firstOf = (v) => (Array.isArray(v) ? v[0] : v);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const ticker  = (get("ticker", "symbol") || "").toUpperCase().trim();
  const entry   = num(get("entry", "entry_price"));
  const stop    = num(get("stop", "stop_loss", "stop_price"));

  const errors = [];
  if (!ticker)          errors.push("'ticker' requerido");
  if (entry == null)    errors.push("'entry' requerido (número)");
  if (stop == null)     errors.push("'stop' requerido (número)");
  if (errors.length)    throw new Error(errors.join(" · "));

  return {
    ticker,
    sector:      get("sector") ?? null,
    cap:         get("cap") ?? null,
    thesis_mode: get("thesis_mode", "mode", "modo") ?? "other",
    entry,
    entry_date:  get("entry_date", "date") ?? new Date().toISOString().slice(0, 10),
    target_3m:   num(firstOf(get("target_3m",  "targets_3m")))  ?? null,
    target_12m:  num(firstOf(get("target_12m", "targets_12m"))) ?? null,
    stop,
    conviction:  get("conviction", "confianza") ?? "medium",
    invalidation:get("invalidation", "invalidacion", "invalidación") ?? null,
    thesis_text: get("thesis_text", "thesis", "tesis", "notes") ?? null,
    er_bear:     num(get("er_bear", "bear", "bear_case")) ?? null,
    er_base:     num(get("er_base", "base", "base_case")) ?? null,
    er_bull:     num(get("er_bull", "bull", "bull_case")) ?? null,
    raw_json:    obj,
  };
}

// ---- CRUD ----

export async function loadTheses() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("entry_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveThesis(thesis) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([thesis])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateThesis(id, updates) {
  const { error } = await supabase.from(TABLE).update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteThesis(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- checkpoints ----

const NON_TRADEABLE = new Set(["CASH", "USD", "BRL", "ARS"]);
const DAY = 86_400_000;

export function dueCheckpoints(thesis) {
  if (thesis.status !== "open") return [];
  const elapsed = Date.now() - new Date(thesis.entry_date).getTime();
  const due = [];
  if (!thesis.price_30d  && elapsed >= 30  * DAY) due.push(30);
  if (!thesis.price_90d  && elapsed >= 90  * DAY) due.push(90);
  if (!thesis.price_180d && elapsed >= 180 * DAY) due.push(180);
  return due;
}

// Actualiza checkpoints de una tesis con el precio actual de Finnhub.
// Devuelve true si hubo cambios, false si no.
export async function updateCheckpoints(thesis) {
  const checkpoints = dueCheckpoints(thesis);
  if (checkpoints.length === 0) return false;
  if (NON_TRADEABLE.has(thesis.ticker)) return false;

  let price;
  try {
    const q = await fetchQuote(thesis.ticker);
    price = q?.c;
  } catch {
    return false;
  }
  if (!price) return false;

  const ret = parseFloat(((price / thesis.entry - 1) * 100).toFixed(2));
  const updates = {};

  if (checkpoints.includes(30))  { updates.price_30d  = price; updates.return_30d  = ret; }
  if (checkpoints.includes(90))  { updates.price_90d  = price; updates.return_90d  = ret; }
  if (checkpoints.includes(180)) { updates.price_180d = price; updates.return_180d = ret; }

  // flags de outcome
  if (thesis.target_3m  && price >= thesis.target_3m  && !thesis.target_3m_hit)
    updates.target_3m_hit = true;
  if (thesis.target_12m && price >= thesis.target_12m && !thesis.target_12m_hit)
    updates.target_12m_hit = true;
  if (thesis.stop && price <= thesis.stop && !thesis.stop_hit) {
    updates.stop_hit   = true;
    updates.status     = "stop_hit";
    updates.close_price= price;
    updates.close_date = new Date().toISOString().slice(0, 10);
    updates.close_pnl  = ret;
  }
  if (updates.target_12m_hit && thesis.status === "open") {
    updates.status      = "target_hit";
    updates.close_price = price;
    updates.close_date  = new Date().toISOString().slice(0, 10);
    updates.close_pnl   = ret;
  }

  await updateThesis(thesis.id, updates);
  return true;
}

// ---- estadísticas ----

export function calcStats(theses) {
  const closed = theses.filter((t) => t.status !== "open");
  const hits   = closed.filter((t) => t.status === "target_hit");

  const avg = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;

  // agrupadores genéricos
  const group = (keyFn) => {
    const map = {};
    for (const t of closed) {
      const k = keyFn(t) || "—";
      if (!map[k]) map[k] = { total: 0, hits: 0 };
      map[k].total++;
      if (t.status === "target_hit") map[k].hits++;
    }
    return Object.entries(map)
      .map(([k, d]) => ({ key: k, ...d, hitRate: d.total ? d.hits / d.total : 0 }))
      .sort((a, b) => b.hitRate - a.hitRate);
  };

  return {
    total:         theses.length,
    open:          theses.filter((t) => t.status === "open").length,
    closed:        closed.length,
    hits:          hits.length,
    hitRate:       closed.length ? hits.length / closed.length : null,
    avgReturn30d:  avg(theses.map((t) => t.return_30d).filter((v) => v != null)),
    avgReturn90d:  avg(theses.map((t) => t.return_90d).filter((v) => v != null)),
    avgReturn180d: avg(theses.map((t) => t.return_180d).filter((v) => v != null)),
    byMode:        group((t) => t.thesis_mode),
    byConviction:  group((t) => t.conviction),
    bySector:      group((t) => t.sector),
  };
}
