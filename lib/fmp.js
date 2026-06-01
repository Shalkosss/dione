// lib/fmp.js — Cliente Financial Modeling Prep para el screener Tier-3 de DIONE.
//
// Usa los endpoints v3 (estables, bien documentados). Si migrás a "stable",
// solo cambian las rutas base; la forma de los objetos es casi idéntica.
//
// IMPORTANTE sobre nombres de campos: FMP a veces renombra claves entre
// versiones (debtEquityRatioTTM vs debtToEquityTTM, etc). El código abajo es
// DEFENSIVO: prueba varios nombres. Aun así, la primera vez logueá una
// respuesta cruda (ver README, paso 6) y confirmá las claves de TU plan.

const BASE = 'https://financialmodelingprep.com/api/v3';
const KEY = process.env.FMP_API_KEY;

if (!KEY && process.env.NODE_ENV !== 'test') {
  console.warn('[fmp] FMP_API_KEY no está seteada en env.');
}

// --- util: primer valor numérico finito de una lista de posibles claves ---
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

// --- util: fetch con timeout + 1 retry suave (no reintenta 401/403/429) ---
async function getJSON(url, { timeoutMs = 8000, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) throw new Error('RATE_LIMIT'); // no reintentar a ciegas
      if (res.status === 401 || res.status === 403) throw new Error('AUTH_' + res.status);
      if (!res.ok) throw new Error('HTTP_' + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      if (attempt === retries || /RATE_LIMIT|AUTH_/.test(e.message)) throw e;
      await sleep(400 * (attempt + 1));
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- concurrency limiter sin dependencias (reemplaza p-limit) ---
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); }
      catch (e) { out[idx] = { __error: e.message }; }
    }
  });
  await Promise.all(workers);
  return out;
}

// ============================================================================
// 1) UNIVERSO — filtros DUROS de UNIVERSE.md aplicados server-side en FMP.
//    cap $300M–$2B (Tier 3), precio > $3, volumen suficiente, US listed,
//    activo. Devuelve el universo crudo en 1 sola llamada (hasta `limit`).
// ============================================================================
export async function fetchUniverse({
  capMin = 300_000_000,
  capMax = 2_000_000_000,
  priceMin = 3,
  volumeMin = 100_000,          // luego refinamos a $1M/día con price*vol
  exchanges = 'NYSE,NASDAQ,AMEX',
  limit = 3000,
} = {}) {
  const url =
    `${BASE}/stock-screener?marketCapMoreThan=${capMin}` +
    `&marketCapLowerThan=${capMax}` +
    `&priceMoreThan=${priceMin}` +
    `&volumeMoreThan=${volumeMin}` +
    `&exchange=${exchanges}` +
    `&isActivelyTrading=true` +
    `&isEtf=false&isFund=false` +
    `&limit=${limit}&apikey=${KEY}`;

  const rows = await getJSON(url, { timeoutMs: 12000 });
  if (!Array.isArray(rows)) return [];

  return rows
    // filtro duro extra: liquidez en USD/día > $1M (UNIVERSE.md)
    .filter((r) => (r.price || 0) * (r.volume || 0) >= 1_000_000)
    .map((r) => ({
      symbol: r.symbol,
      name: r.companyName,
      sector: r.sector || null,
      industry: r.industry || null,
      marketCap: r.marketCap || null,
      price: r.price || null,
      beta: r.beta ?? null,
      exchange: r.exchangeShortName || r.exchange || null,
      country: r.country || null,
    }));
}

// ============================================================================
// 2) FUNDAMENTALES por ticker — lo barato y suficiente para el quality gate
//    y el pre-score. 2 llamadas/ticker (ratios-ttm + key-metrics-ttm).
//    Beneish, Piotroski-9 y Graham-10yr quedan para /deep (no se computan acá).
// ============================================================================
export async function fetchFundamentals(symbol) {
  const [ratiosArr, kmArr] = await Promise.all([
    getJSON(`${BASE}/ratios-ttm/${symbol}?apikey=${KEY}`).catch(() => null),
    getJSON(`${BASE}/key-metrics-ttm/${symbol}?apikey=${KEY}`).catch(() => null),
  ]);

  const r = Array.isArray(ratiosArr) ? ratiosArr[0] : ratiosArr;
  const km = Array.isArray(kmArr) ? kmArr[0] : kmArr;
  if (!r && !km) return null;

  return {
    symbol,
    roe:            pick(r || {}, 'returnOnEquityTTM'),
    debtToEquity:   pick(r || {}, 'debtEquityRatioTTM', 'debtToEquityTTM'),
    currentRatio:   pick(r || {}, 'currentRatioTTM'),
    grossMargin:    pick(r || {}, 'grossProfitMarginTTM'),
    netMargin:      pick(r || {}, 'netProfitMarginTTM'),
    opMargin:       pick(r || {}, 'operatingProfitMarginTTM'),
    fcfPerShare:    pick(r || {}, 'freeCashFlowPerShareTTM'),
    pe:             pick(r || {}, 'priceEarningsRatioTTM', 'peRatioTTM'),
    roic:           pick(km || {}, 'roicTTM', 'returnOnInvestedCapitalTTM'),
    fcfYield:       pick(km || {}, 'freeCashFlowYieldTTM'),
    netDebtToEbitda:pick(km || {}, 'netDebtToEBITDATTM'),
  };
}

// Enriquecimiento OPCIONAL: Altman Z + Piotroski en 1 llamada.
// FMP expone un "financial score". VERIFICÁ la ruta exacta de tu plan;
// dejo v4 como intento y devuelvo null si falla (no rompe el pipeline).
export async function fetchScore(symbol) {
  try {
    const arr = await getJSON(
      `https://financialmodelingprep.com/api/v4/score?symbol=${symbol}&apikey=${KEY}`
    );
    const s = Array.isArray(arr) ? arr[0] : arr;
    if (!s) return null;
    return {
      altmanZ:    pick(s, 'altmanZScore', 'altmanZ'),
      piotroski:  pick(s, 'piotroskiScore'),
    };
  } catch {
    return null; // no disponible en tu tier → se computa en /deep
  }
}

export { mapLimit, sleep };
