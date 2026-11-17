import { describe, it, expect } from "vitest";
import { windowStart, recentReporters, withReactions, toSeries } from "../lib/eventsScan.js";

const day = (iso) => Date.parse(`${iso}T20:00:00Z`) / 1000;
const candles = (rows) => rows.map(([d, c]) => ({ t: day(d), c }));
const filing = (date, time, items = "2.02,9.01", form = "8-K") => ({
  form: [form], items: [items], filingDate: [date], acceptanceDateTime: [`${date}T${time}.000Z`],
});

describe("eventsScan", () => {
  const spy = toSeries(candles([["2026-11-09", 1], ["2026-11-10", 1], ["2026-11-11", 1], ["2026-11-12", 1], ["2026-11-13", 1], ["2026-11-16", 1], ["2026-11-17", 1]]));

  it("la ventana arranca 5 sesiones atrás según el calendario de SPY", () => {
    expect(windowStart(spy, 5)).toBe("2026-11-11");
    expect(windowStart([], 5)).toBeNull();
  });

  it("solo toma 8-K con ítem 2.02 dentro de la ventana", () => {
    const filings = new Map([
      ["DUOL", { name: "Duolingo", recent: filing("2026-11-12", "21:05:00") }],
      ["OLD", { name: "Old", recent: filing("2026-11-03", "21:05:00") }],
      ["NOT", { name: "Not", recent: filing("2026-11-13", "12:00:00", "5.02") }],
    ]);
    const r = recentReporters(filings, "2026-11-11");
    expect(r.map((x) => x.ticker)).toEqual(["DUOL"]);
    expect(r[0].timing).toBe("DESPUES_CIERRE");
  });

  it("calcula la reacción y ordena por fecha y tamaño", () => {
    const reporters = [
      { ticker: "A", nyDate: "2026-11-12", timing: "DESPUES_CIERRE" },
      { ticker: "B", nyDate: "2026-11-12", timing: "DESPUES_CIERRE" },
      { ticker: "C", nyDate: "2026-11-16", timing: "ANTES_APERTURA" },
    ];
    const map = new Map([
      ["A", candles([["2026-11-12", 100], ["2026-11-13", 102]])],
      ["B", candles([["2026-11-12", 100], ["2026-11-13", 80]])],
      ["C", candles([["2026-11-13", 50], ["2026-11-16", 55]])],
    ]);
    const out = withReactions(reporters, map);
    expect(out.map((x) => x.ticker)).toEqual(["C", "B", "A"]);
    expect(out[1].reaction).toBeCloseTo(-0.2);
    expect(out[0].reaction).toBeCloseTo(0.1);
  });

  it("sin velas la reacción queda en null", () => {
    expect(withReactions([{ ticker: "X", nyDate: "2026-11-12", timing: "EN_SESION" }], new Map())[0].reaction).toBeNull();
  });
});
