import { describe, it, expect } from "vitest";
import { percentileAgainst, momentumFromInputs } from "../lib/trendScore.js";
import { referenceMomentum, partSymbols, universeTrendRows, combinedBreadth, dropIntraday } from "../lib/universeTech.js";
import { buildTechnicalUpdates } from "../lib/trendRefresh.js";
import { factsToRaw } from "../lib/companyFacts.js";
import { staleCiks } from "../lib/foreignFacts.js";
import { universeRow, withTrend } from "../lib/marketUniverse.js";
import { computeMetrics } from "../lib/edgar.js";
import { qualityGate } from "../lib/scoring.js";
import { buildScanResponse } from "../lib/scanApi.js";

const candles = (n, f) => Array.from({ length: n }, (_, i) => ({ t: 1700000000 + i * 86400, o: f(i), h: f(i) * 1.01, l: f(i) * 0.99, c: f(i), v: 1000 }));

describe("percentil contra una referencia fija", () => {
  const ref = Array.from({ length: 40 }, (_, i) => i / 100);

  it("mide sin sumarse a la referencia", () => {
    expect(percentileAgainst(0.395, ref)).toBeCloseTo(1);
    expect(percentileAgainst(-1, ref)).toBe(0);
    expect(percentileAgainst(0.2, ref)).toBeCloseTo((20 + 0.5) / 40);
    expect(percentileAgainst(null, ref)).toBeNull();
    expect(percentileAgainst(0.1, ref.slice(0, 5))).toBeNull();
  });

  it("las del universo no modifican la referencia de calidad (congelada)", () => {
    const reference = Object.freeze(Array.from({ length: 30 }, (_, i) => i / 100));
    const map = new Map([["X", candles(300, (i) => 10 + i)], ["Y", candles(300, (i) => 300 - i * 0.5)]]);
    expect(() => universeTrendRows({ candidates: [{ symbol: "X" }, { symbol: "Y" }], candlesMap: map, reference })).not.toThrow();
  });

  it("el score de calidad solo depende de las de calidad: el universo no entra en su percentil", () => {
    // refresh-technical rankea a los passers entre ellos: velas de empresas del
    // universo en el mismo Map no cambian ningún score de calidad.
    const passers = Array.from({ length: 25 }, (_, i) => ({ symbol: `Q${i}`, preScore: 60, gicsSector: "Energy" }));
    const base = new Map([["SPY", candles(300, (i) => 100 + i * 0.1)], ...passers.map((p, k) => [p.symbol, candles(300, (i) => 50 + i * (0.05 + k * 0.01))])]);
    const withOutsiders = new Map([...base, ...Array.from({ length: 200 }, (_, k) => [`U${k}`, candles(300, (i) => 5 + i * (k % 7))])]);
    const a = buildTechnicalUpdates({ passers, candlesMap: base }).updates;
    const b = buildTechnicalUpdates({ passers, candlesMap: withOutsiders }).updates;
    expect(passers.map((p) => b[p.symbol].trendScore)).toEqual(passers.map((p) => a[p.symbol].trendScore));
  });

  it("momentumFromInputs reconstruye el momentum guardado", () => {
    expect(momentumFromInputs({ mom12_1: 0.2, mom6_1: 0.1 })).toBeCloseTo(0.15);
    expect(momentumFromInputs({ mom12_1: null, mom6_1: 0.1 })).toBe(0.1);
    expect(momentumFromInputs(null)).toBeNull();
    expect(referenceMomentum({ A: { trendInputs: { mom12_1: 0.2, mom6_1: 0.1 } }, B: {} })).toEqual([0.15000000000000002]);
  });
});

