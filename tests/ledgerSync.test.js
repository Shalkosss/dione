import { describe, it, expect } from "vitest";
import { decideAccountSync, decideBenchmarkSync, sameBook } from "../src/lib/ledgerSync.js";

const tx = (id) => ({ id, date: "2026-11-10", side: "DEPOSIT", qty: 1 });
const local = (transactions = [], version = null, pending = false, initialCash = 1000) => ({ initialCash, transactions, version, pending });
const remote = (transactions = [], version = 0, initialCash = 1000) => ({ id: "paper", initialCash, transactions, version });

describe("decideAccountSync", () => {
  it("sin respuesta del servidor no hace nada", () => {
    expect(decideAccountSync(local([tx("a")]), null, true)).toBe("none");
  });

  it("nunca sincronizó y local vacío: adopta el servidor", () => {
    expect(decideAccountSync(local(), remote([tx("a")], 2), true)).toBe("adopt");
  });

  it("nunca sincronizó, local con datos y servidor vacío: primera subida", () => {
    expect(decideAccountSync(local([tx("a")]), remote(), true)).toBe("push");
  });

  it("primera subida sin token pide token", () => {
    expect(decideAccountSync(local([tx("a")]), remote(), false)).toBe("needToken");
  });

  it("nunca sincronizó, mismos datos en ambos: adopta", () => {
    expect(decideAccountSync(local([tx("a"), tx("b")]), remote([tx("b"), tx("a")], 4), true)).toBe("adopt");
  });

  it("nunca sincronizó, datos distintos: conflicto", () => {
    expect(decideAccountSync(local([tx("a")]), remote([tx("b")], 4), true)).toBe("conflict");
  });

  it("sincronizado sin pendientes y misma versión: nada", () => {
    expect(decideAccountSync(local([tx("a")], 4), remote([tx("a")], 4), true)).toBe("none");
  });

  it("sincronizado sin pendientes y versión nueva: gana el servidor", () => {
    expect(decideAccountSync(local([tx("a")], 4), remote([tx("b")], 6), true)).toBe("adopt");
  });

  it("con pendientes y misma versión: sube", () => {
    expect(decideAccountSync(local([tx("a"), tx("b")], 4, true), remote([tx("a")], 4), true)).toBe("push");
    expect(decideAccountSync(local([tx("a"), tx("b")], 4, true), remote([tx("a")], 4), false)).toBe("needToken");
  });

  it("capital cambiado sin órdenes y servidor vacío: sube", () => {
    expect(decideAccountSync(local([], null, true, 7000), remote([], 0, 5000), true)).toBe("push");
  });

  it("servidor con versión más vieja que la local (base recreada): conflicto", () => {
    expect(decideAccountSync(local([tx("a")], 5), remote([], 0), true)).toBe("conflict");
  });

  it("con pendientes y otra versión: conflicto", () => {
    expect(decideAccountSync(local([tx("a"), tx("b")], 4, true), remote([tx("a")], 5), true)).toBe("conflict");
  });
});

describe("sameBook", () => {
  it("ignora el orden y detecta capital distinto", () => {
    expect(sameBook(local([tx("a"), tx("b")]), remote([tx("b"), tx("a")]))).toBe(true);
    expect(sameBook(local([tx("a")], null, false, 1000), remote([tx("a")], 0, 2000))).toBe(false);
    expect(sameBook(local([tx("a")]), remote([tx("a"), tx("b")]))).toBe(false);
  });
});

describe("decideBenchmarkSync", () => {
  const bench = [{ id: "claude" }];
  it("sin servidor no hace nada", () => {
    expect(decideBenchmarkSync(bench, false, null)).toBe("none");
  });
  it("servidor vacío: sube las locales", () => {
    expect(decideBenchmarkSync(bench, false, [])).toBe("push");
  });
  it("servidor con datos y sin pendientes: adopta", () => {
    expect(decideBenchmarkSync(bench, false, [{ id: "grok" }])).toBe("adopt");
  });
  it("con pendientes: sube", () => {
    expect(decideBenchmarkSync(bench, true, [{ id: "grok" }])).toBe("push");
  });
});
