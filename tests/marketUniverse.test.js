import { describe, it, expect } from "vitest";
import { isCommonTicker, listedTickers, waitlistReason, universeRow, universeStats, queryUniverse, MIN_CAP } from "../lib/marketUniverse.js";
import { parseSpark } from "../lib/yahooSpark.js";
import { FUND_RE } from "../lib/universeRefresh.js";

describe("isCommonTicker", () => {
  it("acepta acciones comunes y clases con guion", () => {
    for (const t of ["AAPL", "BRK-B", "BF-A", "F", "GOOGL", "DUOL"]) expect(isCommonTicker(t, "NYSE")).toBe(true);
  });
  it("descarta preferentes, warrants, unidades y derechos", () => {
    expect(isCommonTicker("JPM-PC", "NYSE")).toBe(false);
    expect(isCommonTicker("XYZ-WT", "NYSE")).toBe(false);
    expect(isCommonTicker("XYZ-U", "NYSE")).toBe(false);
    expect(isCommonTicker("ABCDW", "Nasdaq")).toBe(false);
    expect(isCommonTicker("ABCDU", "Nasdaq")).toBe(false);
    expect(isCommonTicker("ABCDR", "Nasdaq")).toBe(false);
    expect(isCommonTicker("", "Nasdaq")).toBe(false);
  });
});

describe("listedTickers", () => {
  const sec = {
    fields: ["cik", "name", "ticker", "exchange"],
    data: [
      [1652044, "Alphabet Inc.", "GOOG", "Nasdaq"],
      [1652044, "Alphabet Inc.", "GOOGL", "Nasdaq"],
      [1067983, "Berkshire", "BRK-B", "NYSE"],
      [1067983, "Berkshire", "BRK-A", "NYSE"],
      [19617, "JPMorgan", "JPM", "NYSE"],
      [19617, "JPMorgan", "JPM-PC", "NYSE"],
      [999, "Otc Co", "OTCX", "OTC"],
      [998, "Sin bolsa", "NOEX", null],
    ],
  };
  it("uno por CIK, solo NYSE y Nasdaq, con preferencia por la lista dada", () => {
    const list = listedTickers(sec, { preferred: ["GOOGL", "BRK-B"] });
    expect(list.map((l) => l.ticker).sort()).toEqual(["BRK-B", "GOOGL", "JPM"]);
    expect(list.find((l) => l.ticker === "JPM").exchange).toBe("NYSE");
  });
  it("sin preferencia toma el primero sin guion", () => {
    const list = listedTickers(sec);
    expect(list.find((l) => l.cik === 1652044).ticker).toBe("GOOG");
    expect(listedTickers(null)).toEqual([]);
  });
});

describe("waitlistReason", () => {
  it("una sola regla y por poco", () => {
    expect(waitlistReason({ roe: 0.08 }, { pass: false, reasons: ["ROE 8.0% ≤ 10%"] })).toBe("ROE cerca de 10%");
    expect(waitlistReason({ roe: 0.02 }, { pass: false, reasons: ["ROE 2.0% ≤ 10%"] })).toBeNull();
    expect(waitlistReason({ debtToEquity: 2.3 }, { pass: false, reasons: ["D/E 2.30 ≥ 2"] })).toBe("D/E cerca de 2");
    expect(waitlistReason({ debtToEquityMax: 2.2, debtUntagged: true }, { pass: false, reasons: ["D/E 2.20 ≥ 2 (techo)"] })).toBe("D/E cerca de 2");
    expect(waitlistReason({ opMargin: 0.1, fcfPerShare: -5 }, { pass: false, reasons: ["FCF TTM no positivo"] })).toMatch(/FCF/);
    expect(waitlistReason({ opMargin: 0.1, fcfPerShare: null }, { pass: false, reasons: ["FCF sin dato"] })).toBeNull();
  });
  it("dos reglas, Altman o gate aprobado no son lista de espera", () => {
    expect(waitlistReason({ roe: 0.09 }, { pass: false, reasons: ["ROE 9%", "FCF TTM no positivo"] })).toBeNull();
    expect(waitlistReason({}, { pass: false, reasons: ["Altman Z 1.2 < 1.81 (distress)"] })).toBeNull();
    expect(waitlistReason({}, { pass: true, reasons: [] })).toBeNull();
  });
});

