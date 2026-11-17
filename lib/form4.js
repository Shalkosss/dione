// lib/form4.js — Insiders desde el Form 4 de SEC EDGAR (Fase 3, ítem 11). Puro.
//
// Reemplaza /stock/insider-transactions de Finnhub. Diferencia deliberada:
// solo cuentan las compras y ventas en mercado abierto (códigos P y S). Las
// asignaciones (A), ejercicios de opciones (M) y retenciones de impuestos (F)
// no dicen nada sobre lo que el insider piensa de la acción.
//
//   form4Filings(recent, cik, since, max)   lista de Form 4 a bajar
//   parseForm4(xml)                         dueño y transacciones de un Form 4
//   insiderSummary(forms, today)            señal agregada para smartMoney.js

const ARCHIVES = 'https://www.sec.gov/Archives/edgar/data';
const OPEN_MARKET = new Set(['P', 'S']);
const EXEC_RE = /chief executive|chief financial|\bceo\b|\bcfo\b/i;

// Form 4 (y enmiendas 4/A) presentados desde `since` (YYYY-MM-DD), del más
// nuevo al más viejo, con la URL del XML. EDGAR guarda como primaryDocument la
// versión renderizada ("xslF345X05/archivo.xml"); el XML crudo es el mismo
// archivo sin esa carpeta.
export function form4Filings(recent, cik, since, max = 12) {
  if (!recent?.form) return [];
  const out = [];
  for (let i = 0; i < recent.form.length && out.length < max; i++) {
    const form = recent.form[i];
    if (form !== '4' && form !== '4/A') continue;
    const filed = recent.filingDate?.[i];
    if (!filed || filed < since) continue;
    const accession = recent.accessionNumber?.[i];
    const doc = String(recent.primaryDocument?.[i] || '').replace(/^xsl[^/]*\//, '');
    if (!accession || !doc.endsWith('.xml')) continue;
    out.push({ filed, accession, url: `${ARCHIVES}/${Number(cik)}/${accession.replace(/-/g, '')}/${doc}` });
  }
  return out;
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`));
  return m ? m[1] : null;
};
// Los campos numéricos vienen envueltos: <transactionShares><value>100</value></transactionShares>.
const valueOf = (xml, name) => {
  const inner = tag(xml, name);
  if (inner == null) return null;
  const v = tag(inner, 'value');
  return (v ?? inner).trim();
};
const flag = (xml, name) => /^(1|true)$/i.test(tag(xml, name) || '');
const num = (s) => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Un Form 4 → { issuerCik, owner, title, isOfficer, isDirector, transactions }.
// issuerCik importa: las presentaciones de una empresa también incluyen los
// Form 4 que ELLA firma como dueña de otra (Berkshire comprando OXY).
// Solo la tabla no derivada (acciones comunes); las opciones van en la otra.
export function parseForm4(xml) {
  if (typeof xml !== 'string' || !xml.includes('<ownershipDocument')) return null;
  const owner = tag(xml, 'rptOwnerName');
  const transactions = [...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)]
    .map(([, t]) => ({
      date: (valueOf(t, 'transactionDate') || '').slice(0, 10) || null,
      code: tag(tag(t, 'transactionCoding') || '', 'transactionCode'),
      shares: num(valueOf(t, 'transactionShares')),
      price: num(valueOf(t, 'transactionPricePerShare')),
      acquired: valueOf(t, 'transactionAcquiredDisposedCode') === 'A',
    }))
    .filter((t) => t.code && t.shares != null);
  const issuerCik = num(tag(tag(xml, 'issuer') || '', 'issuerCik'));
  return {
    issuerCik,
    owner: owner ? owner.trim() : null,
    title: (tag(xml, 'officerTitle') || '').trim() || null,
    isOfficer: flag(xml, 'isOfficer'),
    isDirector: flag(xml, 'isDirector'),
    transactions,
  };
}

const EMPTY = Object.freeze({ netUSD: 0, buyUSD: 0, sellUSD: 0, uniqueInsiders: 0, topExecBuy: 0, lastTransactionDays: null, transactions: 0 });

// Agrega los Form 4 de una empresa con la misma forma que usaba Finnhub, para
// que el puntaje de smartMoney.js no cambie de escala.
// Con `issuerCik`, descarta los Form 4 de otros emisores.
export function insiderSummary(forms, today = new Date().toISOString(), issuerCik = null) {
  const now = new Date(`${String(today).slice(0, 10)}T00:00:00Z`).getTime();
  let buyUSD = 0, sellUSD = 0, topExecBuy = 0, last = 0, count = 0;
  const insiders = new Set();
  for (const f of forms || []) {
    if (!f) continue;
    if (issuerCik != null && f.issuerCik != null && f.issuerCik !== Number(issuerCik)) continue;
    const isExec = EXEC_RE.test(f.title || '');
    let execBuy = 0;
    for (const t of f.transactions) {
      if (!OPEN_MARKET.has(t.code) || !(t.price > 0)) continue;
      const usd = t.shares * t.price;
      // uniqueInsiders cuenta compradores: el "cluster" es varios comprando a la vez.
      if (t.code === 'P') { buyUSD += usd; execBuy += usd; if (f.owner) insiders.add(f.owner); } else sellUSD += usd;
      count++;
      const ts = t.date ? new Date(`${t.date}T00:00:00Z`).getTime() : 0;
      if (ts > last) last = ts;
    }
    if (isExec && execBuy > topExecBuy) topExecBuy = execBuy;
  }
  if (!count) return { ...EMPTY };
  return {
    netUSD: buyUSD - sellUSD,
    buyUSD,
    sellUSD,
    uniqueInsiders: insiders.size,
    topExecBuy: topExecBuy > 500_000 ? topExecBuy : 0,
    lastTransactionDays: last ? Math.max(0, Math.round((now - last) / 86400000)) : null,
    transactions: count,
  };
}
