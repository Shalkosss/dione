// lib/shortScan.js — Scan short v1 (SHORT_FRAMEWORK.md con los datos del snapshot).
//
// Funciones puras. Lo usan /api/screener?mode=short y scripts/scan-short.mjs.
// Puntaje sobre 100, con la estructura del framework adaptada a lo que el
// snapshot tiene hoy (sin Beneish, short interest ni costo de préstamo):
//
//   Deterioro fundamental 35 · Tendencia rota 30 · Sector débil 15 ·
//   Valuación 10 · Smart money negativo 10
//
// Fundamental y tendencia se reescalan sobre los datos que hay: una fila del
// universo sin Piotroski ni Altman se mide sobre los ítems que sí tiene, y
// lleva la bandera DATOS_PARCIALES. Es la tríada del AQR para el lado corto:
// cara (valuación), con momentum negativo y de baja calidad.
//
// Filtros duros de shortabilidad (cap ≥ $2B, volumen ≥ $50M diarios,
// precio ≥ $10) y anti-traps del framework: no se shortea un compounder de
// calidad en pullback, ni algo sin deterioro fundamental, y si ya cayó
// demasiado (fase E) se espera el rebote a la SMA50.
//
// Pares market neutral (idea del AQR Apex): cada corto se empareja con el
// mejor largo de calidad y tendencia del mismo sector, con montos que igualan
// volatilidad (ATR %).

export const SHORT_FILTERS = Object.freeze({ minCap: 2e9, minDollarVolume: 50e6, minPrice: 10 });
export const THRESHOLDS = Object.freeze({ diamond: 80, short: 65, watch: 50, minFundamental: 15 });

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const pick = (...vals) => vals.map(num).find((v) => v != null) ?? null;

// Unifica filas del snapshot (métricas en `metrics`) y del universo (ratios arriba).
export function normalizeShortRow(r) {
  const m = r.metrics || {};
  return {
    symbol: r.symbol,
    name: r.name ?? null,
    gicsSector: r.gicsSector ?? null,
    marketCap: num(r.marketCap),
    price: num(r.price),
    dollarVolume: num(r.dollarVolume),
    gatePass: r.gatePass ?? null,
    preScore: num(r.preScore),
    trendScore: num(r.trendScore),
    trendLabel: r.trendLabel ?? null,
    aboveSma200: r.aboveSma200 ?? (r.trendInputs?.distSma200 != null ? r.trendInputs.distSma200 > 0 : null),
    metrics: {
      piotroski: pick(m.piotroski),
      altmanZ: pick(m.altmanZ),
      fcfYield: pick(m.fcfYield, r.fcfYield),
      netMargin: pick(m.netMargin, r.netMargin),
      opMargin: pick(m.opMargin, r.opMargin),
      debtToEquity: pick(m.debtToEquity, r.debtToEquity),
      pe: pick(m.pe, r.pe),
      roe: pick(m.roe, r.roe),
    },
    trendInputs: { ...(r.trendInputs || {}) },
  };
}

// Sectores donde deuda alta, FCF negativo y el gate de calidad no indican
// deterioro (balance de banco, REIT que compra activos, utility con capex).
const BALANCE_SHEET_SECTORS = new Set(['Financials', 'Real Estate', 'Utilities']);
const FUND_NAME_RE = /\b(ETF|ETN|iShares|SPDR|Invesco|Vanguard|ProShares|Direxion|Gold Trust|Silver Trust|Bitcoin|Ether)\b/i;
const MIN_FUNDAMENTAL_DATA = 10; // puntos máximos con dato, de 35

function shortability(r) {
  if (FUND_NAME_RE.test(r.name || '')) return 'fondo o trust, no empresa';
  if (r.marketCap == null || r.marketCap < SHORT_FILTERS.minCap) return 'cap menor a $2B o sin dato';
  if (r.dollarVolume != null && r.dollarVolume < SHORT_FILTERS.minDollarVolume) return 'volumen diario menor a $50M';
  if (r.price == null || r.price < SHORT_FILTERS.minPrice) return 'precio menor a $10';
  return null;
}

// Suma ítems [puntos, máximo, hay dato] y reescala al máximo del bloque.
function scaled(items, blockMax) {
  const avail = items.filter((i) => i[2]);
  const max = avail.reduce((s, i) => s + i[1], 0);
  const raw = avail.reduce((s, i) => s + i[0], 0);
  return { points: max ? Math.round(Math.min(blockMax, (raw / max) * blockMax)) : 0, partial: max < items.reduce((s, i) => s + i[1], 0), max };
}

