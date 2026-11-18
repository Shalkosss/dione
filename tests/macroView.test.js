import { describe, it, expect } from "vitest";
import { normalizeMacroView, overweightFor } from "../lib/macroView.js";

describe("normalizeMacroView", () => {
  it("acepta nombres GICS o cortos y deduplica", () => {
    const r = normalizeMacroView({ overweight: ["Information Technology", "Technology", "Energy"], underweight: ["utilities"], asOf: "2026-11-18", note: "x" });
    expect(r.ok).toBe(true);
    expect(r.view).toEqual({ overweight: ["Information Technology", "Energy"], underweight: ["Utilities"], asOf: "2026-11-18", note: "x" });
  });

  it("rechaza sectores desconocidos, listas que se pisan y fechas mal escritas", () => {
    expect(normalizeMacroView({ overweight: ["Crypto"] }).errors[0]).toMatch(/desconocido/);
    expect(normalizeMacroView({ overweight: ["Energy"], underweight: ["Energy"] }).errors[0]).toMatch(/dos listas/);
    expect(normalizeMacroView({ overweight: [], asOf: "18/11/2026" }).errors[0]).toMatch(/asOf/);
    expect(normalizeMacroView({ overweight: "Energy" }).ok).toBe(false);
    expect(normalizeMacroView(null).ok).toBe(false);
  });
});

describe("overweightFor", () => {
  const view = { overweight: ["Energy"], asOf: "2026-11-01" };
  it("devuelve la lista si la vista tiene menos de 60 días", () => {
    expect(overweightFor(view, "2026-11-18")).toEqual(["Energy"]);
  });
  it("una vista vieja o ausente deja la regla inactiva (null), no marca todo", () => {
    expect(overweightFor(view, "2027-02-01")).toBeNull();
    expect(overweightFor(null)).toBeNull();
  });
});
