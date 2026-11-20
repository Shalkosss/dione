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
  // ---- Descripciones SIC de la SEC (submissions/CIK.json). Van primero porque
  //      su vocabulario confunde a las reglas genéricas de abajo ("Industrial
  //      Organic Chemicals" no es Industrials; "Natural Gas Distribution" no es Energy).
  [/medicinal chemicals|physical & biological research/i, GICS.HLTH],
  [/natural gas distribution|gas & other services combined|electric & other services|water supply|cogeneration|electric services/i, GICS.UTIL],
  [/chemical|plastics? (material|foam|product)|paints?,|concrete|cement|flat glass|glass container|(?<!retail-|wholesale-)lumber|wood product|coating, engraving|abrasive|gypsum/i, GICS.MAT],
  [/operative builders|residential bldg|retail-(?!grocery|drug|food|variety|convenience)|educational services|motor vehicles? &|motor vehicle parts|wholesale-motor vehicle|motor homes|carpets|sporting & athletic|household (appliance|furniture)|games, toys|jewelry|amusement|eating (and|&) drinking|eating places|personal services|footwear|apparel|knitting/i, GICS.DISC],
  [/retail-(grocery|drug|food|variety|convenience)|food preparations|grain mill|poultry|meat packing|sausages|dairy|bakery|sugar|canned|frozen|food and kindred|consumer products|soap, detergent|perfumes, cosmetic|cigarette|malt beverage|bottled|wholesale-groceries/i, GICS.STAP],
  [/wholesale-(drugs|medical)|offices & clinics|doctors of|medicine|health services|home health|nursing|hospital|laboratory analytical|laboratory apparatus|biological product|in vitro|ophthalmic|orthopedic|x-ray/i, GICS.HLTH],
  [/savings institution|national commercial bank|state commercial bank|investment advice|security brokers|finance services|personal credit|short-term business credit|title insurance|insurance agents/i, GICS.FIN],
  [/services-(computer|prepackaged|data processing)|computer (communication|storage|terminal|peripheral)|electronic (component|connector|computer)|wholesale-(electronic|computer)|printed circuit|optical instruments|calculating & accounting|photographic equip|instruments for meas|computer & office|communications equipment|telephone & telegraph apparatus/i, GICS.TECH],
  [/truck & bus bodies|truck trailers|electrical work|general bldg contractors|heavy construction|water, sewer|services-(business|management consulting|engineering|commercial|help supply|equipment rental|facilities|detective|consumer credit reporting|direct mail|photocopying)|wholesale-(hardware|misc durable|industrial|machinery|lumber)|air-cond|refrig|pumps|aircraft|ship & boat|railroad equipment|electric lighting|conveyors|patent owners|guided missiles|search, detection|electronic & other electrical|electrical industrial|refuse systems|switchgear|fabricated plate|gaskets|transformers/i, GICS.IND],
  [/telephone|radiotelephone|motion picture|television|newspapers|periodicals|books:/i, GICS.COMM],
  [/pipe ?lines|wholesale-petroleum|crude petroleum/i, GICS.ENRG],

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

// Empresas donde el SIC de la SEC contradice la clasificación GICS vigente
// (Visa y Mastercard figuran como "servicios", Alphabet y Meta como "software").
// Se actualiza a mano, igual que los pesos del S&P 500.
export const GICS_OVERRIDES = Object.freeze({
  V: GICS.FIN, MA: GICS.FIN, PYPL: GICS.FIN, FI: GICS.FIN, FIS: GICS.FIN, GPN: GICS.FIN, AXP: GICS.FIN,
  GOOGL: GICS.COMM, GOOG: GICS.COMM, META: GICS.COMM, NFLX: GICS.COMM, DIS: GICS.COMM,
  AMZN: GICS.DISC, TSLA: GICS.DISC,
  LRCX: GICS.TECH, KLAC: GICS.TECH,
  NUTX: GICS.HLTH, // hospitales; la SIC de EDGAR la deja en Industrials
});

// Sector GICS de un símbolo: override, después sector y después industria.
export function gicsFor(symbol, sector, industry = null) {
  return GICS_OVERRIDES[symbol] || toGicsL1(sector) || toGicsL1(industry) || null;
}