function fundamentalPoints(r) {
  const { piotroski, altmanZ, fcfYield, netMargin, opMargin, debtToEquity } = r.metrics;
  const hasMargin = netMargin != null || opMargin != null;
  const balanceSheet = BALANCE_SHEET_SECTORS.has(r.gicsSector);
  return scaled([
    [piotroski == null ? 0 : piotroski <= 3 ? 8 : piotroski === 4 ? 4 : 0, 8, piotroski != null],
    [altmanZ == null ? 0 : altmanZ < 1.81 ? 7 : altmanZ < 3 ? 3 : 0, 7, altmanZ != null],
    [fcfYield != null && fcfYield <= 0 ? 6 : 0, 6, fcfYield != null && !balanceSheet],
    [(netMargin ?? 0) < 0 || (opMargin ?? 0) < 0 ? 5 : 0, 5, hasMargin],
    [debtToEquity == null ? 0 : debtToEquity > 2 ? 5 : debtToEquity > 1 ? 2 : 0, 5, debtToEquity != null && !balanceSheet],
    [r.gatePass === false ? 4 : 0, 4, r.gatePass != null && !balanceSheet],
  ], 35);
}

function technicalPoints(r) {
  const t = r.trendInputs;
  const ts = r.trendScore;
  const hasStack = t.distSma50 != null && t.distSma200 != null;
  return scaled([
    [ts == null ? 0 : ts <= 20 ? 10 : ts <= 35 ? 6 : ts <= 50 ? 2 : 0, 10, ts != null],
    [r.aboveSma200 === false ? 6 : 0, 6, r.aboveSma200 != null],
    // SMA50 bajo la SMA200: sma50/sma200 = (1 + d200) / (1 + d50) < 1  ⇔  d200 < d50.
    [hasStack && t.distSma200 < t.distSma50 ? 4 : 0, 4, hasStack],
    [(t.mom12_1 ?? 0) < 0 ? 5 : 0, 5, t.mom12_1 != null],
    [(t.rsDiff63 ?? 0) < 0 ? 5 : 0, 5, t.rsDiff63 != null],
  ], 30);
}

function sectorPoints(r, sectors) {
  const s = (sectors || []).find((x) => x.gicsSector === r.gicsSector);
  if (!s) return { points: 0, etf: null };
  return { points: (s.aboveSma200 === false ? 8 : 0) + (s.rs3m != null && s.rs3m < 0 ? 7 : 0), etf: s.etf };
}

function smartMoneyPoints(sm) {
  if (!sm) return null;
  let p = 0;
  const ins = sm.insider;
  if (ins && ins.netUSD != null) {
    if (ins.netUSD < -1e6 && !(ins.buyUSD > 0)) p += 6;
    else if (ins.netUSD < 0) p += 3;
  }
  const a = sm.analyst?.upgradesMinusDowngrades;
  if (a != null && a < 0) p += 4;
  return Math.min(10, p);
}

function valuationPoints(r) {
  const { pe, netMargin } = r.metrics;
  if (pe != null && pe > 40) return 10;
  if (pe != null && pe > 25) return 5;
  if (pe == null && netMargin != null && netMargin < 0) return 6;
  return 0;
}

function isQualityCompounder(r) {
  return r.gatePass === true && (r.metrics.piotroski ?? 0) >= 7 && (r.preScore ?? 0) >= 70;
}

function isExtended(r) {
  const t = r.trendInputs;
  return (t.rsi14 != null && t.rsi14 < 30) || (t.distSma50 != null && t.distSma50 < -0.15);
}

function verdictFor(score, flags) {
  if (score < THRESHOLDS.watch) return 'EVITAR';
  if (score < THRESHOLDS.short) return 'VIGILAR';
  if (flags.includes('EXTENDIDA')) return 'ESPERAR REBOTE';
  return score >= THRESHOLDS.diamond ? 'DIAMANTE' : 'SHORT';
}

