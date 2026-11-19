// tests/chartWyckoff.test.js — detector Wyckoff del módulo Chart (src/lib/wyckoff.js)
// contra las reglas de WYCKOFF_FRAMEWORK.md (revisión 8-nov-2026).
import { describe, it, expect } from "vitest";
import { detectWyckoffEvents, springVolumeClass, wyckoffPhase } from "../src/lib/wyckoff.js";
import { relVolume } from "../src/lib/indicators.js";

const day = (i) => new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const bar = (i, o, h, l, c, v = 1000) => ({ date: day(i), open: o, high: h, low: l, close: c, volume: v });

// 70 velas laterales entre 99 y 101 (mínimo del rango = 99).
function base(n = 70) {
  return Array.from({ length: n }, (_, i) => bar(i, 100, 101, 99, 100));
}

describe("relVolume", () => {
  it("divide por el promedio de las sesiones ANTERIORES, sin contar el día", () => {
    const v = [10, 10, 10, 10, 40];
    const r = relVolume(v, 4);
    expect(r[3]).toBe(null);
    expect(r[4]).toBe(4); // 40 / promedio(10,10,10,10)
  });
});

describe("springVolumeClass", () => {
  it("clasifica sin decidir: seco, moderado, shakeout", () => {
    expect(springVolumeClass(0.5)).toBe("seco");
    expect(springVolumeClass(1.2)).toBe("moderado");
    expect(springVolumeClass(2)).toBe("shakeout");
  });
});

describe("Spring y Test", () => {
  it("Spring (B) con volumen alto también cuenta: el volumen no es compuerta", () => {
    const cs = base();
    // perfora 99 y cierra encima, con 3× volumen → shakeout
    cs.push(bar(70, 99.5, 100, 96, 99.5, 3000));
    for (let i = 71; i < 80; i++) cs.push(bar(i, 100, 101, 99.5, 100.5));
    const { events } = detectWyckoffEvents(cs);
    const spring = events.find((e) => e.type === "Spring");
    expect(spring).toBeTruthy();
    expect(spring.variant).toBe("B");
    expect(spring.volClass).toBe("shakeout");
    expect(spring.price).toBe(96);
  });

  it("Spring (A) con test confirmado: rebote ≥ 5% y vuelta a la zona cerrando arriba", () => {
    const cs = base();
    cs.push(bar(70, 99, 99, 95, 96, 600)); // cierra bajo 99
    cs.push(bar(71, 96, 100.5, 96, 100)); // recupera: e = 71, spring_low = 95
    cs.push(bar(72, 100, 102, 99.5, 101.5)); // rebote: cierre ≥ 95 × 1.05 = 99.75
    cs.push(bar(73, 101, 101.5, 99.5, 101)); // low 99.5 ≤ 99.75, cierra en la mitad superior → test
    for (let i = 74; i < 80; i++) cs.push(bar(i, 101, 102, 100, 101.5));
    const { events } = detectWyckoffEvents(cs);
    const spring = events.find((e) => e.type === "Spring");
    expect(spring.variant).toBe("A");
    expect(spring.volClass).toBe("seco");
    expect(spring.status).toBe("confirmado");
    const test = events.find((e) => e.type === "Test");
    expect(test.date).toBe(day(73));
    expect(test.level).toBe(95);
  });

  it("un nuevo mínimo bajo el spring_low antes del test lo invalida", () => {
    const cs = base();
    cs.push(bar(70, 99.5, 100, 96, 99.5));
    cs.push(bar(71, 99.5, 100, 98, 99));
    cs.push(bar(72, 99, 99, 94, 95)); // perfora 96
    for (let i = 73; i < 95; i++) cs.push(bar(i, 95, 96, 94.5, 95.5));
    const spring = detectWyckoffEvents(cs).events.find((e) => e.type === "Spring" && e.idx === 70);
    expect(spring.status).toBe("invalidado");
  });

  it("si la primera vuelta a la zona cierra en la mitad inferior, el test queda pendiente", () => {
    const cs = base();
    cs.push(bar(70, 99.5, 100, 96, 99.5));
    cs.push(bar(71, 100, 102, 99.5, 101.5)); // rebote
    cs.push(bar(72, 101, 101.5, 97, 97.5)); // vuelve a la zona (≤ 100.8), cierra abajo
    for (let i = 73; i < 76; i++) cs.push(bar(i, 98, 99, 97.5, 98.5));
    const spring = detectWyckoffEvents(cs).events.find((e) => e.type === "Spring");
    expect(spring.status).toBe("pendiente");
    expect(spring.note).toMatch(/mitad inferior/);
  });
});

describe("wyckoffPhase", () => {
  it("fase C con un Spring reciente; null sin eventos", () => {
    const cs = base();
    cs.push(bar(70, 99.5, 100, 96, 99.5));
    for (let i = 71; i < 80; i++) cs.push(bar(i, 100, 101, 99.5, 100.5));
    const { events } = detectWyckoffEvents(cs);
    expect(wyckoffPhase(events, cs).phase).toBe("C");
    expect(wyckoffPhase([], cs)).toBe(null);
  });
});
