import { describe, it, expect } from "vitest";
import { pivots, clusterLevels, supportResistance, trendlines, volumeProfile } from "../src/lib/levels.js";
import { enrichCandles, visibleStart, splitHeld } from "../src/lib/chartData.js";

const day = (i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const bar = (i, c, spread = 1, v = 1000) => ({ date: day(i), open: c, high: c + spread, low: c - spread, close: c, volume: v });

// Oscila entre 90 y 110 con período 20: rebota varias veces en los mismos niveles.
const wave = (n = 120) => Array.from({ length: n }, (_, i) => bar(i, 100 + 10 * Math.sin((i / 20) * 2 * Math.PI)));

describe("pivots", () => {
  it("marca máximos y mínimos locales", () => {
    const p = pivots(wave(), 5);
    expect(p.some((x) => x.type === "H" && x.price > 110)).toBe(true);
    expect(p.some((x) => x.type === "L" && x.price < 90)).toBe(true);
  });
});

describe("clusterLevels", () => {
  it("agrupa precios cercanos y cuenta los toques", () => {
    const lv = clusterLevels([{ price: 100, idx: 1 }, { price: 100.4, idx: 5 }, { price: 120, idx: 9 }], 1, 10);
    expect(lv).toHaveLength(2);
    expect(lv[0].touches).toBe(2);
    expect(lv[0].price).toBeCloseTo(100.2);
  });
});

describe("supportResistance", () => {
  it("encuentra soporte cerca de 89 y resistencia cerca de 111 en una onda", () => {
    const cs = wave(130);
    cs.push(bar(130, 100));
    const { supports, resistances } = supportResistance(cs);
    expect(supports[0].price).toBeGreaterThan(87);
    expect(supports[0].price).toBeLessThan(91);
    expect(supports[0].touches).toBeGreaterThanOrEqual(2);
    expect(resistances[0].price).toBeGreaterThan(109);
  });
});

describe("trendlines", () => {
  it("una suba con mínimos crecientes da directriz alcista con pendiente positiva", () => {
    const cs = Array.from({ length: 120 }, (_, i) => bar(i, 100 + i * 0.5 + 4 * Math.sin((i / 15) * 2 * Math.PI)));
    const { support } = trendlines(cs);
    expect(support).toBeTruthy();
    expect(support.slope).toBeGreaterThan(0);
    expect(support.endPrice).toBeLessThan(cs[cs.length - 1].close);
  });
});

describe("volumeProfile", () => {
  it("el POC queda donde se negoció más volumen", () => {
    const cs = [...Array.from({ length: 20 }, (_, i) => bar(i, 100, 1, 5000)), ...Array.from({ length: 20 }, (_, i) => bar(20 + i, 120, 1, 500))];
    const vp = volumeProfile(cs);
    expect(vp.poc).toBeGreaterThan(98);
    expect(vp.poc).toBeLessThan(102);
    expect(vp.val).toBeLessThanOrEqual(vp.poc);
    expect(vp.vah).toBeGreaterThanOrEqual(vp.poc);
  });
});

describe("chartData", () => {
  it("visibleStart recorta por días calendario y splitHeld comparte la vela de compra", () => {
    const rows = enrichCandles(wave(60));
    expect(visibleStart(rows, 10)).toBe(49);
    const split = splitHeld(rows, day(50));
    expect(split[50].closePre).toBe(split[50].close);
    expect(split[50].closeHeld).toBe(split[50].close);
    expect(split[51].closePre).toBe(null);
    expect(split[49].closeHeld).toBe(null);
    expect(rows[59].rvol).toBeCloseTo(1);
  });
});