describe("tandas del universo", () => {
  const rows = ["D", "A", "C", "B", "E", "Q", "GOOG"].map((s, i) => ({ symbol: s, cik: s === "GOOG" ? 77 : i, investable: s !== "E", price: 10, gicsSector: "Energy" }));
  const quality = { symbols: ["Q", "GOOGL"], ciks: [77] };

  it("reparte las invertibles fuera de calidad (por símbolo y por CIK), sin repetir", () => {
    const p1 = partSymbols(rows, quality, 1).map((c) => c.symbol);
    const p2 = partSymbols(rows, quality, 2).map((c) => c.symbol);
    expect(p1).toEqual(["A", "C"]);
    expect(p2).toEqual(["B", "D"]);
  });

  it("el punto de partida rota con el día", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ symbol: `S${i}`, investable: true, price: 1 }));
    const d0 = partSymbols(many, {}, 1, 1, 0).map((c) => c.symbol);
    const d1 = partSymbols(many, {}, 1, 1, 1).map((c) => c.symbol);
    expect(d1).not.toEqual(d0);
    expect([...d1].sort()).toEqual([...d0].sort());
  });

  it("dropIntraday saca la vela de hoy con el mercado abierto", () => {
    const at = (iso) => ({ t: Date.parse(iso) / 1000, c: 1 });
    const series = [at("2026-11-17T21:00:00Z"), at("2026-11-18T15:30:00Z")];
    expect(dropIntraday(series, Date.parse("2026-11-18T15:00:00Z"))).toHaveLength(1);
    expect(dropIntraday(series, Date.parse("2026-11-18T22:00:00Z"))).toHaveLength(2);
    expect(dropIntraday([at("2026-11-17T21:00:00Z")], Date.parse("2026-11-18T15:00:00Z"))).toHaveLength(1);
  });

  it("marca todo como fuera del universo validado y cuenta amplitud", () => {
    const ref = Array.from({ length: 30 }, (_, i) => i / 100 - 0.1);
    const map = new Map([
      ["SPY", candles(300, (i) => 100 + i * 0.1)],
      ["XLE", candles(300, (i) => 100 + i * 0.05)],
      ["UP", candles(300, (i) => 10 + i * 0.1)],
      ["DOWN", candles(300, (i) => 60 - i * 0.1)],
      ["SHORT", candles(50, () => 10)],
      ["FAIL", null],
    ]);
    const cands = ["UP", "DOWN", "SHORT", "FAIL", "LATE"].map((s) => ({ symbol: s, gicsSector: "Energy" }));
    const { rows: out, stats } = universeTrendRows({ candidates: cands, candlesMap: map, reference: ref });
    expect(Object.keys(out).sort()).toEqual(["DOWN", "UP"]);
    expect(out.UP.flags).toContain("fuera_validado");
    expect(out.UP.aboveSma200).toBe(true);
    expect(out.DOWN.trendLabel).toBe("ROTA");
    expect(stats).toMatchObject({ candidates: 5, attempted: 4, skipped: 1, candleFailures: 1, scored: 2, above: 1, withSma: 2, referenceSize: 30, degraded: false });
  });

  it("amplitud combinada: solo tandas del mismo día que la corrida de calidad", () => {
    const now = Date.parse("2026-11-18T15:00:00Z");
    const q = { breadthAboveSma200: 0.6, trendUniverseSize: 500, technicalUpdatedAt: "2026-11-18T10:10:00Z" };
    const parts = [{ asOf: "2026-11-18T13:05:00Z", above: 400, withSma: 1000 }, { asOf: "2026-11-17T14:00:00Z", above: 900, withSma: 1000 }];
    const b = combinedBreadth(q, parts, now);
    expect(b.parts).toBe(1);
    expect(b.share).toBeCloseTo((300 + 400) / 1500);
    expect(combinedBreadth({}, parts, now)).toBeNull();
  });

  it("el régimen expone la amplitud de mercado solo si hay tandas", () => {
    const now = Date.parse("2026-11-18T15:00:00Z");
    const snap = { meta: { breadthAboveSma200: 0.6, trendUniverseSize: 500, technicalUpdatedAt: "2026-11-18T10:00:00Z", market: { regime: { label: "RIESGO ACTIVO" }, breadthUniverse: 0.6 } }, gems: {} };
    expect(buildScanResponse(snap, "regime", { now }).regime.breadthMarket).toBeNull();
    const r = buildScanResponse(snap, "regime", { now, partMetas: [{ asOf: "2026-11-18T13:00:00Z", above: 100, withSma: 500 }] }).regime;
    expect(r.breadthMarket).toBeCloseTo(400 / 1000);
    expect(r.breadthUniverse).toBe(0.6);
  });

  it("withTrend suma tandas frescas sin pisar la tendencia de calidad", () => {
    const now = Date.parse("2026-11-18T15:00:00Z");
    const fresh = { meta: { asOf: "2026-11-18T13:00:00Z" }, rows: { A: { trendScore: 70, trendLabel: "EN ZONA", aboveSma200: true, flags: ["fuera_validado"] }, Q: { trendScore: 10 } } };
    const old = { meta: { asOf: "2026-11-15T13:00:00Z" }, rows: { B: { trendScore: 50 } } };
    const merged = withTrend([{ symbol: "A", roe: 0.2 }, { symbol: "B" }, { symbol: "Q", trendScore: 80 }], [fresh, old, null], { now });
    expect(merged[0]).toMatchObject({ symbol: "A", roe: 0.2, trendScore: 70, trendFlags: ["fuera_validado"] });
    expect(merged[1].trendScore).toBeUndefined();
    expect(merged[2].trendScore).toBe(80);
  });

  it("factsToRaw: con el mismo cierre gana la moneda con más años", () => {
    const fyE = (start, end, val) => ({ start, end, val, form: "20-F", fp: "FY", filed: "2026-03-01" });
    const json = { facts: { "ifrs-full": { ProfitLoss: { units: {
      USD: [fyE("2025-01-01", "2025-12-31", 10)],
      JPY: [fyE("2024-01-01", "2024-12-31", 900), fyE("2025-01-01", "2025-12-31", 1000)],
    } } } } };
    const raw = factsToRaw(json, "2026-11-17");
    expect(raw.currency).toBe("JPY");
    expect(raw.prev.ni).toBe(900);
  });
});

