import { describe, it, expect } from "vitest";
import { form4Filings, parseForm4, insiderSummary } from "../lib/form4.js";
import { scoreSmartMoney, analystDrift } from "../lib/smartMoney.js";
import { quoteFromChart } from "../lib/quote.js";

const tx = (code, shares, price, date = "2026-11-10", ad = code === "P" ? "A" : "D") => `
  <nonDerivativeTransaction>
    <securityTitle><value>Common Stock</value></securityTitle>
    <transactionDate><value>${date}</value></transactionDate>
    <transactionCoding><transactionFormType>4</transactionFormType><transactionCode>${code}</transactionCode><equitySwapInvolved>0</equitySwapInvolved></transactionCoding>
    <transactionAmounts>
      <transactionShares><value>${shares}</value></transactionShares>
      <transactionPricePerShare><value>${price}</value></transactionPricePerShare>
      <transactionAcquiredDisposedCode><value>${ad}</value></transactionAcquiredDisposedCode>
    </transactionAmounts>
  </nonDerivativeTransaction>`;

const doc = (owner, title, txs, issuer = 100) => `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerCik>${String(issuer).padStart(10, "0")}</issuerCik><issuerName>Acme</issuerName></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>1</rptOwnerCik><rptOwnerName>${owner}</rptOwnerName></reportingOwnerId>
    <reportingOwnerRelationship><isDirector>0</isDirector><isOfficer>1</isOfficer><officerTitle>${title}</officerTitle></reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>${txs.join("")}</nonDerivativeTable>
  <derivativeTable><derivativeTransaction><transactionCoding><transactionCode>M</transactionCode></transactionCoding></derivativeTransaction></derivativeTable>
</ownershipDocument>`;

describe("form4Filings", () => {
  const recent = {
    form: ["4", "8-K", "4/A", "4", "10-Q"],
    filingDate: ["2026-11-12", "2026-11-11", "2026-10-01", "2026-05-01", "2026-11-01"],
    accessionNumber: ["0001-26-000001", "x", "0001-26-000002", "0001-26-000003", "y"],
    primaryDocument: ["xslF345X05/wk-form4_1.xml", "a.htm", "doc2.xml", "old.xml", "q.htm"],
  };

  it("toma los Form 4 desde la fecha y arma la URL del XML crudo", () => {
    const list = form4Filings(recent, 320193, "2026-08-19");
    expect(list.map((f) => f.accession)).toEqual(["0001-26-000001", "0001-26-000002"]);
    expect(list[0].url).toBe("https://www.sec.gov/Archives/edgar/data/320193/000126000001/wk-form4_1.xml");
  });

  it("respeta el máximo y tolera datos vacíos", () => {
    expect(form4Filings(recent, 1, "2026-01-01", 1)).toHaveLength(1);
    expect(form4Filings(null, 1, "2026-01-01")).toEqual([]);
  });
});

describe("parseForm4", () => {
  it("lee dueño, cargo y transacciones no derivadas", () => {
    const f = parseForm4(doc("Doe Jane", "Chief Executive Officer", [tx("P", "1,000", "50.5"), tx("A", 200, 0)]));
    expect(f.owner).toBe("Doe Jane");
    expect(f.isOfficer).toBe(true);
    expect(f.isDirector).toBe(false);
    expect(f.transactions).toEqual([
      { date: "2026-11-10", code: "P", shares: 1000, price: 50.5, acquired: true },
      { date: "2026-11-10", code: "A", shares: 200, price: 0, acquired: false },
    ]);
  });

  it("devuelve null si no es un Form 4", () => {
    expect(parseForm4("<html>nope</html>")).toBeNull();
    expect(parseForm4(undefined)).toBeNull();
  });
});

