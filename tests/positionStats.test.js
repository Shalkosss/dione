import { describe, it, expect } from "vitest";
import { positionPlan, levelsTransactionId, levelsFromThesis, effectiveLevels, positionMetrics, correlationMatrix } from "../src/lib/positionStats.js";
import { parseYahooNews } from "../lib/news.js";
import { normalizeTransaction, rowToTx } from "../lib/ledgerSchema.js";

const tx = (id, date, side, ticker, qty, price, extra = {}) => ({ id, date, side, ticker, qty, price, ...extra });
const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);

describe("positionPlan", () => {
  it("costo promedio del tramo abierto y niveles de la última compra que los trae", () => {
    const book = [
      tx("a", "2026-01-02", "BUY", "NU", 10, 10, { stop: 9, target: 14 }),
      tx("b", "2026-01-10", "BUY", "NU", 10, 12),
      tx("c", "2026-01-12", "SELL", "NU", 5, 13),
    ];
    const p = positionPlan(book, "NU");
    expect(p.qty).toBe(15);
    expect(p.avgCost).toBe(11);
    expect(p.startDate).toBe("2026-01-02");
    expect(p.stop).toBe(9);
    expect(p.target).toBe(14);
    expect(levelsTransactionId(p)).toBe("a");
  });

  it("si se vendió todo y se volvió a comprar, el tramo arranca de nuevo", () => {
    const book = [tx("a", "2026-01-02", "BUY", "NU", 10, 10, { stop: 9 }), tx("b", "2026-01-05", "SELL", "NU", 10, 11), tx("c", "2026-02-01", "BUY", "NU", 4, 12)];
    const p = positionPlan(book, "NU");
    expect(p.startDate).toBe("2026-02-01");
    expect(p.stop).toBe(null);
    expect(levelsTransactionId(p)).toBe("c");
    expect(positionPlan(book.slice(0, 2), "NU")).toBe(null);
  });
});

describe("niveles", () => {
  it("el libro manda; la tesis viva es el respaldo", () => {
    const theses = [{ ticker: "NU", status: "ABIERTA", entry_date: "2026-01-01", stop: 8, target_3m: 15, id: "t1" }, { ticker: "NU", status: "CERRADA_STOP", entry_date: "2026-02-01", stop: 1 }];
    const th = levelsFromThesis(theses, "NU");
    expect(th).toMatchObject({ stop: 8, target: 15, thesisId: "t1" });
    expect(effectiveLevels({ stop: null, target: null }, th)).toEqual({ stop: 8, target: 15, source: "tesis" });
    expect(effectiveLevels({ stop: 9, target: null }, th)).toEqual({ stop: 9, target: 15, source: "libro" });
  });
});

describe("positionMetrics", () => {
  const series = Array.from({ length: 40 }, (_, i) => ({ date: day(i), close: 100 + i, high: 101 + i, low: 99 + i }));
  const spy = Array.from({ length: 40 }, (_, i) => ({ date: day(i), close: 400 + i * 2 }));
  const plan = { ticker: "X", qty: 10, avgCost: 110, startDate: day(10), buys: [], sells: [] };

  it("rentabilidad, exceso contra SPY, R y distancias", () => {
    const m = positionMetrics(plan, series, spy, { stop: 100, target: 160 });
    expect(m.price).toBe(139);
    expect(m.ret).toBeCloseTo(139 / 110 - 1);
    expect(m.spyRet).toBeCloseTo(478 / 420 - 1);
    expect(m.r).toBeCloseTo(29 / 10);
    expect(m.toStop).toBeCloseTo(39 / 139);
    expect(m.toTarget).toBeCloseTo(21 / 139);
    expect(m.riskUsd).toBeCloseTo(390);
    expect(m.progress).toBeCloseTo(39 / 60);
    expect(m.stopHit).toBe(false);
    expect(m.sessions).toBe(30);
    expect(m.beta).toBeGreaterThan(0);
  });

  it("detecta el stop tocado desde la compra", () => {
    const m = positionMetrics(plan, series, spy, { stop: 112 });
    expect(m.stopHit).toBe(true);
  });
});

describe("correlationMatrix", () => {
  it("1 en la diagonal y ≈1 entre series proporcionales", () => {
    const a = Array.from({ length: 60 }, (_, i) => ({ date: day(i), close: 100 * (1 + 0.01 * Math.sin(i)) ** i }));
    const b = a.map((p) => ({ date: p.date, close: p.close * 3 }));
    const { matrix } = correlationMatrix({ A: a, B: b }, ["A", "B"], 50);
    expect(matrix[0][0]).toBe(1);
    expect(matrix[0][1]).toBeCloseTo(1);
  });
});

describe("parseYahooNews", () => {
  it("prioriza los titulares del ticker y descarta links que no son https", () => {
    const json = { news: [
      { title: "Otro", link: "https://x/1", publisher: "P", providerPublishTime: 200, relatedTickers: ["AAPL"] },
      { title: "Propio", link: "https://x/2", publisher: "P", providerPublishTime: 100, relatedTickers: ["NVDA"] },
      { title: "Malo", link: "javascript:alert(1)", relatedTickers: ["NVDA"] },
    ] };
    const out = parseYahooNews(json, "NVDA");
    expect(out.map((n) => n.title)).toEqual(["Propio", "Otro"]);
    expect(out[0].time).toBe(new Date(100000).toISOString());
    expect(parseYahooNews(null, "NVDA")).toEqual([]);
  });
});

describe("ledgerSchema: stop y take profit", () => {
  const base = { id: "abc123", date: "2026-01-02", side: "BUY", ticker: "NU", qty: 1, price: 10 };
  it("acepta niveles en compras y los devuelve desde la fila", () => {
    const r = normalizeTransaction({ ...base, stop: 9, target: 14 });
    expect(r.ok).toBe(true);
    expect(r.tx).toMatchObject({ stop: 9, target: 14 });
    expect(rowToTx({ ...base, stop: "9", target: "14" })).toMatchObject({ stop: 9, target: 14 });
  });
  it("rechaza stop sobre el take profit o negativo", () => {
    expect(normalizeTransaction({ ...base, stop: 15, target: 14 }).ok).toBe(false);
    expect(normalizeTransaction({ ...base, stop: -1 }).ok).toBe(false);
  });
});
