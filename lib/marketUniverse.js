// lib/marketUniverse.js — Universo completo de NYSE y Nasdaq (paso 1). Puro.
//
// El snapshot `latest` sigue guardando solo a las de calidad (gate) y megacaps,
// porque eso es lo que consume /api/scan. Este universo vive aparte (fila
// 'universe') y sirve de contexto: el gate es una etiqueta, no una puerta.
//
//   listedTickers(sec)        tickers comunes de NYSE y Nasdaq, uno por CIK
//   isCommonTicker(t, ex)     descarta preferentes, warrants, unidades y derechos
//   waitlistReason(f, gate)   "a una métrica" de pasar el gate
//   universeRow(...)          fila liviana para la fila 'universe'

export const LISTED_EXCHANGES = Object.freeze(['NYSE', 'Nasdaq']);
// Piso para considerar una empresa invertible en el descubrimiento.
export const MIN_PRICE = 3;
export const MIN_CAP = 300_000_000;
// Emisores extranjeros: sin capitalización confiable (ADR), el piso es de
// volumen negociado en el día.
export const MIN_FOREIGN_DOLLAR_VOLUME = 5_000_000;

// NYSE: clases con guion (BRK-B), preferentes (JPM-PC), warrants (XYZ-WT),
// unidades (XYZ-U) y derechos (XYZ-RT). Nasdaq: quinta letra W, U, R o Z
// (warrant, unidad, derecho, otro) para tickers de 5 letras.
export function isCommonTicker(ticker, exchange) {
  const t = String(ticker || '').toUpperCase();
  if (!/^[A-Z][A-Z0-9]{0,5}(-[A-Z]{1,2})?$/.test(t)) return false;
  const suffix = t.includes('-') ? t.split('-')[1] : null;
  if (suffix && (suffix.startsWith('P') || ['W', 'WS', 'WT', 'U', 'UN', 'R', 'RT', 'CL'].includes(suffix))) return false;
  if (exchange === 'Nasdaq' && !suffix && t.length === 5 && /[WURZ]$/.test(t)) return false;
  return true;
}

// sec: JSON de company_tickers_exchange.json ({ fields, data: [[cik, name, ticker, exchange]] }).
// Devuelve [{ cik, name, ticker, exchange }], uno por CIK. Se prefiere un
// ticker de `preferred` (la lista de megacaps: GOOGL antes que GOOG), después
// el primero sin guion, después el primero que lista la SEC.
export function listedTickers(sec, { preferred = [] } = {}) {
  const fields = sec?.fields || [];
  const ix = (name) => fields.indexOf(name);
  const [iCik, iName, iTicker, iEx] = [ix('cik'), ix('name'), ix('ticker'), ix('exchange')];
  const byCik = new Map();
  for (const row of sec?.data || []) {
    const exchange = row[iEx];
    const ticker = String(row[iTicker] || '').toUpperCase();
    if (!LISTED_EXCHANGES.includes(exchange) || !isCommonTicker(ticker, exchange)) continue;
    const cik = Number(row[iCik]);
    const list = byCik.get(cik) || [];
    byCik.set(cik, [...list, { cik, name: row[iName] || null, ticker, exchange }]);
  }
  const pref = new Set(preferred);
  return [...byCik.values()].map((list) =>
    list.find((r) => pref.has(r.ticker)) || list.find((r) => !r.ticker.includes('-')) || list[0]);
}

// Las que fallan UNA sola de las tres reglas duras del gate y por poco:
//   ROE entre 7% y 10%, D/E entre 2 y 2.5, o FCF negativo con margen
//   operativo positivo (el flujo puede darse vuelta). Altman en zona de
//   riesgo nunca entra en la lista de espera.
export function waitlistReason(f, gate) {
  if (!gate || gate.pass) return null;
  const reasons = gate.reasons || [];
  if (reasons.length !== 1 || /altman/i.test(reasons[0])) return null;
  const r = reasons[0];
  if (/^ROE/.test(r) && f.roe != null && f.roe > 0.07) return 'ROE cerca de 10%';
  if (/^D\/E/.test(r)) {
    const de = f.debtPartial || f.debtUntagged ? f.debtToEquityMax : f.debtToEquity;
    if (de != null && de < 2.5) return 'D/E cerca de 2';
  }
  if (/^FCF TTM/.test(r) && f.fcfPerShare != null && f.opMargin != null && f.opMargin > 0) return 'FCF negativo con margen operativo positivo';
  return null;
}

