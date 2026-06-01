// lib/edgar.js — Fundamentales desde SEC EDGAR (XBRL), 100% gratis y sin cuota.
//
// CLAVE: usamos los "frames" (data.sec.gov/api/xbrl/frames). Un frame trae UN
// concepto (ej. NetIncomeLoss) de TODAS las empresas para un período, en una
// sola llamada. Con ~15 llamadas tenemos todo lo necesario para computar los
// ratios de las ~6.000 empresas que reportan, en una corrida (<60s). Por eso
// EDGAR no necesita rotación por chunks como un proveedor con cuota diaria.
//
// SEC exige un User-Agent declarado con contacto real (ver SEC_USER_AGENT) y
// pide <10 req/s — acá hacemos ~15 llamadas espaciadas, sin problema.
//
// LÍMITES honestos del XBRL:
//  - No hay precio ni market cap (eso viene de NASDAQ).
//  - Los tags varían entre empresas: probamos varios nombres y, si falta, el
//    campo queda null (el gate/score lo tolera).
//  - Usamos el último año fiscal anual completo (flujos = CYxxxx, stocks =
//    CYxxxxQ4I). Es un screener fundamental, no intradía.

const FRAMES = 'https://data.sec.gov/api/xbrl/frames/us-gaap';
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_UA = process.env.SEC_USER_AGENT || 'DIONE-research claudealeuthype1@gmail.com';
const HEADERS = { 'User-Agent': SEC_UA, Accept: 'application/json' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP_' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ticker (UPPER) → cik numérico
export async function fetchTickerCikMap() {
  const j = await getJSON(TICKERS_URL);
  const map = new Map();
  for (const k in j) {
    const e = j[k];
    if (e?.ticker && e?.cik_str != null) map.set(String(e.ticker).toUpperCase(), e.cik_str);
  }
  return map;
}

// Trae un frame → Map cik→val (primer valor por cik). Devuelve Map vacío si falla.
async function frame(concept, period) {
  try {
    const j = await getJSON(`${FRAMES}/${concept}/USD/${period}.json`);
    const m = new Map();
    for (const d of j?.data || []) if (!m.has(d.cik)) m.set(d.cik, d.val);
    return m;
  } catch {
    return new Map();
  }
}

// Prueba varios tags para el mismo dato y mergea (primero no-nulo gana por cik).
async function frameAny(concepts, period) {
  const out = new Map();
  for (const c of concepts) {
    const m = await frame(c, period);
    for (const [cik, val] of m) if (!out.has(cik)) out.set(cik, val);
    await sleep(110); // respeto el rate limit de SEC
  }
  return out;
}

// Elige el año fiscal anual más reciente con cobertura suficiente.
async function pickYear(preferred) {
  const candidates = preferred ? [preferred] : [2025, 2024, 2023];
  for (const y of candidates) {
    const m = await frame('NetIncomeLoss', `CY${y}`);
    await sleep(110);
    if (m.size >= 1000) return { year: y, ni: m };
  }
  // último intento: el más viejo del set, aunque tenga poca cobertura
  const y = candidates[candidates.length - 1];
  return { year: y, ni: await frame('NetIncomeLoss', `CY${y}`) };
}

// Construye Map cik → fundamentales crudos (los valores absolutos del XBRL).
export async function fetchRawFactsByCik({ year } = {}) {
  const { year: Y, ni } = await pickYear(year);
  const A = `CY${Y}`;       // flujos anuales
  const I = `CY${Y}Q4I`;    // stocks (instantáneos a fin de año)

  // flujos (anuales)
  const rev = await frameAny(
    ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], A);
  const gp = await frame('GrossProfit', A);
  const oi = await frame('OperatingIncomeLoss', A);
  const ocf = await frame('NetCashProvidedByUsedInOperatingActivities', A);
  const capex = await frameAny(
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], A);

  // stocks (instantáneos)
  const eq = await frame('StockholdersEquity', I);
  const assets = await frame('Assets', I);
  const liab = await frame('Liabilities', I);
  const curA = await frame('AssetsCurrent', I);
  const curL = await frame('LiabilitiesCurrent', I);

  const out = new Map();
  const ciks = new Set([...ni.keys(), ...eq.keys()]);
  for (const cik of ciks) {
    out.set(cik, {
      ni: ni.get(cik) ?? null,
      rev: rev.get(cik) ?? null,
      gp: gp.get(cik) ?? null,
      oi: oi.get(cik) ?? null,
      ocf: ocf.get(cik) ?? null,
      capex: capex.get(cik) ?? null,
      eq: eq.get(cik) ?? null,
      assets: assets.get(cik) ?? null,
      liab: liab.get(cik) ?? null,
      curA: curA.get(cik) ?? null,
      curL: curL.get(cik) ?? null,
    });
  }
  return { year: Y, facts: out, coverage: out.size };
}

const div = (a, b) => (a != null && b != null && b !== 0 ? a / b : null);

// Computa los ratios que consumen scoring.js (gate + preScore), combinando los
// facts del XBRL con cap/precio de NASDAQ.
export function computeMetrics(symbol, raw, marketCap, price) {
  const fcf = raw.ocf != null && raw.capex != null ? raw.ocf - raw.capex : null;
  // ROIC aprox = NOPAT / capital empleado, con tasa fiscal flat 21%.
  const capitalEmpleado =
    raw.eq != null && raw.liab != null ? raw.eq + raw.liab : null;
  const roic = raw.oi != null && capitalEmpleado ? (raw.oi * 0.79) / capitalEmpleado : null;

  return {
    symbol,
    roe: div(raw.ni, raw.eq),
    roic,
    netMargin: div(raw.ni, raw.rev),
    grossMargin: div(raw.gp, raw.rev),
    opMargin: div(raw.oi, raw.rev),
    currentRatio: div(raw.curA, raw.curL),
    debtToEquity: div(raw.liab, raw.eq), // proxy: pasivos totales / patrimonio
    fcf,
    fcfPerShare: fcf, // scoring.gate solo mira el signo (FCF > 0)
    fcfYield: div(fcf, marketCap),
    pe: raw.ni != null && raw.ni > 0 ? div(marketCap, raw.ni) : null,
    netDebtToEbitda: null, // requiere deuda+EBITDA desglosados → se omite en free
  };
}
