// lib/edgar.js — Fundamentales desde SEC EDGAR (XBRL), 100% gratis y sin cuota.
//
// CLAVE: usamos los "frames" (data.sec.gov/api/xbrl/frames). Un frame trae UN
// concepto (ej. NetIncomeLoss) de TODAS las empresas para un período, en una
// sola llamada. Con ~20 llamadas tenemos todo lo necesario para computar los
// ratios de las ~6.000 empresas que reportan, en una corrida (<60s).
//
// SEC exige un User-Agent declarado con contacto real (ver SEC_USER_AGENT) y
// pide <10 req/s — acá hacemos ~25 llamadas espaciadas, sin problema.

const FRAMES = 'https://data.sec.gov/api/xbrl/frames';
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
async function frameRaw(taxonomy, concept, unit, period) {
  try {
    const j = await getJSON(`${FRAMES}/${taxonomy}/${concept}/${unit}/${period}.json`);
    const m = new Map();
    for (const d of j?.data || []) if (!m.has(d.cik)) m.set(d.cik, d.val);
    return m;
  } catch {
    return new Map();
  }
}

// atajo para los conceptos us-gaap en USD (lo más común)
const frame = (concept, period) => frameRaw('us-gaap', concept, 'USD', period);

// Acciones en circulación por cik (namespace dei). Mergea trimestres recientes
// (el más nuevo gana) para maximizar cobertura. Con esto + precio = market cap.
export async function fetchSharesByCik() {
  const periods = ['CY2025Q3I', 'CY2025Q2I', 'CY2025Q1I', 'CY2024Q4I'];
  const out = new Map();
  for (const p of periods) {
    const m = await frameRaw('dei', 'EntityCommonStockSharesOutstanding', 'shares', p);
    for (const [cik, val] of m) if (!out.has(cik) && val > 0) out.set(cik, val);
    await sleep(125);
  }
  return out;
}

// submissions/CIK{n}.json → { sicDescription, name, exchanges, tickers }.
// Devuelve Map cik → { sicDescription, name }. Tolerante: símbolo que falla → no se incluye.
export async function fetchSubmissionsByCik(ciks, { concurrency = 4, throttleMs = 250 } = {}) {
  const out = new Map();
  let idx = 0;
  const list = [...ciks];
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (idx < list.length) {
      const cik = list[idx++];
      const padded = String(cik).padStart(10, '0');
      try {
        const j = await getJSON(`https://data.sec.gov/submissions/CIK${padded}.json`, 8000);
        if (j?.sicDescription) {
          out.set(cik, { sicDescription: j.sicDescription, name: j.name || null });
        }
      } catch { /* skip */ }
      if (throttleMs > 0) await new Promise((r) => setTimeout(r, throttleMs));
    }
  });
  await Promise.all(workers);
  return out;
}

// shares en un Q4I específico (para Piotroski check de dilución YoY)
async function fetchSharesAtQ4(year) {
  return frameRaw('dei', 'EntityCommonStockSharesOutstanding', 'shares', `CY${year}Q4I`);
}

// Prueba varios tags y mergea (primero no-nulo gana por cik).
async function frameAny(concepts, period) {
  const out = new Map();
  for (const c of concepts) {
    const m = await frame(c, period);
    for (const [cik, val] of m) if (!out.has(cik)) out.set(cik, val);
    await sleep(125);
  }
  return out;
}

// Elige el año fiscal anual más reciente con cobertura suficiente.
// Computamos candidates desde el año actual hacia atrás — evita el bug de
// hardcodear [2025, 2024, 2023] que quedaba viejo año tras año.
async function pickYear(preferred) {
  const curYear = new Date().getUTCFullYear();
  const candidates = preferred ? [preferred] : [curYear, curYear - 1, curYear - 2];
  for (const y of candidates) {
    const m = await frame('NetIncomeLoss', `CY${y}`);
    await sleep(125);
    if (m.size >= 1000) return { year: y, ni: m };
  }
  const y = candidates[candidates.length - 1];
  return { year: y, ni: await frame('NetIncomeLoss', `CY${y}`) };
}

