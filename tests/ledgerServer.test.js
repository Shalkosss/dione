import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normalizeTransaction, normalizeBenchmark, rowToTx, rowToBenchmark, MAX_TX_PER_ACCOUNT } from "../lib/ledgerSchema.js";
import { planAccountWrite } from "../lib/ledgerApi.js";

vi.mock("../lib/ledgerStore.js", () => ({
  readLedger: vi.fn(),
  readAccount: vi.fn(),
  replaceAccount: vi.fn(),
  replaceBenchmarks: vi.fn(),
}));
const store = await import("../lib/ledgerStore.js");
const { handleLedger } = await import("../lib/ledgerApi.js");
const { default: thesisIdHandler } = await import("../api/theses/[id].js");

const buy = (id, date, ticker, qty, price) => ({ id, date, side: "BUY", ticker, qty, price });
const sell = (id, date, ticker, qty, price) => ({ id, date, side: "SELL", ticker, qty, price });
const account = (transactions = [], version = 3, initialCash = 10000) => ({ id: "paper", initialCash, version, transactions });

describe("normalizeTransaction", () => {
  it("acepta una compra válida y pasa el ticker a mayúsculas", () => {
    const r = normalizeTransaction({ id: "abc123", date: "2026-11-10", side: "BUY", ticker: "nu", qty: 10, price: 12.5 });
    expect(r.ok).toBe(true);
    expect(r.tx).toEqual({ id: "abc123", date: "2026-11-10", side: "BUY", ticker: "NU", qty: 10, price: 12.5 });
  });

  it("rechaza id, fecha, cantidad, precio y lado inválidos", () => {
    expect(normalizeTransaction({ id: "x", date: "2026-11-10", side: "BUY", ticker: "NU", qty: 1, price: 1 }).ok).toBe(false);
    expect(normalizeTransaction({ id: "abc123", date: "2026-13-40", side: "BUY", ticker: "NU", qty: 1, price: 1 }).ok).toBe(false);
    expect(normalizeTransaction({ id: "abc123", date: "2026-11-10", side: "BUY", ticker: "NU", qty: 0, price: 1 }).ok).toBe(false);
    expect(normalizeTransaction({ id: "abc123", date: "2026-11-10", side: "SELL", ticker: "NU", qty: 1 }).ok).toBe(false);
    expect(normalizeTransaction({ id: "abc123", date: "2026-11-10", side: "SHORT", ticker: "NU", qty: 1, price: 1 }).ok).toBe(false);
    expect(normalizeTransaction("texto").ok).toBe(false);
  });

  it("en aportes y retiros descarta ticker y precio", () => {
    const r = normalizeTransaction({ id: "dep-001", date: "2026-11-10", side: "DEPOSIT", ticker: "NU", qty: 500, price: 3 });
    expect(r.tx).toEqual({ id: "dep-001", date: "2026-11-10", side: "DEPOSIT", qty: 500 });
  });

  it("rechaza notas y sectores demasiado largos", () => {
    expect(normalizeTransaction({ ...buy("abc123", "2026-11-10", "NU", 1, 1), note: "x".repeat(281) }).ok).toBe(false);
    expect(normalizeTransaction({ ...buy("abc123", "2026-11-10", "NU", 1, 1), sector: "x".repeat(41) }).ok).toBe(false);
  });
});

