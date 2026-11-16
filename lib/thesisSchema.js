// lib/thesisSchema.js — Parser y validación del bloque `dione-thesis-v2`.
//
// Lo usan el endpoint POST /api/theses (servidor) y el importador de la
// página Thesis (vista previa). Función pura, sin dependencias.
//
//   extractBlocks(input)  → objetos crudos encontrados en un texto, objeto o array
//   normalizeThesis(raw)  → { ok, row, errors } con la fila lista para Supabase

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const ID_RE = /^[A-Za-z0-9._-]{3,48}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RATINGS = ['BUY', 'WATCH', 'AVOID'];
const ORDER_TYPES = ['LIMIT', 'MARKET', 'SIN_ORDEN'];
const CONVICTION_V1 = { low: 2, medium: 3, high: 4, baja: 2, media: 3, alta: 4 };
const MAX_TEXT = 2000;

export const MAX_BLOCKS = 50;

const TEXT_FIELDS = [
  'account', 'thesis_mode', 'sector', 'cap', 'trend_label', 'regime',
  'sector_view', 'invalidation', 'thesis_text', 'post_mortem',
];
const PRICE_FIELDS = ['ref_price', 'spy_ref', 'entry', 'stop', 'tp1', 'target_3m', 'target_12m'];
const RATIO_FIELDS = ['er_bear', 'er_base', 'er_bull', 'p_bear', 'p_base', 'p_bull', 'size_pct'];
const DATE_FIELDS = ['valid_until', 'time_stop', 'next_earnings', 'reviewed_at'];

const isValidDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const toNum = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// Recorre el texto y devuelve cada objeto JSON de primer nivel que parsea.
function scanJsonObjects(text) {
  const found = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"' && depth > 0) inString = true;
    else if (ch === '{') { if (depth === 0) start = i; depth += 1; }
    else if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        try { found.push(JSON.parse(text.slice(start, i + 1))); } catch { /* fragmento que no es JSON: se ignora */ }
      }
    }
  }
  return found;
}

export function extractBlocks(input) {
  if (input == null) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object') return Array.isArray(input.blocks) ? input.blocks : [input];
  if (typeof input !== 'string') return [];
  const text = input.trim();
  try {
    return extractBlocks(JSON.parse(text));
  } catch {
    return scanJsonObjects(text);
  }
}

function resolveOrderType(raw) {
  const explicit = String(raw.order_type || '').toUpperCase().replace(/\s+/g, '_');
  if (ORDER_TYPES.includes(explicit)) return explicit;
  if (explicit === 'NONE' || explicit === 'SIN') return 'SIN_ORDEN';
  const status = String(raw.status || '').toUpperCase();
  if (status === 'ARMADA') return 'LIMIT';
  if (status === 'ABIERTA') return 'MARKET';
  return 'SIN_ORDEN';
}

function resolveConviction(v, errors) {
  if (v == null || v === '') return null;
  const legacy = CONVICTION_V1[String(v).toLowerCase()];
  if (legacy) return legacy;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) { errors.push("'conviction' debe ser un entero de 1 a 5"); return null; }
  return n;
}

function resolveManualClose(v, errors) {
  if (v == null) return null;
  const price = toNum(v.price);
  if (typeof v !== 'object' || !isValidDate(v.date) || Number.isNaN(price) || (price != null && price <= 0)) {
    errors.push("'manual_close' debe ser { date: 'YYYY-MM-DD', price?, reason: 'TESIS' | 'TIEMPO' }");
    return null;
  }
  return { date: v.date, price, reason: v.reason === 'TIEMPO' ? 'TIEMPO' : 'TESIS' };
}

function checkLevels(row, errors) {
  const hasOrder = row.order_type !== 'SIN_ORDEN';
  if (hasOrder && row.entry == null) errors.push("'entry' requerido cuando hay orden");
  if (hasOrder && row.stop == null) errors.push("'stop' requerido cuando hay orden");
  if (row.ref_price == null) errors.push("'ref_price' requerido (cierre del día de emisión)");
  if (row.entry != null && row.stop != null && row.stop >= row.entry) {
    errors.push("'stop' debe quedar por debajo de 'entry' (solo posiciones largas)");
  }
  for (const k of ['tp1', 'target_3m', 'target_12m']) {
    if (row.entry != null && row[k] != null && row[k] <= row.entry) errors.push(`'${k}' debe quedar por encima de 'entry'`);
  }
}

export function normalizeThesis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, row: null, errors: ['El bloque no es un objeto JSON'] };
  }
  const errors = [];
  const ticker = String(raw.ticker || raw.symbol || '').toUpperCase().trim();
  if (!TICKER_RE.test(ticker)) errors.push("'ticker' requerido (letras, números, punto o guion)");
  if (!isValidDate(raw.entry_date)) errors.push("'entry_date' requerido con formato YYYY-MM-DD");

  const rating = RATINGS.find((r) => String(raw.rating || '').toUpperCase().trim().startsWith(r)) || null;
  if (!rating) errors.push(`'rating' debe ser ${RATINGS.join(', ')}`);

  const row = {
    id: raw.id != null ? String(raw.id).trim() : `${ticker}-${raw.entry_date}`,
    schema_version: String(raw.schema || 'dione-thesis-v2').slice(0, 40),
    ticker,
    entry_date: raw.entry_date,
    rating,
    order_type: resolveOrderType(raw),
    conviction: resolveConviction(raw.conviction, errors),
    sector_etf: raw.sector_etf ? String(raw.sector_etf).toUpperCase().trim() : null,
    manual_close: resolveManualClose(raw.manual_close, errors),
    raw_json: raw,
  };
  if (!ID_RE.test(row.id)) errors.push("'id' inválido (3 a 48 caracteres: letras, números, punto, guion)");
  if (row.sector_etf && !TICKER_RE.test(row.sector_etf)) errors.push("'sector_etf' inválido");

  for (const k of TEXT_FIELDS) row[k] = raw[k] == null ? null : String(raw[k]).slice(0, MAX_TEXT);
  row.account = row.account || 'paper';
  for (const k of [...PRICE_FIELDS, ...RATIO_FIELDS]) {
    const n = toNum(raw[k]);
    if (Number.isNaN(n)) errors.push(`'${k}' debe ser un número`);
    else if (n != null && PRICE_FIELDS.includes(k) && n <= 0) errors.push(`'${k}' debe ser mayor a cero`);
    row[k] = Number.isNaN(n) ? null : n;
  }
  for (const k of DATE_FIELDS) {
    if (raw[k] != null && !isValidDate(raw[k])) errors.push(`'${k}' debe tener formato YYYY-MM-DD`);
    row[k] = raw[k] ?? null;
  }
  if (row.order_type === 'MARKET' && row.ref_price == null) row.ref_price = row.entry;
  checkLevels(row, errors);

  return errors.length ? { ok: false, row: null, errors } : { ok: true, row, errors: [] };
}
