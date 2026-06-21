// lib/scoring.js — Quality gate + pre-score fundamental para el shortlist.
//
// FILOSOFÍA: esto NO es el composite completo de FUNDAMENTAL_FRAMEWORK.md.
// Es un PRE-SCORE barato (0-100) cuyo único trabajo es rankear las candidatas
// que pasan el gate, para que DIONE corra /deep sobre el top y ahí sí aplique
// Beneish, Piotroski-9, Graham, 7 Powers, DCF, etc. Separar "screen barato" de
// "deep dive caro" es exactamente cómo opera un buy-side desk.

// ---------------------------------------------------------------------------
// QUALITY GATE — los 3 filtros duros de Tier 3 (UNIVERSE.md):
//   ROE > 10%, FCF positivo (TTM como proxy de "4Q+"), debt/equity < 2.
// Devuelve { pass, reasons } para poder explicar por qué algo quedó afuera.
// ---------------------------------------------------------------------------
export function qualityGate(f) {
  const reasons = [];
  if (f.roe == null || f.roe <= 0.10) reasons.push(`ROE ${fmtPct(f.roe)} ≤ 10%`);
  if (f.fcfPerShare == null || f.fcfPerShare <= 0) reasons.push('FCF TTM no positivo');
  if (f.debtToEquity == null || f.debtToEquity >= 2) reasons.push(`D/E ${fmt(f.debtToEquity)} ≥ 2`);
  // anti-fraude / anti-quiebra rápido si tenemos el score enriquecido.
  // Thresholds dependen del modelo: Z (manufacturera) <1.81 distress; Z" (non-manuf) <1.1 distress.
  if (f.altmanZ != null) {
    const dz = f.altmanModel === 'Z"' ? 1.1 : 1.81;
    if (f.altmanZ < dz) reasons.push(`Altman ${f.altmanModel ?? 'Z'} ${fmt(f.altmanZ)} < ${dz} (distress)`);
  }
  return { pass: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// PRE-SCORE 0-100 — calidad + value barato, solo con ratios TTM.
// Pesos pensados para small caps de calidad (no para deep value puro).
//   Calidad 50 · Rentabilidad/márgenes 25 · Value 15 · Solidez 10
// Bonus/penalty por Altman y Piotroski si están disponibles.
// ---------------------------------------------------------------------------
export function preScore(f) {
  let s = 0;

  // --- Calidad (50) ---
  s += band(f.roe,   [0.10, 0.15, 0.20, 0.30], [6, 12, 18, 22]);     // ROE TTM
  s += band(f.roic,  [0.08, 0.12, 0.18, 0.25], [4, 9, 14, 18]);      // ROIC TTM
  s += band(f.fcfYield, [0.02, 0.04, 0.06, 0.10], [3, 6, 8, 10]);    // FCF yield

  // --- Rentabilidad / márgenes (25) ---
  s += band(f.grossMargin, [0.25, 0.40, 0.55, 0.70], [3, 6, 9, 11]);
  s += band(f.netMargin,   [0.05, 0.10, 0.15, 0.22], [3, 6, 10, 14]);

  // --- Value (15) — P/E invertido, premiando barato pero no negativo ---
  if (f.pe != null && f.pe > 0) {
    if (f.pe < 12) s += 15;
    else if (f.pe < 18) s += 11;
    else if (f.pe < 25) s += 7;
    else if (f.pe < 35) s += 3;
  }

  // --- Solidez de balance (10) ---
  if (f.debtToEquity != null) {
    if (f.debtToEquity < 0.5) s += 6;
    else if (f.debtToEquity < 1) s += 4;
    else if (f.debtToEquity < 1.5) s += 2;
  }
  if (f.currentRatio != null && f.currentRatio >= 1.5) s += 4;
  else if (f.currentRatio != null && f.currentRatio >= 1) s += 2;

  // --- Enriquecimiento opcional ---
  if (f.altmanZ != null) {
    // thresholds por modelo: Z safe>4 / distress<2; Z" safe>2.6 / distress<1.1
    const safe = f.altmanModel === 'Z"' ? 2.6 : 4;
    const distress = f.altmanModel === 'Z"' ? 1.1 : 2;
    if (f.altmanZ > safe) s += 5;
    else if (f.altmanZ < distress) s -= 8;
  }
  if (f.piotroski != null) {
    if (f.piotroski >= 8) s += 8;       // "casi perfecto" — book quality muy fuerte
    else if (f.piotroski >= 7) s += 5;
    else if (f.piotroski <= 3) s -= 5;
  }

  // --- Operational inflection bonus (+5) ---
  // Empresas con margen expandiéndose y revenue growth lento históricamente
  // quedaban infrasoladas por Lynch-style scoring. Acá no hay penalty explícito
  // pero tampoco las premiábamos. Si el perfil grita "quality compounder + low
  // leverage + cash genuino + book quality limpio", sumamos +5.
  if (
    f.piotroski != null && f.piotroski >= 7 &&
    f.roe != null && f.roe >= 0.15 &&
    f.debtToEquity != null && f.debtToEquity < 0.5 &&
    f.fcfYield != null && f.fcfYield >= 0.05
  ) {
    s += 5;
  }

  return Math.max(0, Math.min(100, Math.round(s)));
}

// banda escalonada: thresholds asc, points asc (acumulativos por tramo alcanzado)
function band(v, thresholds, points) {
  if (v == null || !Number.isFinite(v)) return 0;
  let p = 0;
  for (let i = 0; i < thresholds.length; i++) if (v >= thresholds[i]) p = points[i];
  return p;
}

const fmt = (v) => (v == null ? 'n/a' : Number(v).toFixed(2));
const fmtPct = (v) => (v == null ? 'n/a' : (Number(v) * 100).toFixed(1) + '%');

export { fmt, fmtPct };