describe("normalizeBenchmark y filas", () => {
  const ok = { id: "claude", name: "Claude", color: "#d98a5f", startDate: "2026-11-01", weights: { NVDA: 0.5, MU: 0.5 } };

  it("acepta una cartera válida", () => {
    expect(normalizeBenchmark(ok).ok).toBe(true);
  });

  it("rechaza color no hex, pesos fuera de rango e id inválido", () => {
    expect(normalizeBenchmark({ ...ok, color: "red" }).ok).toBe(false);
    expect(normalizeBenchmark({ ...ok, weights: { NVDA: 1.5 } }).ok).toBe(false);
    expect(normalizeBenchmark({ ...ok, weights: { NVDA: 0 } }).ok).toBe(false);
    expect(normalizeBenchmark({ ...ok, id: "Con Espacio" }).ok).toBe(false);
  });

  it("rowToTx quita los campos de SQL y los nulos", () => {
    const tx = rowToTx({ account: "paper", id: "abc123", date: "2026-11-10", side: "BUY", ticker: "NU", qty: "10", price: "12.5", sector: null, note: null, pos: 0, created_at: "x" });
    expect(tx).toEqual({ id: "abc123", date: "2026-11-10", side: "BUY", ticker: "NU", qty: 10, price: 12.5 });
  });

  it("rowToBenchmark pasa a camelCase", () => {
    expect(rowToBenchmark({ id: "grok", name: "Grok", color: "#b08cff", start_date: "2026-11-01", weights: {}, pos: 1 }))
      .toEqual({ id: "grok", name: "Grok", color: "#b08cff", startDate: "2026-11-01", weights: {} });
  });
});

describe("planAccountWrite", () => {
  it("reemplaza el libro y usa la versión enviada", () => {
    const plan = planAccountWrite(account([], 3), { baseVersion: 3, transactions: [buy("abc123", "2026-11-10", "NU", 10, 12)] });
    expect(plan.ok).toBe(true);
    expect(plan.rpc.expectedVersion).toBe(3);
    expect(plan.rpc.rows).toHaveLength(1);
  });

  it("rechaza un libro sin caja suficiente", () => {
    const plan = planAccountWrite(account(), { baseVersion: 3, transactions: [buy("abc123", "2026-11-10", "NVDA", 1000, 200)] });
    expect(plan.ok).toBe(false);
    expect(plan.status).toBe(400);
    expect(plan.errors.length).toBeGreaterThan(0);
  });

  it("rechaza vender lo que no se tiene", () => {
    const plan = planAccountWrite(account(), { baseVersion: 3, transactions: [sell("abc123", "2026-11-10", "NU", 1, 12)] });
    expect(plan.ok).toBe(false);
  });

  it("rechaza ids repetidos", () => {
    const plan = planAccountWrite(account(), { baseVersion: 3, transactions: [buy("abc123", "2026-11-10", "NU", 1, 12), buy("abc123", "2026-11-11", "NU", 1, 12)] });
    expect(plan.ok).toBe(false);
    expect(plan.status).toBe(400);
  });

  it("rechaza libros demasiado grandes", () => {
    const many = Array.from({ length: MAX_TX_PER_ACCOUNT + 1 }, (_, i) => ({ id: `dep-${String(i).padStart(5, "0")}`, date: "2026-11-10", side: "DEPOSIT", qty: 1 }));
    expect(planAccountWrite(account(), { baseVersion: 3, transactions: many }).ok).toBe(false);
  });

  it("baseVersion null fuerza la escritura sin comprobar versión", () => {
    const plan = planAccountWrite(account(), { baseVersion: null, transactions: [] });
    expect(plan.rpc.expectedVersion).toBeNull();
  });

  it("sin transacciones solo cambia el capital, y valida el libro existente", () => {
    const current = account([buy("abc123", "2026-11-10", "NU", 100, 50)], 3, 10000);
    expect(planAccountWrite(current, { baseVersion: 3, initialCash: 20000 }).rpc.rows).toHaveLength(1);
    expect(planAccountWrite(current, { baseVersion: 3, initialCash: 1000 }).ok).toBe(false);
  });

  it("rechaza cuerpo sin forma de objeto o sin baseVersion", () => {
    expect(planAccountWrite(account(), "hola").status).toBe(400);
    expect(planAccountWrite(account(), { transactions: [] }).status).toBe(400);
  });
});

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (method, query = {}, body, token = "secreto") => ({
  method, query: { id: "ledger", ...query }, body, headers: token ? { authorization: `Bearer ${token}` } : {},
});