describe("companyfacts (IFRS y otras monedas)", () => {
  const fy = (start, end, val, form = "20-F", filed = "2026-03-01") => ({ start, end, val, form, fp: "FY", filed });
  const inst = (end, val, form = "20-F", filed = "2026-03-01") => ({ end, val, form, fp: "FY", filed });
  const ifrs = {
    facts: {
      "ifrs-full": {
        ProfitLossAttributableToOwnersOfParent: { units: { EUR: [fy("2024-01-01", "2024-12-31", 80, "20-F", "2025-03-01"), fy("2025-01-01", "2025-12-31", 100), fy("2025-07-01", "2025-09-30", 30, "6-K")] } },
        Revenue: { units: { EUR: [fy("2025-01-01", "2025-12-31", 1000)] } },
        CashFlowsFromUsedInOperatingActivities: { units: { EUR: [fy("2025-01-01", "2025-12-31", 150)] } },
        PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets: { units: { EUR: [fy("2025-01-01", "2025-12-31", -50)] } },
        EquityAttributableToOwnersOfParent: { units: { EUR: [inst("2025-12-31", 500, "20-F", "2026-02-01"), inst("2025-12-31", 520, "20-F/A", "2026-05-01")] } },
        Assets: { units: { EUR: [inst("2025-12-31", 1200)] } },
        Liabilities: { units: { EUR: [inst("2025-12-31", 680)] } },
        NoncurrentPortionOfNoncurrentBorrowings: { units: { EUR: [inst("2025-12-31", 100)] } },
      },
    },
  };

  it("arma el raw en la moneda del emisor con el último cierre anual", () => {
    const raw = factsToRaw(ifrs, "2026-11-17");
    expect(raw).toMatchObject({ taxonomy: "ifrs-full", currency: "EUR", fyEnd: "2025-12-31", ni: 100, rev: 1000, ocf: 150, capex: 50, eq: 520, ltd: 100, stale: false });
    expect(raw.prev.ni).toBe(80);
    const f = computeMetrics("SAP", raw, null, null);
    expect(f.roe).toBeCloseTo(100 / 520);
    expect(f.fcfYield).toBeNull();
    expect(f.pe).toBeNull();
    expect(qualityGate(f).pass).toBe(true);
  });

  it("marca viejo un cierre de hace más de 18 meses y descarta sin anuales", () => {
    expect(factsToRaw(ifrs, "2027-08-01").stale).toBe(true);
    expect(factsToRaw({ facts: {} })).toBeNull();
    expect(factsToRaw(null)).toBeNull();
  });

  it("usa us-gaap en otra moneda (ASML en euros)", () => {
    const asml = { facts: { "us-gaap": { NetIncomeLoss: { units: { EUR: [fy("2025-01-01", "2025-12-31", 9)] } }, StockholdersEquity: { units: { EUR: [inst("2025-12-31", 20)] } } } } };
    expect(factsToRaw(asml, "2026-11-17")).toMatchObject({ taxonomy: "us-gaap", currency: "EUR", ni: 9, eq: 20 });
  });

  it("sin capex estándar el gate dice 'FCF sin dato', no 'no positivo'", () => {
    const noCapex = JSON.parse(JSON.stringify(ifrs));
    delete noCapex.facts["ifrs-full"].PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets;
    const f = computeMetrics("TM", factsToRaw(noCapex, "2026-11-17"), null, null);
    expect(qualityGate(f).reasons).toContain("FCF sin dato");
  });

  it("cache: baja solo lo que falta o venció", () => {
    const now = Date.parse("2026-11-17T00:00:00Z");
    const byCik = { 1: { fetchedAt: "2026-11-10T00:00:00Z" }, 2: { fetchedAt: "2026-09-01T00:00:00Z" } };
    expect(staleCiks([1, 2, 3], byCik, now)).toEqual([2, 3]);
  });

  it("extranjera: sin capitalización, invertible por volumen", () => {
    const base = { listing: { ticker: "NU", name: "Nu", exchange: "NYSE" }, f: { roe: 0.25 }, gate: { pass: true, reasons: [] }, cap: null, gicsSector: "Financials", preScore: 60 };
    const liquid = universeRow({ ...base, price: 15, volume: 1e6, foreign: { currency: "USD", taxonomy: "ifrs-full", fyEnd: "2025-12-31" } });
    expect(liquid).toMatchObject({ investable: true, foreign: true, currency: "USD", marketCap: null });
    expect(universeRow({ ...base, price: 15, volume: 1e3, foreign: { currency: "USD" } }).investable).toBe(false);
    expect(universeRow({ ...base, price: 15, volume: 1e6 }).investable).toBe(false);
  });
});