// Bundle de un año fiscal (flujos + stocks). Reusable para FY y FY-1 (Piotroski).
async function fetchYearBundle(Y, opts = { withPrior: false }) {
  const A = `CY${Y}`;
  const I = `CY${Y}Q4I`;

  const ni = await frame('NetIncomeLoss', A);
  const rev = await frameAny(
    ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], A);
  const gp = await frame('GrossProfit', A);
  const oi = await frame('OperatingIncomeLoss', A);
  const ocf = await frame('NetCashProvidedByUsedInOperatingActivities', A);
  const capex = await frameAny(
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], A);

  const eq = await frame('StockholdersEquity', I);
  const assets = await frame('Assets', I);
  const liab = await frame('Liabilities', I);
  const curA = await frame('AssetsCurrent', I);
  const curL = await frame('LiabilitiesCurrent', I);
  const re = await frame('RetainedEarningsAccumulatedDeficit', I);

  // Long-term debt (fallbacks por orden de preferencia)
  const ltd = await frameAny(
    ['LongTermDebtNoncurrent', 'LongTermDebt', 'NotesPayableNoncurrent'], I);
  // Short-term debt
  const std = await frameAny(
    ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings', 'NotesPayableCurrent'], I);

  return { Y, ni, rev, gp, oi, ocf, capex, eq, assets, liab, curA, curL, re, ltd, std };
}

// Construye Map cik → fundamentales crudos. Si opts.withPrior, agrega "prior" para Piotroski.
export async function fetchRawFactsByCik({ year } = {}) {
  const { year: Y } = await pickYear(year);
  const cur = await fetchYearBundle(Y);
  const prev = await fetchYearBundle(Y - 1);
  const sharesCur = await fetchSharesAtQ4(Y);
  const sharesPrev = await fetchSharesAtQ4(Y - 1);

  const out = new Map();
  const ciks = new Set([...cur.ni.keys(), ...cur.eq.keys()]);
  for (const cik of ciks) {
    out.set(cik, {
      // current FY
      ni: cur.ni.get(cik) ?? null,
      rev: cur.rev.get(cik) ?? null,
      gp: cur.gp.get(cik) ?? null,
      oi: cur.oi.get(cik) ?? null,
      ocf: cur.ocf.get(cik) ?? null,
      capex: cur.capex.get(cik) ?? null,
      eq: cur.eq.get(cik) ?? null,
      assets: cur.assets.get(cik) ?? null,
      liab: cur.liab.get(cik) ?? null,
      curA: cur.curA.get(cik) ?? null,
      curL: cur.curL.get(cik) ?? null,
      re: cur.re.get(cik) ?? null,
      ltd: cur.ltd.get(cik) ?? null,
      std: cur.std.get(cik) ?? null,
      sharesQ4: sharesCur.get(cik) ?? null,
      // prior FY (para Piotroski deltas)
      prev: {
        ni: prev.ni.get(cik) ?? null,
        rev: prev.rev.get(cik) ?? null,
        gp: prev.gp.get(cik) ?? null,
        ocf: prev.ocf.get(cik) ?? null,
        assets: prev.assets.get(cik) ?? null,
        liab: prev.liab.get(cik) ?? null,
        curA: prev.curA.get(cik) ?? null,
        curL: prev.curL.get(cik) ?? null,
        ltd: prev.ltd.get(cik) ?? null,
        sharesQ4: sharesPrev.get(cik) ?? null,
      },
    });
  }
  return { year: Y, facts: out, coverage: out.size };
}

const div = (a, b) => (a != null && b != null && b !== 0 ? a / b : null);
const sumOrNull = (a, b) => {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
};