describe("handleLedger", () => {
  beforeEach(() => { process.env.THESES_TOKEN = "secreto"; vi.clearAllMocks(); });
  afterEach(() => { delete process.env.THESES_TOKEN; });

  it("GET con token devuelve cuentas y referencias", async () => {
    store.readLedger.mockResolvedValue({ accounts: { paper: account() }, benchmarks: [] });
    const res = mockRes();
    await handleLedger(req("GET"), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.accounts.paper.version).toBe(3);
  });

  it("GET sin token o con token malo da 401; sin THESES_TOKEN da 503", async () => {
    let res = mockRes();
    await handleLedger(req("GET", {}, undefined, null), res);
    expect(res.statusCode).toBe(401);
    res = mockRes();
    await handleLedger(req("GET", {}, undefined, "otro"), res);
    expect(res.statusCode).toBe(401);
    delete process.env.THESES_TOKEN;
    res = mockRes();
    await handleLedger(req("GET"), res);
    expect(res.statusCode).toBe(503);
  });

  it("PUT a una cuenta desconocida da 400", async () => {
    const res = mockRes();
    await handleLedger(req("PUT", { account: "otra" }, { baseVersion: 0, transactions: [] }), res);
    expect(res.statusCode).toBe(400);
  });

  it("PUT válido escribe y devuelve la cuenta nueva", async () => {
    store.readAccount.mockResolvedValueOnce(account([], 3)).mockResolvedValueOnce(account([buy("abc123", "2026-11-10", "NU", 10, 12)], 4));
    store.replaceAccount.mockResolvedValue(4);
    const res = mockRes();
    await handleLedger(req("PUT", { account: "paper" }, { baseVersion: 3, transactions: [buy("abc123", "2026-11-10", "NU", 10, 12)] }), res);
    expect(res.statusCode).toBe(200);
    expect(store.replaceAccount).toHaveBeenCalledWith(expect.objectContaining({ account: "paper", expectedVersion: 3 }));
    expect(res.body.data.account.version).toBe(4);
  });

  it("conflicto de versión da 409 con la cuenta del servidor", async () => {
    store.readAccount.mockResolvedValue(account([], 5));
    store.replaceAccount.mockRejectedValue(Object.assign(new Error("x"), { code: "CONFLICT" }));
    const res = mockRes();
    await handleLedger(req("PUT", { account: "paper" }, { baseVersion: 3, transactions: [] }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.data.code).toBe("VERSION_CONFLICT");
    expect(res.body.data.account.version).toBe(5);
  });

  it("sin migración da 503 con código LEDGER_NOT_MIGRATED", async () => {
    store.readLedger.mockRejectedValue(Object.assign(new Error("x"), { code: "NOT_MIGRATED" }));
    const res = mockRes();
    await handleLedger(req("GET"), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.data.code).toBe("LEDGER_NOT_MIGRATED");
  });

  it("PUT de referencias valida y guarda la lista", async () => {
    store.replaceBenchmarks.mockImplementation(async (list) => list);
    const res = mockRes();
    const list = [{ id: "claude", name: "Claude", color: "#d98a5f", startDate: "2026-11-01", weights: { NVDA: 1 } }];
    await handleLedger(req("PUT", { resource: "benchmarks" }, { benchmarks: list }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.benchmarks).toHaveLength(1);
  });

  it("método no admitido da 405 con Allow", async () => {
    const res = mockRes();
    await handleLedger(req("PATCH"), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, PUT");
  });
});

describe("api/theses/[id].js sigue igual para las tesis", () => {
  it("POST a una tesis sigue dando 405", async () => {
    const res = mockRes();
    await thesisIdHandler({ method: "POST", query: { id: "MU-2026-11-14" }, headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("despacha /api/theses/ledger al libro", async () => {
    process.env.THESES_TOKEN = "secreto";
    store.readLedger.mockResolvedValue({ accounts: {}, benchmarks: [] });
    const res = mockRes();
    await thesisIdHandler(req("GET"), res);
    expect(res.statusCode).toBe(200);
    delete process.env.THESES_TOKEN;
  });
});
