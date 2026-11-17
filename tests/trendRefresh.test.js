import { describe, it, expect } from "vitest";
import { buildTechnicalUpdates } from "../lib/trendRefresh.js";

const series = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { t: i, o: c, h: c + 1, l: c - 1, c, v: 1000 }; });
const up = (slope) => series(300, (i) => 100 + slope * i);

function universe(count) {
  const passers = Array.from({ length: count }, (_, i) => ({ symbol: `S${i}`, preScore: 60, gicsSector: i % 2 ? "Information Technology" : null }));
  const candlesMap = new Map(passers.map((p, i) => [p.symbol, up(0.1 + i * 0.05)]));
  candlesMap.set("SPY", up(0.2));
  candlesMap.set("XLK", up(0.3));
  return { passers, candlesMap };
}

describe("buildTechnicalUpdates", () => {
  it("calcula v4 y v3 para cada símbolo intentado, sin mutar la entrada", () => {
    const { passers, candlesMap } = universe(25);
    const frozen = JSON.stringify(passers);
    const { updates, stats } = buildTechnicalUpdates({ passers, candlesMap });
    expect(Object.keys(updates)).toHaveLength(25);
    expect(stats.trendScored).toBe(25);
    expect(updates.S24.trendScore).toBeGreaterThan(updates.S0.trendScore);
    expect(updates.S1.trendInputs.rsBenchmark).toBe("XLK");
    expect(updates.S0.trendInputs.rsBenchmark).toBe("SPY");
    expect(updates.S0.trendFlags).toContain("benchmark_spy");
    expect(updates.S1.technicalScore).not.toBeUndefined();
    expect(JSON.stringify(passers)).toBe(frozen);
  });

  it("los no intentados (corte por tiempo) no se actualizan", () => {
    const { passers, candlesMap } = universe(25);
    candlesMap.delete("S3");
    const { updates, stats } = buildTechnicalUpdates({ passers, candlesMap });
    expect(updates.S3).toBeUndefined();
    expect(stats.skipped).toBe(1);
  });

  it("si falla más del 30% de las velas no pisa los scores previos con null", () => {
    const { passers, candlesMap } = universe(25);
    for (let i = 0; i < 10; i++) candlesMap.set(`S${i}`, null);
    const { updates, stats } = buildTechnicalUpdates({ passers, candlesMap });
    expect(stats.degraded).toBe(true);
    expect(updates.S0).toBeUndefined();
    expect(updates.S20.trendScore).not.toBeNull();
  });

  it("con pocas fallas, el símbolo sin velas queda en null", () => {
    const { passers, candlesMap } = universe(25);
    candlesMap.set("S0", null);
    const { updates } = buildTechnicalUpdates({ passers, candlesMap });
    expect(updates.S0.trendScore).toBeNull();
    expect(updates.S0.technicalScore).toBeNull();
  });
});