const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// Fila liviana: el universo completo pesa ~1-2 MB, no los ~10 MB del snapshot.
// foreign: { currency, taxonomy, fyEnd } si los fundamentales vienen de
// companyfacts (IFRS o us-gaap en otra moneda); cap llega null.
export function universeRow({ listing, f, gate, price, volume, cap, gicsSector, preScore, foreign = null }) {
  const dollarVolume = price != null && volume != null ? price * volume : null;
  const investable = price != null && price >= MIN_PRICE && (
    (cap != null && cap >= MIN_CAP) || (cap == null && foreign != null && dollarVolume != null && dollarVolume >= MIN_FOREIGN_DOLLAR_VOLUME)
  );
  return {
    symbol: listing.ticker,
    cik: listing.cik ?? null,
    name: listing.name,
    exchange: listing.exchange,
    gicsSector: gicsSector ?? null,
    price: round(price, 2),
    marketCap: cap != null ? Math.round(cap) : null,
    dollarVolume: dollarVolume != null ? Math.round(dollarVolume) : null,
    investable,
    gatePass: gate?.pass ?? false,
    gateReasons: gate?.pass ? [] : gate?.reasons ?? [],
    waitlist: waitlistReason(f || {}, gate),
    preScore: preScore ?? null,
    roe: round(f?.roe),
    debtToEquity: round(f?.debtToEquity),
    fcfYield: round(f?.fcfYield),
    opMargin: round(f?.opMargin),
    pe: round(f?.pe, 2),
    hasFundamentals: f != null,
    staleFundamentals: f?.staleFundamentals === true,
    ...(foreign ? { foreign: true, currency: foreign.currency, taxonomy: foreign.taxonomy, fyEnd: foreign.fyEnd } : {}),
  };
}

// Resumen para la meta del universo.
export function universeStats(rows) {
  const count = (fn) => rows.filter(fn).length;
  return {
    total: rows.length,
    withFundamentals: count((r) => r.hasFundamentals),
    priced: count((r) => r.price != null),
    investable: count((r) => r.investable),
    gatePass: count((r) => r.gatePass),
    waitlist: count((r) => r.waitlist),
    withSector: count((r) => r.gicsSector),
    foreign: count((r) => r.foreign),
    withTrend: count((r) => r.trendScore != null),
    byExchange: Object.fromEntries(LISTED_EXCHANGES.map((ex) => [ex, count((r) => r.exchange === ex)])),
  };
}

// Consulta de /api/universe (mode=universe del screener). Puro.
//   gate      all | pass | fail | waitlist        (default all)
//   exchange  NYSE | Nasdaq
//   sector    GICS L1 exacto, sin distinguir mayúsculas
//   all       "1" incluye las que no llegan al piso (precio ≥ $3, cap ≥ $300M)
//   q         busca en símbolo o nombre
//   sort      marketCap (default) | preScore | roe | fcfYield | dollarVolume | trendScore
//   trend     etiqueta de tendencia (EN ZONA, ROTA, ...)
//   limit     1..200 (default 50), offset
const SORTS = ['marketCap', 'preScore', 'roe', 'fcfYield', 'dollarVolume', 'trendScore'];

export function queryUniverse(rows, q = {}) {
  const gate = String(q.gate || 'all').toLowerCase();
  const exchange = q.exchange ? String(q.exchange) : null;
  const sector = q.sector ? String(q.sector).toLowerCase() : null;
  const includeAll = q.all === '1' || q.all === 'true';
  const trend = q.trend ? String(q.trend).toUpperCase().slice(0, 20) : null;
  const text = q.q ? String(q.q).trim().toUpperCase().slice(0, 40) : null;
  const sort = SORTS.includes(q.sort) ? q.sort : 'marketCap';
  const limit = Math.max(1, Math.min(Number(q.limit) || 50, 200));
  const offset = Math.max(0, Number(q.offset) || 0);

  const filtered = rows.filter((r) => {
    if (!includeAll && !text && !r.investable) return false;
    if (gate === 'pass' && !r.gatePass) return false;
    if (gate === 'fail' && r.gatePass) return false;
    if (gate === 'waitlist' && !r.waitlist) return false;
    if (exchange && r.exchange !== exchange) return false;
    if (trend && r.trendLabel !== trend) return false;
    if (sector && String(r.gicsSector || '').toLowerCase() !== sector) return false;
    if (text && !r.symbol.includes(text) && !String(r.name || '').toUpperCase().includes(text)) return false;
    return true;
  });
  // Con texto, primero el ticker exacto y después los que empiezan igual: si
  // no, una extranjera sin capitalización (NU, TSM) queda detrás de NUE.
  const textRank = (r) => (!text ? 0 : r.symbol === text ? 2 : r.symbol.startsWith(text) ? 1 : 0);
  const sorted = [...filtered].sort((a, b) => textRank(b) - textRank(a) || (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity));
  return { total: filtered.length, offset, limit, sort, rows: sorted.slice(offset, offset + limit) };
}

// Suma la tendencia de las tandas (filas universe_tech_1/2: { meta, rows }) a
// las filas del universo. Ignora tandas de más de `maxAgeMs` y no pisa la
// tendencia de calidad que la fila ya trae del snapshot. Puro.
export function withTrend(rows, techRows = [], { now = Date.now(), maxAgeMs = 36 * 3600 * 1000 } = {}) {
  const maps = techRows
    .filter((t) => t?.rows && t.meta?.asOf && now - Date.parse(t.meta.asOf) < maxAgeMs)
    .map((t) => t.rows);
  if (!maps.length) return rows;
  return rows.map((r) => {
    if (r.trendScore != null) return r;
    const t = maps.find((m) => m[r.symbol])?.[r.symbol];
    return t ? { ...r, trendScore: t.trendScore, trendLabel: t.trendLabel, aboveSma200: t.aboveSma200, trendFlags: t.flags } : r;
  });
}