describe("insiderSummary", () => {
  it("cuenta solo compras y ventas en mercado abierto", () => {
    const forms = [
      parseForm4(doc("CEO A", "CEO", [tx("P", 20000, 50, "2026-11-10")])),       // compra $1M
      parseForm4(doc("Dir B", "", [tx("P", 1000, 50, "2026-11-01")])),           // compra $50K
      parseForm4(doc("CFO C", "Chief Financial Officer", [tx("S", 2000, 50, "2026-10-01"), tx("M", 9999, 10), tx("F", 500, 50)])),
    ];
    const s = insiderSummary(forms, "2026-11-17");
    expect(s.buyUSD).toBe(1_050_000);
    expect(s.sellUSD).toBe(100_000);
    expect(s.netUSD).toBe(950_000);
    expect(s.uniqueInsiders).toBe(2);
    expect(s.topExecBuy).toBe(1_000_000);
    expect(s.lastTransactionDays).toBe(7);
    expect(s.transactions).toBe(3);
  });

  it("sin transacciones de mercado da la señal vacía", () => {
    const s = insiderSummary([parseForm4(doc("X", "CEO", [tx("A", 100, 0)])), null], "2026-11-17");
    expect(s).toMatchObject({ netUSD: 0, uniqueInsiders: 0, topExecBuy: 0, lastTransactionDays: null });
  });

  it("descarta los Form 4 donde la empresa es dueña de otro emisor", () => {
    const forms = [
      parseForm4(doc("Berkshire Hathaway", "", [tx("P", 1_000_000, 60)], 797468)), // compra de OXY
      parseForm4(doc("Director", "", [tx("S", 100, 500)], 1067983)),
    ];
    expect(forms[0].issuerCik).toBe(797468);
    const s = insiderSummary(forms, "2026-11-17", 1067983);
    expect(s.buyUSD).toBe(0);
    expect(s.sellUSD).toBe(50_000);
  });

  it("una 4/A o un grupo de dueños que repite la operación no la duplica", () => {
    const original = parseForm4(doc("CFO C", "CFO", [tx("S", 20000, 50)]));
    const amended = parseForm4(doc("CFO C", "CFO", [tx("S", 20000, 50)]));
    expect(insiderSummary([original, amended], "2026-11-17").sellUSD).toBe(1_000_000);
    const fund = [parseForm4(doc("Fund LP", "", [tx("P", 10000, 50)])), parseForm4(doc("Fund GP LLC", "", [tx("P", 10000, 50)])), parseForm4(doc("Manager", "", [tx("P", 10000, 50)]))];
    const s = insiderSummary(fund, "2026-11-17");
    expect(s.buyUSD).toBe(500_000);
    expect(s.uniqueInsiders).toBe(1);
  });

  it("con `since` ignora operaciones viejas que trae una 4/A reciente", () => {
    const f = parseForm4(doc("A", "", [tx("P", 1000, 50, "2026-03-01"), tx("P", 100, 50, "2026-11-01")]));
    expect(insiderSummary([f], "2026-11-17", null, "2026-08-19").buyUSD).toBe(5_000);
  });

  it("una compra de ejecutivo bajo $500K no cuenta como calidad", () => {
    expect(insiderSummary([parseForm4(doc("A", "CEO", [tx("P", 100, 50)]))], "2026-11-17").topExecBuy).toBe(0);
  });
});

describe("scoreSmartMoney", () => {
  it("sin analistas el drift es 0 y el resto puntúa igual", () => {
    const r = scoreSmartMoney({ netUSD: 2_000_000, uniqueInsiders: 3, topExecBuy: 1_500_000, lastTransactionDays: 10 }, null);
    expect(r.breakdown).toEqual({ cluster: 30, drift: 0, execQ: 12, recency: 10 });
    expect(r.score).toBe(52);
    expect(r.analyst).toBeNull();
  });

  it("sin insiders ni analistas da 0", () => {
    expect(scoreSmartMoney(null, null).score).toBe(0);
  });

  it("analystDrift compara los dos últimos meses", () => {
    const d = analystDrift([
      { period: "2026-11-01", strongBuy: 5, buy: 10, sell: 1, strongSell: 0 },
      { period: "2026-10-01", strongBuy: 4, buy: 9, sell: 2, strongSell: 0 },
    ]);
    expect(d).toEqual({ upgradesMinusDowngrades: 3, latestTrendDate: "2026-11-01" });
    expect(scoreSmartMoney(null, d).breakdown.drift).toBe(9);
  });
});

describe("quoteFromChart", () => {
  const chart = {
    chart: { result: [{
      meta: { regularMarketPrice: 110, chartPreviousClose: 100, regularMarketDayHigh: 112, regularMarketDayLow: 105, regularMarketTime: 1763400000, currency: "USD", fullExchangeName: "NasdaqGS", longName: "Acme Inc." },
      timestamp: [1],
      indicators: { quote: [{ open: [106], high: [112], low: [105], close: [110] }] },
    }] },
  };

  it("usa el precio de mercado y el cierre de la sesión anterior", () => {
    const q = quoteFromChart(chart, "ACME");
    expect(q).toMatchObject({ ticker: "ACME", price: 110, prevClose: 100, change: 10, high: 112, low: 105, open: 106, name: "Acme Inc.", exchange: "NasdaqGS", source: "Yahoo" });
    expect(q.changePct).toBeCloseTo(0.1);
    expect(q.timestamp).toBe(1763400000000);
  });

  it("devuelve null si Yahoo no trae resultado", () => {
    expect(quoteFromChart({ chart: { result: null } }, "X")).toBeNull();
    expect(quoteFromChart(null, "X")).toBeNull();
  });
});
