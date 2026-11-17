// lib/companyFacts.js — Fundamentales de un emisor desde su companyfacts de
// EDGAR, en cualquier taxonomía (us-gaap o ifrs-full) y moneda. Puro.
//
// Para qué: los frames de EDGAR solo existen para us-gaap y los leemos en USD.
// Quedan afuera los emisores extranjeros con IFRS (NU, TSM, Sony) y los que
// usan us-gaap en otra moneda (ASML en euros, MUFG en yenes). companyfacts
// trae todo, una llamada por empresa.
//
// Salida con la misma forma que fetchRawFactsByCik (edgar.js) para reusar
// computeMetrics, más { currency, taxonomy, fyEnd }. Los montos quedan en la
// moneda del emisor: los ratios (ROE, márgenes, D/E) no dependen de ella; lo
// que depende de la capitalización (FCF yield, P/E) no se calcula.

const ANNUAL_FORMS = /^(10-K|20-F|40-F)(\/A)?$/;
const DAY = 86400000;

const CONCEPTS = {
  'us-gaap': {
    ni: ['NetIncomeLoss', 'ProfitLoss'],
    rev: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
    gp: ['GrossProfit'],
    oi: ['OperatingIncomeLoss'],
    ocf: ['NetCashProvidedByUsedInOperatingActivities'],
    capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
    eq: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    assets: ['Assets'],
    liab: ['Liabilities'],
    curA: ['AssetsCurrent'],
    curL: ['LiabilitiesCurrent'],
    re: ['RetainedEarningsAccumulatedDeficit'],
    ltd: ['LongTermDebtNoncurrent', 'LongTermDebt', 'NotesPayableNoncurrent', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermNotesPayable', 'SeniorLongTermNotes', 'ConvertibleNotesPayable', 'OtherLongTermDebtNoncurrent'],
    std: ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings', 'NotesPayableCurrent'],
  },
  'ifrs-full': {
    ni: ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
    rev: ['Revenue', 'RevenueFromContractsWithCustomers'],
    gp: ['GrossProfit'],
    oi: ['ProfitLossFromOperatingActivities'],
    ocf: ['CashFlowsFromUsedInOperatingActivities', 'CashFlowsFromUsedInOperatingActivitiesContinuingOperations'],
    capex: [
      'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities', 'PurchaseOfPropertyPlantAndEquipment',
      'PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets',
      'PurchaseOfPropertyPlantAndEquipmentAndIntangibleAssets',
    ],
    eq: ['EquityAttributableToOwnersOfParent', 'Equity'],
    assets: ['Assets'],
    liab: ['Liabilities'],
    curA: ['CurrentAssets'],
    curL: ['CurrentLiabilities'],
    re: ['RetainedEarnings'],
    ltd: ['NoncurrentPortionOfNoncurrentBorrowings', 'LongtermBorrowings', 'NoncurrentBorrowings'],
    std: ['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings', 'ShorttermBorrowings', 'CurrentPortionOfNoncurrentBorrowings', 'CurrentBorrowings'],
  },
};
const FLOWS = new Set(['ni', 'rev', 'gp', 'oi', 'ocf', 'capex']);

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;
const isAnnualFlow = (e) => e.start && days(e.start, e.end) >= 330 && days(e.start, e.end) <= 400;

// Hechos anuales de un concepto en una moneda: [{ end, val, filed }].
function annual(facts, concept, unit, flow) {
  const list = facts?.[concept]?.units?.[unit] || [];
  return list.filter((e) => ANNUAL_FORMS.test(e.form || '') && e.end && (flow ? isAnnualFlow(e) : !e.start));
}

// Valor con fecha de cierre `end` (el último presentado, por si se reexpresó).
function valueAt(facts, names, unit, end, flow) {
  for (const name of names) {
    const hits = annual(facts, name, unit, flow).filter((e) => e.end === end);
    if (hits.length) return hits.sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0].val;
  }
  return null;
}

// Taxonomía, moneda y cierres anuales a usar: la combinación con el resultado
// anual más reciente.
function pickBasis(json) {
  let best = null;
  for (const taxonomy of Object.keys(CONCEPTS)) {
    const facts = json?.facts?.[taxonomy];
    if (!facts) continue;
    for (const name of CONCEPTS[taxonomy].ni) {
      for (const unit of Object.keys(facts[name]?.units || {})) {
        const ends = [...new Set(annual(facts, name, unit, true).map((e) => e.end))].sort();
        if (!ends.length) continue;
        // Más reciente gana; si empatan (una conversión a USD de conveniencia),
        // gana la moneda con más años: la otra suele traer un solo ejercicio.
        const better = !best || ends.at(-1) > best.ends.at(-1) || (ends.at(-1) === best.ends.at(-1) && ends.length > best.ends.length);
        if (better) best = { taxonomy, unit, ends };
      }
    }
  }
  return best;
}

function bundle(facts, names, unit, end) {
  const out = {};
  for (const [key, list] of Object.entries(names)) out[key] = valueAt(facts, list, unit, end, FLOWS.has(key));
  return out;
}

// companyfacts JSON → raw para computeMetrics, o null si no hay anuales.
// `today` marca como viejo (stale) un último cierre de hace más de 18 meses.
export function factsToRaw(json, today = new Date().toISOString()) {
  const basis = pickBasis(json);
  if (!basis) return null;
  const facts = json.facts[basis.taxonomy];
  const names = CONCEPTS[basis.taxonomy];
  const fyEnd = basis.ends.at(-1);
  // Cierres de todos los nombres de resultado: si la empresa cambió de concepto
  // entre años, el año previo igual aparece.
  const allEnds = [...new Set(names.ni.flatMap((n) => annual(facts, n, basis.unit, true).map((e) => e.end)))].sort();
  const prevEnd = [...allEnds].reverse().find((e) => days(e, fyEnd) >= 300 && days(e, fyEnd) <= 430) ?? null;
  const cur = bundle(facts, names, basis.unit, fyEnd);
  if (cur.ni == null && cur.eq == null) return null;
  // IFRS informa la compra de activo fijo como salida positiva; algunos la
  // informan negativa. computeMetrics espera capex positivo.
  if (cur.capex != null) cur.capex = Math.abs(cur.capex);
  const prev = prevEnd ? bundle(facts, names, basis.unit, prevEnd) : {};
  if (prev.capex != null) prev.capex = Math.abs(prev.capex);
  return {
    ...cur,
    sharesQ4: null,
    prev: { ni: prev.ni ?? null, rev: prev.rev ?? null, gp: prev.gp ?? null, ocf: prev.ocf ?? null, assets: prev.assets ?? null, liab: prev.liab ?? null, curA: prev.curA ?? null, curL: prev.curL ?? null, ltd: prev.ltd ?? null, sharesQ4: null },
    currency: basis.unit,
    taxonomy: basis.taxonomy,
    fyEnd,
    stale: days(fyEnd, today) > 550,
  };
}