export function scoreShort(row, { sectors = [], smartMoney = {} } = {}) {
  const base = { symbol: row.symbol, score: 0, breakdown: null, flags: [], verdict: 'EVITAR', sectorEtf: null };
  const notShortable = shortability(row);
  if (notShortable) return { ...base, excluded: notShortable };
  if (isQualityCompounder(row)) return { ...base, excluded: 'calidad en pullback (anti-trap 3)' };

  const m = row.metrics;
  const noProfit = (m.netMargin ?? 0) < 0 || (m.opMargin ?? 0) < 0 || (m.pe == null && (m.fcfYield ?? 0) <= 0);
  if (row.gicsSector === 'Health Care' && noProfit) {
    return { ...base, excluded: 'binario: salud sin ganancias (aprobaciones, M&A)' };
  }
  const fund = fundamentalPoints(row);
  if (fund.max < MIN_FUNDAMENTAL_DATA) return { ...base, excluded: 'datos fundamentales insuficientes' };
  const fundamental = fund.points;
  if (fundamental < THRESHOLDS.minFundamental) return { ...base, excluded: 'sin deterioro fundamental' };
  const tech = technicalPoints(row);

  const sector = sectorPoints(row, sectors);
  const sm = smartMoneyPoints(smartMoney[row.symbol]);
  const breakdown = {
    fundamental,
    technical: tech.points,
    sector: sector.points,
    smartMoney: sm ?? 0,
    valuation: valuationPoints(row),
  };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  const flags = [
    ...(isExtended(row) ? ['EXTENDIDA'] : []),
    ...(sm == null ? ['SIN_SMART_MONEY'] : []),
    ...(row.trendInputs.atr14 == null ? ['SIN_ATR'] : []),
    ...(fund.partial || tech.partial ? ['DATOS_PARCIALES'] : []),
  ];
  return { ...base, score, breakdown, flags, verdict: verdictFor(score, flags), sectorEtf: sector.etf, excluded: null };
}

// Plan del corto: stop a 2 ATR (8% sin ATR) y objetivo a 3R (R:R mínimo 1:3).
// Si está extendida, la entrada es el rebote a la SMA50.
export function shortPlan(row, flags) {
  const t = row.trendInputs;
  const sma50 = t.distSma50 != null ? row.price / (1 + t.distSma50) : null;
  const entry = flags.includes('EXTENDIDA') && sma50 ? sma50 : row.price;
  const risk = t.atr14 != null ? 2 * t.atr14 : entry * 0.08;
  const round = (v) => Math.round(v * 100) / 100;
  return { entry: round(entry), stop: round(entry + risk), target: round(entry - 3 * risk), riskPct: risk / entry };
}

const atrPct = (r) => (r.trendInputs.atr14 != null && r.price ? r.trendInputs.atr14 / r.price : null);

function bestLong(rows, sector) {
  return rows
    .filter((r) => r.gicsSector === sector && r.gatePass === true && (r.preScore ?? 0) >= 70
      && (r.trendScore ?? 0) >= 60 && r.aboveSma200 !== false)
    .sort((a, b) => (b.preScore + b.trendScore) - (a.preScore + a.trendScore))[0] || null;
}

export function buildShortScan(rows, { sectors = [], smartMoney = {}, minScore = THRESHOLDS.watch, perSector = 3, limit = 25 } = {}) {
  const excluded = {};
  const scored = [];
  for (const row of rows) {
    const s = scoreShort(row, { sectors, smartMoney });
    if (s.excluded) {
      const key = s.excluded.split(' ')[0] === 'cap' ? 'cap' : s.excluded.match(/volumen|precio|calidad|deterioro|fondo|binario|insuficientes/)?.[0] || 'otro';
      excluded[key] = (excluded[key] || 0) + 1;
      continue;
    }
    if (s.score >= minScore) scored.push({ row, s });
  }

  const perSectorCount = {};
  const candidates = scored
    .sort((a, b) => b.s.score - a.s.score)
    .filter(({ row }) => {
      const k = row.gicsSector || '—';
      perSectorCount[k] = (perSectorCount[k] || 0) + 1;
      return perSectorCount[k] <= perSector;
    })
    .slice(0, limit)
    .map(({ row, s }) => ({
      symbol: row.symbol, name: row.name, gicsSector: row.gicsSector, sectorEtf: s.sectorEtf,
      price: row.price, marketCap: row.marketCap, trendScore: row.trendScore, trendLabel: row.trendLabel,
      score: s.score, verdict: s.verdict, breakdown: s.breakdown, flags: s.flags,
      metrics: row.metrics, plan: shortPlan(row, s.flags), row,
    }));

  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const pairs = candidates.map((c) => {
    const long = bestLong(rows, c.gicsSector);
    const volShort = atrPct(bySymbol.get(c.symbol));
    const volLong = long ? atrPct(long) : null;
    return {
      short: c.symbol,
      long: long?.symbol ?? null,
      hedgeEtf: c.sectorEtf,
      longPerShort: volShort && volLong ? Math.round((volShort / volLong) * 100) / 100 : 1,
    };
  });

  return { candidates, pairs, excluded, scanned: rows.length };
}

// Snapshot de calidad (objeto por símbolo, métricas completas) + universo
// (lista, ratios básicos). Gana la fila del snapshot.
export function mergeUniverse(gems = {}, universeRows = []) {
  const fromSnap = Object.values(gems || {});
  const seen = new Set(fromSnap.map((r) => r.symbol));
  const volume = new Map((universeRows || []).map((r) => [r?.symbol, r?.dollarVolume]));
  const snapRows = fromSnap.map((r) => (r.dollarVolume == null && volume.get(r.symbol) != null ? { ...r, dollarVolume: volume.get(r.symbol) } : r));
  return [...snapRows, ...(universeRows || []).filter((r) => r?.symbol && !seen.has(r.symbol))];
}

