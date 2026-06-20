// lib/gics.js — Mapeo de strings heterogéneos de sector a GICS L1.
//
// Inputs reales que llegan:
//   Finnhub finnhubIndustry: "Pharmaceuticals", "Banks", "Software", etc.
//   Finnhub gicsSector:      ya viene en GICS L1 cuando está presente (mejor caso).
//   SEC sicDescription:      "PHARMACEUTICAL PREPARATIONS", "ELECTRONIC COMPUTERS", etc.
//                             (caps, granularidad SIC, no GICS).
//
// Output: uno de los 11 sectores GICS L1.
//   Communication Services, Consumer Discretionary, Consumer Staples,
//   Energy, Financials, Health Care, Industrials, Information Technology,
//   Materials, Real Estate, Utilities

const GICS = {
  COMM: 'Communication Services',
  DISC: 'Consumer Discretionary',
  STAP: 'Consumer Staples',
  ENRG: 'Energy',
  FIN:  'Financials',
  HLTH: 'Health Care',
  IND:  'Industrials',
  TECH: 'Information Technology',
  MAT:  'Materials',
  REIT: 'Real Estate',
  UTIL: 'Utilities',
};

// Reglas en orden: primer match gana. Substrings case-insensitive sobre el input.
// Construir orden de más específico a más general para evitar mis-matches
// (ej. "real estate investment trust" antes que "investment").
const RULES = [
  // ---- Communication Services
  [/telecom|wireless|broadcast|publishing|interactive media|cable|advertis/i, GICS.COMM],
  [/media|entertainment|gaming|video|music|social/i, GICS.COMM],

  // ---- Consumer Discretionary
  [/auto|automobile|automotive|tire|leisure|apparel|footwear|luxury|hotel|restaurant|retail trade|specialty retail|consumer durables|household durables|textile|home furnish|recreation/i, GICS.DISC],

  // ---- Consumer Staples
  [/beverage|tobacco|food product|food retail|household product|personal product|grocer|supermarket|drug retail|consumer staples/i, GICS.STAP],

  // ---- Energy
  [/oil|gas|petroleum|pipeline|coal|fossil|drilling|refin|energy equipment|exploration/i, GICS.ENRG],

  // ---- Financials
  [/bank|insurance|capital markets|asset manag|securities|broker|investment manag|reinsur|consumer financ|mortgage|diversified financ|thrift|saving institution|financial service/i, GICS.FIN],

  // ---- Health Care
  [/pharmac|biotech|life science|medical|health care|hospital|managed care|drug|surgical|dental|diagnostic|therapeutic|clinical/i, GICS.HLTH],

  // ---- Information Technology (antes que "industrial" porque "electronic" puede confundir)
  [/software|semiconductor|IT services|technology hardware|electronic computers|computer (program|service|peripheral)|internet software|data process|cloud/i, GICS.TECH],

  // ---- Industrials
  [/aerospace|defense|airline|transport|logistic|machinery|construction|engineering|industrial|commercial service|professional service|trucking|railroad|marine|courier|building product/i, GICS.IND],

  // ---- Materials
  [/chemical|metal|mining|paper|forest product|container|packaging|steel|aluminum|gold|copper|fertiliz|construction material/i, GICS.MAT],

  // ---- Real Estate
  [/real estate|REIT|reit$|property|land subdivid/i, GICS.REIT],

  // ---- Utilities
  [/utilit|electric service|water service|gas distribution|power/i, GICS.UTIL],

  // ---- Genéricos finales (más amplios) — fallback
  [/financ/i, GICS.FIN],
  [/technolog/i, GICS.TECH],
  [/industr/i, GICS.IND],
];

const _cache = new Map();

// Recibe el string crudo (Finnhub industry, SEC sicDescription, o lo que sea).
// Devuelve uno de los 11 GICS L1 o null si no logra mapear.
export function toGicsL1(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.toLowerCase().trim();
  if (!key) return null;
  if (_cache.has(key)) return _cache.get(key);

  // Match exacto contra los 11 nombres oficiales (cuando Finnhub gicsSector ya lo da)
  for (const v of Object.values(GICS)) {
    if (key === v.toLowerCase()) {
      _cache.set(key, v);
      return v;
    }
  }

  for (const [regex, gics] of RULES) {
    if (regex.test(raw)) {
      _cache.set(key, gics);
      return gics;
    }
  }

  _cache.set(key, null);
  return null;
}

export const GICS_SECTORS = Object.freeze(Object.values(GICS));