// ---------------------------------------------------------------------------
// computeMetrics: ratios que consumen scoring.js (gate + preScore).
// debtToEquity ahora es (LongTermDebt + ShortTermDebt) / Equity (no pasivos totales).
// ---------------------------------------------------------------------------
export function computeMetrics(symbol, raw, marketCap = null, price = null) {
  const fcf = raw.ocf != null && raw.capex != null ? raw.ocf - raw.capex : null;
  const capitalEmpleado =
    raw.eq != null && raw.liab != null ? raw.eq + raw.liab : null;
  const roic = raw.oi != null && capitalEmpleado ? (raw.oi * 0.79) / capitalEmpleado : null;

  // deuda total = LT + ST. Si NINGUNO de los dos buckets aparece → null
  // (no usar liab total como fallback; eso era el bug).
  const totalDebt = (raw.ltd != null || raw.std != null) ? sumOrNull(raw.ltd, raw.std) : null;
  const debtToEquity = totalDebt != null ? div(totalDebt, raw.eq) : null;

  // --- Altman: Z (manufacturera) primero; Z" (non-manuf / financieras) fallback ---
  // Z   = 1.2A + 1.4B + 3.3C + 0.6D + 1.0E
  // Z"  = 6.56A + 3.26B + 6.72C + 1.05D'   (sin E; D' = BookEquity/Liab, no MarketCap)
  // A: (curA - curL)/assets; B: RE/assets; C: oi/assets; E: rev/assets
  let altmanZ = null;
  let altmanModel = null;
  const A = raw.curA != null && raw.curL != null ? div(raw.curA - raw.curL, raw.assets) : null;
  const B = div(raw.re, raw.assets);
  const C = div(raw.oi, raw.assets);
  const D = div(marketCap, raw.liab);
  const E = div(raw.rev, raw.assets);
  if (A != null && B != null && C != null && D != null && E != null) {
    altmanZ = 1.2 * A + 1.4 * B + 3.3 * C + 0.6 * D + 1.0 * E;
    altmanModel = 'Z';
  } else {
    // Z" — no requiere marketCap ni revenue. Útil para financieras y nombres sin precio.
    const Dp = div(raw.eq, raw.liab);
    if (A != null && B != null && C != null && Dp != null) {
      altmanZ = 6.56 * A + 3.26 * B + 6.72 * C + 1.05 * Dp;
      altmanModel = 'Z"';
    }
  }

  // --- Piotroski F-Score ---
  const piotroskiOut = computePiotroski(raw);

  return {
    symbol,
    roe: div(raw.ni, raw.eq),
    roic,
    netMargin: div(raw.ni, raw.rev),
    grossMargin: div(raw.gp, raw.rev),
    opMargin: div(raw.oi, raw.rev),
    currentRatio: div(raw.curA, raw.curL),
    debtToEquity,
    fcf,
    fcfPerShare: fcf,
    fcfYield: div(fcf, marketCap),
    pe: raw.ni != null && raw.ni > 0 ? div(marketCap, raw.ni) : null,
    netDebtToEbitda: null,
    altmanZ,
    altmanModel,
    piotroski: piotroskiOut.score,
    piotroskiPartial: piotroskiOut.partial,
  };
}

// ---------------------------------------------------------------------------
// Piotroski F-Score (0-9).
// Si faltan datos para >2 checks → score = null.
// Si faltan datos para 1-2 → score con flag partial=true (esos checks cuentan 0).
// ---------------------------------------------------------------------------
function computePiotroski(raw) {
  const p = raw.prev || {};
  const checks = []; // cada entrada: true | false | null (null = unknown)

  // 1. NetIncome > 0
  checks.push(raw.ni != null ? raw.ni > 0 : null);

  // 2. CFO > 0
  checks.push(raw.ocf != null ? raw.ocf > 0 : null);

  // 3. ROA(t) > ROA(t-1)
  const roaT = div(raw.ni, raw.assets);
  const roaP = div(p.ni, p.assets);
  checks.push(roaT != null && roaP != null ? roaT > roaP : null);

  // 4. CFO > NetIncome (calidad del earnings)
  checks.push(raw.ocf != null && raw.ni != null ? raw.ocf > raw.ni : null);

  // 5. LT debt ratio bajó YoY (ltd/assets)
  const ltdRatioT = div(raw.ltd, raw.assets);
  const ltdRatioP = div(p.ltd, p.assets);
  checks.push(ltdRatioT != null && ltdRatioP != null ? ltdRatioT < ltdRatioP : null);

  // 6. Current ratio subió YoY
  const crT = div(raw.curA, raw.curL);
  const crP = div(p.curA, p.curL);
  checks.push(crT != null && crP != null ? crT > crP : null);

  // 7. Shares NO incrementaron YoY (tolerancia +1%)
  if (raw.sharesQ4 != null && p.sharesQ4 != null && p.sharesQ4 > 0) {
    checks.push(raw.sharesQ4 <= p.sharesQ4 * 1.01);
  } else {
    checks.push(null);
  }

  // 8. Gross margin subió YoY
  const gmT = div(raw.gp, raw.rev);
  const gmP = div(p.gp, p.rev);
  checks.push(gmT != null && gmP != null ? gmT > gmP : null);

  // 9. Asset turnover subió YoY
  const atT = div(raw.rev, raw.assets);
  const atP = div(p.rev, p.assets);
  checks.push(atT != null && atP != null ? atT > atP : null);

  const unknowns = checks.filter((c) => c === null).length;
  if (unknowns > 2) return { score: null, partial: false };

  const score = checks.filter((c) => c === true).length;
  return { score, partial: unknowns > 0 };
}
