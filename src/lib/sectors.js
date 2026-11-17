// src/lib/sectors.js — Exposición sectorial contra el S&P 500 y reglas del mandato.
//
// Funciones puras. Los ETFs amplios se "abren" en sus sectores (look-through),
// así VOO no cuenta como un bloque sino como 11 sectores.

export const GICS = [
  "Technology", "Financials", "Healthcare", "Cons. Disc.", "Communication", "Industrials",
  "Cons. Staples", "Energy", "Utilities", "Real Estate", "Materials",
];
export const OTHER = "Otros";
export const CASH = "Liquidez";

// Pesos sectoriales APROXIMADOS del S&P 500. No salen de una fuente en vivo:
// son una referencia cargada a mano y hay que actualizarla (roadmap, Fase 2.3).
export const SPY_WEIGHTS_AS_OF = "aprox. 2025";
export const SPY_WEIGHTS = {
  Technology: 0.32, Financials: 0.14, "Cons. Disc.": 0.105, Communication: 0.095, Healthcare: 0.10,
  Industrials: 0.085, "Cons. Staples": 0.055, Energy: 0.03, Utilities: 0.025, "Real Estate": 0.022, Materials: 0.023,
};

// Composición aproximada del Nasdaq 100 para abrir QQQ.
const QQQ_WEIGHTS = {
  Technology: 0.51, Communication: 0.16, "Cons. Disc.": 0.13, "Cons. Staples": 0.05, Healthcare: 0.05,
  Industrials: 0.05, Utilities: 0.015, Materials: 0.015, Energy: 0.005, Financials: 0.005, "Real Estate": 0.01,
};

const BROAD_ETFS = { SPY: SPY_WEIGHTS, VOO: SPY_WEIGHTS, IVV: SPY_WEIGHTS, VTI: SPY_WEIGHTS, QQQ: QQQ_WEIGHTS };

export const SECTOR_ETFS = {
  XLK: "Technology", XLF: "Financials", XLV: "Healthcare", XLY: "Cons. Disc.", XLC: "Communication",
  XLI: "Industrials", XLP: "Cons. Staples", XLE: "Energy", XLU: "Utilities", XLRE: "Real Estate", XLB: "Materials",
};

const CASH_LIKE = ["SHY", "BIL", "SGOV", "CASH"];
// ETFs amplios que no son S&P 500 (mundo, emergentes): núcleo, pero sin look-through.
const OTHER_CORE = ["VT", "VXUS", "VWO", "VEA", "IWM"];

// Tramo del mandato al que pertenece un ticker.
export function sleeveOf(ticker) {
  if (CASH_LIKE.includes(ticker)) return "LIQUIDEZ";
  if (BROAD_ETFS[ticker] || OTHER_CORE.includes(ticker)) return "NUCLEO";
  if (SECTOR_ETFS[ticker]) return "TACTICO";
  return "SATELITE";
}

// Reparte el peso de una posición entre sectores.
function spread(ticker, sector) {
  if (CASH_LIKE.includes(ticker)) return { [CASH]: 1 };
  if (BROAD_ETFS[ticker]) return BROAD_ETFS[ticker];
  if (SECTOR_ETFS[ticker]) return { [SECTOR_ETFS[ticker]]: 1 };
  return { [GICS.includes(sector) ? sector : OTHER]: 1 };
}

// Exposición por sector de la cartera completa. `rows`: [{ ticker, weight, sector }].
export function sectorExposure(rows, cashWeight = 0) {
  const base = cashWeight > 0 ? { [CASH]: cashWeight } : {};
  return rows.reduce((acc, row) => {
    const parts = spread(row.ticker, row.sector);
    return Object.entries(parts).reduce((a, [sector, share]) => ({ ...a, [sector]: (a[sector] || 0) + row.weight * share }), acc);
  }, base);
}

// Peso de la cartera, peso del S&P 500 y diferencia activa, por sector.
export function activeWeights(exposure) {
  const sectors = [...GICS, ...Object.keys(exposure).filter((s) => !GICS.includes(s))];
  return sectors.map((sector) => {
    const port = exposure[sector] || 0;
    const bench = SPY_WEIGHTS[sector] || 0;
    return { sector, port, bench, active: port - bench };
  });
}

// Mandato (MANDATE.md): rangos por tramo y topes. `account` real o paper.
export const SLEEVE_RANGES = {
  NUCLEO: { label: "Núcleo estratégico", min: 0.35, max: 0.45 },
  TACTICO: { label: "Núcleo táctico", min: 0.10, max: 0.20 },
  SATELITE: { label: "Satélite", min: 0.25, max: 0.40 },
  LIQUIDEZ: { label: "Liquidez", min: 0.05, max: 0.10 },
};
const MAX_STOCK = { real: 0.15, paper: 0.25 };
const MAX_SECTOR = 0.35;

export function sleeveWeights(rows, cashWeight = 0) {
  const start = { NUCLEO: 0, TACTICO: 0, SATELITE: 0, LIQUIDEZ: cashWeight };
  return rows.reduce((acc, row) => {
    const sleeve = sleeveOf(row.ticker);
    return { ...acc, [sleeve]: acc[sleeve] + row.weight };
  }, start);
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;

// Lista de incumplimientos del mandato: [{ level: 'alerta' | 'aviso', text }].
export function mandateChecks(rows, cashWeight, account = "real") {
  if (!rows.length) return [];
  const sleeves = sleeveWeights(rows, cashWeight);
  const sleeveAlerts = Object.entries(SLEEVE_RANGES).flatMap(([key, range]) => {
    const w = sleeves[key];
    if (w > range.max + 0.005) return [{ level: "alerta", text: `${range.label} en ${pct(w)}: supera el máximo de ${pct(range.max)}` }];
    if (w < range.min - 0.005) return [{ level: "aviso", text: `${range.label} en ${pct(w)}: por debajo del mínimo de ${pct(range.min)}` }];
    return [];
  });
  const maxStock = MAX_STOCK[account] ?? MAX_STOCK.real;
  const stockAlerts = rows
    .filter((r) => sleeveOf(r.ticker) === "SATELITE" && r.weight > maxStock + 0.005)
    .map((r) => ({ level: "alerta", text: `${r.ticker} pesa ${pct(r.weight)}: el máximo por acción es ${pct(maxStock)}` }));
  const exposure = sectorExposure(rows, cashWeight);
  const sectorAlerts = GICS.filter((s) => (exposure[s] || 0) > MAX_SECTOR + 0.005)
    .map((s) => ({ level: "alerta", text: `${s} en ${pct(exposure[s])}: el máximo por sector es ${pct(MAX_SECTOR)}` }));
  return [...sleeveAlerts, ...stockAlerts, ...sectorAlerts];
}
