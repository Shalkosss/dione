import { describe, it, expect } from "vitest";
import { computeTrendInputs, momentumPercentile, scoreTrend, computeTrendScore, trendLabel } from "../lib/trendScore.js";

const inp = (price, sma50, sma200, sma200Prev20, rsi, ret63) => ({
  price, sma50, sma200, sma200Prev20, rsi, ret63, distSma50: price / sma50 - 1, momentumPartial: false,
});

describe("scoreTrend con entradas a mano", () => {
  const cases = [
    // price, sma50, sma200, prev20, rsi, momPct, ret63, bench, score, label
    [105, 102, 90, 88, 50, 1.0, 0.12, 0.05, 100, "EN ZONA"],
    [80, 90, 100, 102, 35, 0, -0.20, -0.05, 5, "ROTA"],
    [120, 105, 95, 93, 72, 0.8, 0.10, 0.08, 75, "EXTENDIDA"],
    [100, 106, 95, 94, 36, 0.6, -0.02, 0.01, 70, "RETROCESO"],
    [98, 92, 100, 101, 58, 0.4, 0.06, 0.06, 23, "RECUPERANDO"],
    [103, 100, 90, 89, 65, 0.2, 0.03, null, 58, "EN ZONA"],
    [108, 100, 90, 89, 55, 0.2, 0.03, null, 58, "ALCISTA"],
  ];
  it.each(cases)("price %s → score esperado", (price, s50, s200, prev, rsi, momentumPct, ret63, benchRet63, score, label) => {
    const r = scoreTrend(inp(price, s50, s200, prev, rsi, ret63), { momentumPct, benchRet63 });
    expect(r.score).toBe(score);
    expect(r.label).toBe(label);
  });

  it("sin benchmark marca la bandera", () => {
    expect(scoreTrend(inp(103, 100, 90, 89, 65, 0.03), { momentumPct: 0.2 }).flags).toContain("sin_benchmark");
  });

  it("el desglose trae las seis claves", () => {
    const r = scoreTrend(inp(105, 102, 90, 88, 50, 0.12), { momentumPct: 1, benchRet63: 0.05 });
    expect(Object.keys(r.breakdown)).toEqual(["aboveSma200", "sma200Slope", "smaStack", "momentum", "relStrength", "entryZone"]);
  });
});

describe("bordes", () => {
  const rs = (ret63) => scoreTrend(inp(105, 102, 90, 88, 50, ret63), { momentumPct: 0, benchRet63: 0 }).breakdown.relStrength;
  it("fuerza relativa", () => {
    expect(rs(0.05)).toBe(10);
    expect(rs(0.0501)).toBe(15);
    expect(rs(0)).toBe(5);
    expect(rs(-0.0499)).toBe(5);
    expect(rs(-0.05)).toBe(0);
  });

  const zone = (price, rsi) => scoreTrend(inp(price, 100, 90, 89, rsi, 0), { momentumPct: 0, benchRet63: 0 }).breakdown.entryZone;
  it("zona de entrada", () => {
    expect(zone(105, 60)).toBe(15);
    expect(zone(97, 40)).toBe(15);
    expect(zone(105, 61)).toBe(8);
    expect(zone(110, 50)).toBe(8);
    expect(zone(110.01, 50)).toBe(0);
    expect(zone(103, 75)).toBe(8);
    expect(zone(103, 75.1)).toBe(0);
    expect(zone(96.99, 50)).toBe(5);
  });

  it("la etiqueta respeta el orden contra la SMA200", () => {
    expect(trendLabel(inp(95, 90, 100, 100, 80, 0))).toBe("RECUPERANDO");
  });
});

describe("momentumPercentile", () => {
  const universe = Array.from({ length: 20 }, (_, i) => i + 1);
  it("mejor 1, peor 0, intermedio proporcional", () => {
    expect(momentumPercentile(20, universe)).toBe(1);
    expect(momentumPercentile(1, universe)).toBe(0);
    expect(momentumPercentile(10, universe)).toBeCloseTo(9 / 19);
  });
  it("empates toman el punto medio", () => {
    const u = [1, 2, 2, 3, ...Array.from({ length: 16 }, (_, i) => 10 + i)];
    expect(momentumPercentile(2, u)).toBeCloseTo(1.5 / 19);
  });
  it("con menos de 20 valores no hay percentil", () => {
    expect(momentumPercentile(5, universe.slice(1))).toBeNull();
  });
});

const series = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { t: i, o: c, h: c + 1, l: c - 1, c, v: 1000 }; });

describe("computeTrendInputs con series sintéticas", () => {
  it("serie ascendente", () => {
    const x = computeTrendInputs(series(300, (i) => 100 + i));
    expect(x.price).toBe(399);
    expect(x.sma50).toBeCloseTo(374.5);
    expect(x.sma200).toBeCloseTo(299.5);
    expect(x.sma200Prev20).toBeCloseTo(279.5);
    expect(x.mom12_1).toBeCloseTo(378 / 147 - 1);
    expect(x.mom6_1).toBeCloseTo(378 / 273 - 1);
    expect(x.ret63).toBeCloseTo(399 / 336 - 1);
    expect(x.rsi).toBe(100);
    const r = scoreTrend(x, { momentumPct: 1 });
    expect(r.score).toBe(70);
    expect(r.label).toBe("EXTENDIDA");
  });

  it("serie descendente", () => {
    const x = computeTrendInputs(series(300, (i) => 500 - i));
    const r = scoreTrend(x, { momentumPct: 0 });
    expect(r.score).toBe(5);
    expect(r.label).toBe("ROTA");
  });

  it("menos de 220 barras no da score", () => {
    expect(computeTrendScore(series(219, (i) => 100 + i))).toEqual({ score: null, reason: "insufficient_data" });
  });

  it("con 240 barras usa solo el momentum 6-1", () => {
    const x = computeTrendInputs(series(240, (i) => 100 + i));
    expect(x.mom12_1).toBeNull();
    expect(x.momentum).toBeCloseTo(x.mom6_1);
    expect(scoreTrend(x, {}).flags).toContain("momentum_parcial");
  });
});
