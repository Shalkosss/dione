import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchCompanyFacts = vi.fn();
const store = { row: null, written: null };
vi.mock("../lib/edgar.js", () => ({ fetchCompanyFacts: (...a) => fetchCompanyFacts(...a) }));
vi.mock("../lib/store.js", () => ({
  readRow: async () => store.row,
  writeRow: async (_id, data) => { store.written = data; },
}));
const { loadForeignFacts } = await import("../lib/foreignFacts.js");

const annualEur = (val) => ({ facts: { "ifrs-full": { ProfitLoss: { units: { EUR: [{ start: "2025-01-01", end: "2025-12-31", val, form: "20-F", fp: "FY", filed: "2026-03-01" }] } } } } });

beforeEach(() => {
  fetchCompanyFacts.mockReset();
  store.row = null;
  store.written = null;
});

describe("loadForeignFacts", () => {
  it("con el tope vencido no pide nada ni escribe", async () => {
    const r = await loadForeignFacts([1, 2], { deadline: Date.now() - 1 });
    expect(fetchCompanyFacts).not.toHaveBeenCalled();
    expect(store.written).toBeNull();
    expect(r.stats).toMatchObject({ fetched: 0, pending: 2 });
  });

  it("baja lo que falta, guarda el cache y marca los que no tienen XBRL", async () => {
    store.row = { byCik: { 1: { fetchedAt: new Date().toISOString(), raw: { ni: 1 } } } };
    fetchCompanyFacts.mockImplementation(async (cik) => (cik === 3 ? null : annualEur(5)));
    const r = await loadForeignFacts([1, 2, 3], { today: "2026-11-17" });
    expect(fetchCompanyFacts).toHaveBeenCalledTimes(2);
    expect(r.byCik[2].raw).toMatchObject({ ni: 5, currency: "EUR" });
    expect(r.byCik[3]).toMatchObject({ raw: null, reason: "sin XBRL en EDGAR" });
    expect(store.written.byCik[1].raw.ni).toBe(1);
  });

  it("un error de red no se cachea: se reintenta otro día", async () => {
    fetchCompanyFacts.mockRejectedValue(new Error("HTTP_503"));
    const r = await loadForeignFacts([9]);
    expect(r.byCik[9]).toBeUndefined();
    expect(r.stats.failed).toBe(1);
  });
});