describe("universeRow y queryUniverse", () => {
  const mk = (ticker, opts = {}) => universeRow({
    listing: { ticker, name: `${ticker} Corp`, exchange: opts.ex ?? "NYSE", cik: 1 },
    f: opts.f === undefined ? { roe: 0.2, fcfYield: 0.05, opMargin: 0.2, debtToEquity: 0.5 } : opts.f,
    gate: opts.gate ?? { pass: true, reasons: [] },
    price: opts.price ?? 50, volume: 1000, cap: opts.cap ?? 5e9, gicsSector: opts.sector ?? "Energy", preScore: opts.pre ?? 70,
  });
  const rows = [
    mk("BIG", { cap: 9e10, ex: "Nasdaq" }),
    mk("MID", { cap: 2e9, sector: "Financials" }),
    mk("PENNY", { price: 1.2, cap: 5e8 }),
    mk("TINY", { cap: MIN_CAP - 1 }),
    mk("WAIT", { gate: { pass: false, reasons: ["ROE 8% ≤ 10%"] }, f: { roe: 0.08 } }),
    mk("FOREIGN", { f: null, gate: { pass: false, reasons: ["Sin XBRL"] } }),
  ];

  it("marca el piso invertible y la falta de fundamentales", () => {
    expect(rows.find((r) => r.symbol === "PENNY").investable).toBe(false);
    expect(rows.find((r) => r.symbol === "TINY").investable).toBe(false);
    expect(rows.find((r) => r.symbol === "FOREIGN").hasFundamentals).toBe(false);
    expect(rows.find((r) => r.symbol === "BIG").dollarVolume).toBe(50000);
    const s = universeStats(rows);
    // El piso y el gate son independientes: PENNY y TINY pasan el gate aunque estén bajo el piso.
    expect(s).toMatchObject({ total: 6, investable: 4, gatePass: 4, waitlist: 1, byExchange: { NYSE: 5, Nasdaq: 1 } });
  });

  it("filtra por piso, gate, bolsa, sector y texto, y pagina", () => {
    expect(queryUniverse(rows).rows.map((r) => r.symbol)).toEqual(["BIG", "WAIT", "FOREIGN", "MID"]);
    expect(queryUniverse(rows, { all: "1" }).total).toBe(6);
    expect(queryUniverse(rows, { gate: "waitlist" }).rows.map((r) => r.symbol)).toEqual(["WAIT"]);
    expect(queryUniverse(rows, { gate: "fail" }).total).toBe(2);
    expect(queryUniverse(rows, { exchange: "Nasdaq" }).rows.map((r) => r.symbol)).toEqual(["BIG"]);
    expect(queryUniverse(rows, { sector: "financials" }).rows.map((r) => r.symbol)).toEqual(["MID"]);
    expect(queryUniverse(rows, { q: "penny" }).rows.map((r) => r.symbol)).toEqual(["PENNY"]);
    const page = queryUniverse(rows, { limit: "2", offset: "2" });
    expect(page.rows).toHaveLength(2);
    expect(page.total).toBe(4);
    expect(queryUniverse(rows, { sort: "nope" }).sort).toBe("marketCap");
  });
});

describe("parseSpark", () => {
  it("toma el precio de mercado y el volumen; sin meta se descarta", () => {
    const m = parseSpark({ spark: { result: [
      { symbol: "AAPL", response: [{ meta: { regularMarketPrice: 200, regularMarketVolume: 1e6 }, indicators: { quote: [{ close: [198, 199] }] } }] },
      { symbol: "OLD", response: [{ meta: {}, indicators: { quote: [{ close: [10, null, 11] }] } }] },
      { symbol: "BAD", response: [] },
    ] } });
    expect(m.get("AAPL")).toEqual({ price: 200, volume: 1e6 });
    expect(m.get("OLD")).toEqual({ price: 11, volume: null });
    expect(m.has("BAD")).toBe(false);
    expect(parseSpark(null).size).toBe(0);
  });
});

describe("FUND_RE", () => {
  it("reconoce fondos por nombre sin atrapar empresas parecidas", () => {
    expect(FUND_RE.test("SPDR S&P 500 ETF TRUST")).toBe(true);
    expect(FUND_RE.test("iShares Gold Trust")).toBe(true);
    expect(FUND_RE.test("Trustmark Corp")).toBe(false);
    expect(FUND_RE.test("Fundamental Global Inc")).toBe(false);
  });
});
