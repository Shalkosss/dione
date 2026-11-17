import { describe, it, expect } from "vitest";
import { parseSectorBreakdown } from "../lib/spyWeights.js";
import { benchFromGics, sectorExposure, activeWeights, mandateChecks, SPY_WEIGHTS } from "../src/lib/sectors.js";
import { poolDiversity } from "../lib/thesisStats.js";
import { buildScanResponse } from "../lib/scanApi.js";

const SECTORS = [
  ["Information Technology", 35.3], ["Financials", 12.79], ["Health Care", 10.63], ["Consumer Discretionary", 9.51],
  ["Communication Services", 8.86], ["Industrials", 8.22], ["Consumer Staples", 5.29], ["Energy", 3.62],
  ["Utilities", 2.16], ["Real Estate", 1.88], ["Materials", 1.75],
];
const esc = (o) => JSON.stringify(o).replace(/"/g, "&#34;");
const page = (label, rows = SECTORS) => `<div data-a="${esc({
  label, asOfDate: "as of Nov 16 2026", asOfDateSimple: "Nov 16 2026",
  attrArray: rows.map(([n, w]) => ({ name: { label: "Sector", value: n }, weight: { label: "Weight", value: `${w}%`, originalValue: String(w) } })),
})}"></div>`;

describe("parseSectorBreakdown (ficha de SPY en SSGA)", () => {
  it("lee los 11 sectores del índice y la fecha", () => {
    const r = parseSectorBreakdown(page("Index Sector Breakdown"));
    expect(r.asOf).toBe("2026-11-16");
    expect(r.weights["Information Technology"]).toBeCloseTo(0.353);
    expect(Object.keys(r.weights)).toHaveLength(11);
  });

  it("usa la tabla del fondo si no está la del índice", () => {
    expect(parseSectorBreakdown(page("Fund Sector Breakdown")).weights.Energy).toBeCloseTo(0.0362);
  });

  it("acepta la fecha con coma", () => {
    const html = page("Index Sector Breakdown").replace(/Nov 16 2026/g, "Nov 16, 2026");
    expect(parseSectorBreakdown(html).asOf).toBe("2026-11-16");
  });

  it("rechaza tablas incompletas (incluso con 10 sectores) o páginas sin el dato", () => {
    expect(parseSectorBreakdown(page("Index Sector Breakdown", SECTORS.slice(0, 5)))).toBeNull();
    const ten = SECTORS.slice(0, 10).map(([n, w], i) => [n, i === 0 ? w + 1.75 : w]);
    expect(parseSectorBreakdown(page("Index Sector Breakdown", ten))).toBeNull();
    expect(parseSectorBreakdown("<html>mantenimiento</html>")).toBeNull();
    expect(parseSectorBreakdown(null)).toBeNull();
  });
});

describe("pesos vigentes en la cartera", () => {
  const live = { asOf: "2026-11-16", weights: Object.fromEntries(SECTORS.map(([n, w]) => [n, w / 100])) };

  it("benchFromGics pasa a nombres cortos y exige los 11", () => {
    const b = benchFromGics(live);
    expect(b.Technology).toBeCloseTo(0.353);
    expect(b.Healthcare).toBeCloseTo(0.1063);
    expect(benchFromGics({ weights: { Energy: 0.03 } })).toBeNull();
    expect(benchFromGics(null)).toBeNull();
  });

  it("VOO se abre con los pesos que se le pasan y la diferencia activa usa los mismos", () => {
    const bench = { ...SPY_WEIGHTS, Technology: 0.5, Financials: 0.1279 - 0.147 + SPY_WEIGHTS.Financials };
    const exp = sectorExposure([{ ticker: "VOO", weight: 1 }], 0, bench);
    expect(exp.Technology).toBeCloseTo(0.5);
    const tech = activeWeights(exp, bench).find((r) => r.sector === "Technology");
    expect(tech.active).toBeCloseTo(0);
    expect(mandateChecks([{ ticker: "VOO", weight: 1 }], 0, "real", bench).some((a) => a.text.startsWith("Technology"))).toBe(true);
  });

  it("buildScanResponse expone los pesos en sectors y scan", () => {
    const snap = { meta: { market: { sectors: [], spyWeights: live } }, gems: {} };
    expect(buildScanResponse(snap, "sectors").spyWeights.asOf).toBe("2026-11-16");
    expect(buildScanResponse(snap, "scan").spyWeights.weights.Energy).toBeCloseTo(0.0362);
    expect(buildScanResponse({ meta: {}, gems: {} }, "sectors").spyWeights).toBeNull();
  });
});

describe("poolDiversity (máx. 40% de tesis vivas por sector o tema)", () => {
  const t = (ticker, sector, status = "ARMADA", theme) => ({ ticker, sector, status, raw_json: theme ? { theme } : {} });

  it("marca el sector que pasa del 40%", () => {
    const d = poolDiversity([
      t("MU", "Information Technology"), t("NVDA", "Information Technology", "ABIERTA"), t("AVGO", "Information Technology", "SIN_ORDEN"),
      t("JPM", "Financials"), t("XOM", "Energy"), t("OLD", "Information Technology", "CERRADA_STOP"),
    ]);
    expect(d.live).toBe(5);
    expect(d.breaches).toHaveLength(1);
    expect(d.breaches[0]).toMatchObject({ kind: "sector", name: "Information Technology", n: 3, share: 0.6 });
    expect(d.breaches[0].tickers).toEqual(["MU", "NVDA", "AVGO"]);
  });

  it("agrupa por tema aunque los sectores sean distintos", () => {
    const d = poolDiversity([
      t("MU", "Information Technology", "ARMADA", "IA y data centers"),
      t("VST", "Utilities", "ARMADA", ["IA y data centers", "Energía"]),
      t("JPM", "Financials"), t("XOM", "Energy"), t("COST", "Consumer Staples"),
    ]);
    expect(d.breaches).toEqual([]);
    const ai = d.groups.find((g) => g.kind === "tema" && g.name === "IA y data centers");
    expect(ai.share).toBeCloseTo(0.4);
    const d2 = poolDiversity([...[1, 2, 3].map((i) => t(`A${i}`, `S${i}`, "ARMADA", "ia y data centers")), t("B", "X"), t("C", "Y")]);
    expect(d2.breaches[0]).toMatchObject({ kind: "tema", n: 3 });
  });

  it("con menos de 3 tesis vivas no evalúa", () => {
    const d = poolDiversity([t("MU", "Information Technology"), t("NVDA", "Information Technology")]);
    expect(d.evaluated).toBe(false);
    expect(d.breaches).toEqual([]);
    expect(poolDiversity([]).live).toBe(0);
  });
});
