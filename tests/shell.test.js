import { describe, it, expect } from "vitest";
import { marketStatus } from "../src/lib/marketClock.js";
import { buildCommands, filterCommands, parseTicker, parseOrder } from "../src/lib/commands.js";

describe("marketStatus (NYSE, hora de Nueva York)", () => {
  it("marca abierto un lunes a las 10:00 ET", () => {
    // 16-nov-2026 es lunes; 15:00 UTC = 10:00 ET (horario estándar, UTC-5).
    const s = marketStatus(new Date("2026-11-16T15:00:00Z"));
    expect(s.open).toBe(true);
    expect(s.time).toBe("10:00");
    expect(s.label).toBe("Mercado abierto");
  });

  it("marca cerrado antes de las 9:30 ET", () => {
    const s = marketStatus(new Date("2026-11-16T14:29:00Z"));
    expect(s.open).toBe(false);
    expect(s.label).toBe("Pre-mercado");
  });

  it("abre exactamente a las 9:30 y cierra a las 16:00 ET", () => {
    expect(marketStatus(new Date("2026-11-16T14:30:00Z")).open).toBe(true);
    expect(marketStatus(new Date("2026-11-16T20:59:00Z")).open).toBe(true);
    const closed = marketStatus(new Date("2026-11-16T21:00:00Z"));
    expect(closed.open).toBe(false);
    expect(closed.label).toBe("Mercado cerrado");
  });

  it("marca cerrado el fin de semana", () => {
    const s = marketStatus(new Date("2026-11-14T16:00:00Z")); // sábado
    expect(s.open).toBe(false);
    expect(s.label).toBe("Fin de semana");
  });

  it("respeta el horario de verano (UTC-4)", () => {
    // 15-jun-2026 es lunes; 13:30 UTC = 9:30 ET en verano.
    expect(marketStatus(new Date("2026-06-15T13:30:00Z")).open).toBe(true);
    expect(marketStatus(new Date("2026-06-15T13:29:00Z")).open).toBe(false);
  });
});

describe("paleta de comandos", () => {
  const pages = [
    { to: "/", label: "Optimizer", hint: "Markowitz" },
    { to: "/thesis", label: "Thesis Log", hint: "Tracker de tesis" },
    { to: "/risk", label: "Risk Engine", hint: "VaR" },
  ];

  it("parseTicker acepta símbolos válidos y los pasa a mayúsculas", () => {
    expect(parseTicker("nvda")).toBe("NVDA");
    expect(parseTicker(" brk.b ")).toBe("BRK.B");
    expect(parseTicker("thesis log")).toBe(null);
    expect(parseTicker("")).toBe(null);
    expect(parseTicker("DEMASIADOLARGO")).toBe(null);
  });

  it("sin texto devuelve todas las páginas", () => {
    const all = filterCommands("", buildCommands(pages, ""));
    expect(all.map((c) => c.label)).toEqual(["Optimizer", "Thesis Log", "Risk Engine"]);
  });

  it("filtra por nombre o descripción sin distinguir mayúsculas ni tildes", () => {
    const out = filterCommands("tésis", buildCommands(pages, "tésis"));
    expect(out[0].label).toBe("Thesis Log");
  });

  it("ofrece abrir el gráfico cuando el texto parece un ticker", () => {
    const out = filterCommands("nvda", buildCommands(pages, "nvda"));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ to: "/chart?t=NVDA", label: "Ver gráfico de NVDA" });
    expect(out[1]).toMatchObject({ to: "/?side=BUY&t=NVDA", label: "Comprar NVDA" });
  });

  it("entiende órdenes rápidas en inglés y español", () => {
    expect(parseOrder("buy nu 100")).toEqual({ side: "BUY", ticker: "NU", qty: 100 });
    expect(parseOrder("v mu 5")).toEqual({ side: "SELL", ticker: "MU", qty: 5 });
    expect(parseOrder("comprar voo")).toEqual({ side: "BUY", ticker: "VOO", qty: null });
    expect(parseOrder("buy nu -3")).toBe(null);
    expect(parseOrder("nvda")).toBe(null);
    const out = filterCommands("sell nu 10", buildCommands(pages, "sell nu 10"));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ to: "/?side=SELL&t=NU&q=10", label: "Vender 10 NU" });
  });

  it("no muta la lista de páginas recibida", () => {
    const frozen = Object.freeze(pages.map((p) => Object.freeze({ ...p })));
    expect(() => filterCommands("risk", buildCommands(frozen, "risk"))).not.toThrow();
  });
});
