import { describe, it, expect } from "vitest";
import { buildScanResponse, scanRow } from "../lib/scanApi.js";
import { marketSummary } from "../lib/trendRefresh.js";

const candles = (n, f) => Array.from({ length: n }, (_, i) => ({ t: 1700000000 + i * 86400, o: f(i), h: f(i), l: f(i), c: f(i), v: 1 }));

describe("marketSummary", () => {
  it("arma régimen y tablero desde las velas del cron", () => {
    const map = new Map([["SPY", candles(260, (i) => 100 + i)], ["XLK", candles(260, (i) => 100 + 2 * i)], ["^VIX", candles(260, () => 14)]]);
    const m = marketSummary(map);
    expect(m.regime.label).toBe("RIESGO ACTIVO");
    expect(m.regime.vix).toBe(14);
    const xlk = m.sectors.find((s) => s.etf === "XLK");
    expect(xlk.rs3m).toBeGreaterThan(0);
    expect(xlk.aboveSma200).toBe(true);
    expect(xlk.gicsSector).toBe("Information Technology");
  });

  it("sin SPY no inventa régimen", () => {
    expect(marketSummary(new Map())).toEqual({ regime: null, sectors: [] });
  });
});

describe("buildScanResponse", () => {
  const snap = {
    meta: { updatedAt: "2026-11-17T09:00:00Z", weekOf: "2026-11-16", market: { regime: { label: "CAUTELA" }, sectors: [{ etf: "XLE" }], breadthUniverse: 0.6, asOf: "x" } },
    gems: {
      A: { symbol: "A", gicsSector: "Energy", preScore: 90, gatePass: true, rank: 1, weeklyMark: "NUEVO", roe: 0.3 },
      B: { symbol: "B", gicsSector: "Energy", preScore: 80, gatePass: true, rank: 2 },
      M: { symbol: "M", gicsSector: "Information Technology", preScore: 40, gatePass: false, gateReasons: ["ROE"], megacap: true, marketCap: 3e12 },
    },
  };

  it("scan trae régimen, sectores, descubrimiento, megacaps y movimientos", () => {
    const r = buildScanResponse(snap, "scan");
    expect(r.regime.label).toBe("CAUTELA");
    expect(r.regime.breadthUniverse).toBe(0.6);
    expect(r.sectors).toHaveLength(1);
    expect(r.discovery.Energy.map((g) => g.symbol)).toEqual(["A", "B"]);
    expect(r.megacaps[0].gateReasons).toEqual(["ROE"]);
    expect(r.movers.map((g) => g.symbol)).toEqual(["A"]);
    expect(r.updatedAt.weekOf).toBe("2026-11-16");
  });

  it("regime y sectors devuelven solo su parte", () => {
    expect(Object.keys(buildScanResponse(snap, "regime"))).toEqual(["regime", "updatedAt"]);
    expect(buildScanResponse(snap, "sectors").sectors).toHaveLength(1);
  });

  it("sin datos de mercado el régimen es null", () => {
    expect(buildScanResponse({ meta: {}, gems: {} }, "regime").regime).toBeNull();
  });

  it("scanRow no expone razones del gate si pasó", () => {
    expect(scanRow({ symbol: "X", gatePass: true, gateReasons: ["viejo"] }).gateReasons).toEqual([]);
  });
});