// Suma al candidato el smart money (insiders y analistas) que el endpoint no
// lee: lo agrega el script con /api/smart-money. Devuelve un candidato nuevo.
export function applySmartMoney(candidate, sm) {
  const pts = smartMoneyPoints(sm);
  if (pts == null) return candidate;
  const breakdown = { ...candidate.breakdown, smartMoney: pts };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
  const flags = candidate.flags.filter((f) => f !== 'SIN_SMART_MONEY');
  return { ...candidate, breakdown, score, flags, verdict: verdictFor(score, flags) };
}

// Beta de una serie de cierres contra la del índice (retornos diarios alineados por fecha).
export function betaFromCloses(asset, index) {
  const idx = new Map(index.map((c) => [c.date, c.close]));
  const pts = [];
  for (let i = 1; i < asset.length; i++) {
    const a0 = asset[i - 1], a1 = asset[i];
    const i0 = idx.get(a0.date), i1 = idx.get(a1.date);
    if (i0 && i1) pts.push([a1.close / a0.close - 1, i1 / i0 - 1]);
  }
  if (pts.length < 20) return null;
  const mean = (k) => pts.reduce((s, p) => s + p[k], 0) / pts.length;
  const ma = mean(0), mi = mean(1);
  const cov = pts.reduce((s, p) => s + (p[0] - ma) * (p[1] - mi), 0);
  const varI = pts.reduce((s, p) => s + (p[1] - mi) ** 2, 0);
  return varI > 0 ? cov / varI : null;
}

// Cuánto hay que vender en corto (en dólares de beta 1) para que la exposición
// beta de la cartera baje a `targetNet` del valor total. Posiciones: { ticker, value, beta }.
export function hedgeNeeded(positions, { totalValue, targetNet = 0.5 } = {}) {
  const gross = positions.reduce((s, p) => s + p.value, 0);
  const betaDollars = positions.reduce((s, p) => s + p.value * (p.beta ?? 1), 0);
  const total = totalValue ?? gross;
  const target = targetNet * total;
  return {
    gross,
    betaDollars,
    netBeta: total ? betaDollars / total : 0,
    target,
    shortBetaDollars: Math.max(0, betaDollars - target),
  };
}

// Entradas de tendencia desde velas diarias { date, h, l, c } (las que el
// universo no trae). `bench` es el ETF del sector, para la fuerza relativa.
export function trendInputsFromCandles(candles, bench = []) {
  const c = candles.map((k) => k.c);
  const n = c.length;
  if (n < 60) return {};
  const sma = (len) => (n >= len ? c.slice(n - len).reduce((a, b) => a + b, 0) / len : null);
  const last = c[n - 1];
  const sma50 = sma(50), sma200 = sma(200);
  const tr = candles.slice(1).map((k, i) => Math.max(k.h - k.l, Math.abs(k.h - candles[i].c), Math.abs(k.l - candles[i].c)));
  let atr = tr.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  for (let i = 14; i < tr.length; i++) atr = (atr * 13 + tr[i]) / 14;
  let gain = 0, loss = 0;
  for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
  gain /= 14; loss /= 14;
  for (let i = 15; i < n; i++) { const d = c[i] - c[i - 1]; gain = (gain * 13 + Math.max(d, 0)) / 14; loss = (loss * 13 + Math.max(-d, 0)) / 14; }
  const rsi14 = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  const ret = (series, k) => (series.length > k ? series[series.length - 1] / series[series.length - 1 - k] - 1 : null);
  const ret63 = ret(c, 63);
  const benchRet = ret(bench.map((k) => k.c), 63);
  return {
    atr14: atr,
    rsi14,
    distSma50: sma50 ? last / sma50 - 1 : null,
    distSma200: sma200 ? last / sma200 - 1 : null,
    ret63,
    mom12_1: n > 252 ? c[n - 22] / c[n - 253] - 1 : null,
    rsDiff63: ret63 != null && benchRet != null ? ret63 - benchRet : null,
  };
}

// Completa la fila con las entradas calculadas sin pisar las que ya tenía.
export function withCandleInputs(row, inputs) {
  const trendInputs = { ...inputs, ...Object.fromEntries(Object.entries(row.trendInputs).filter(([, v]) => v != null)) };
  const aboveSma200 = row.aboveSma200 ?? (trendInputs.distSma200 != null ? trendInputs.distSma200 > 0 : null);
  return { ...row, trendInputs, aboveSma200 };
}
