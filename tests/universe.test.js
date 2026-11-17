import { describe, it, expect } from "vitest";
import { toGicsL1, gicsFor } from "../lib/gics.js";
import { computeMetrics } from "../lib/edgar.js";
import { qualityGate } from "../lib/scoring.js";
import { MEGACAPS, sectorPercentiles, weekKey, rankMap, rollWeekly, weeklyMarks, scanView, carryTechnical, technicalMeta } from "../lib/universe.js";

describe("SIC de la SEC → GICS", () => {
  const cases = [
    ["Services-Business Services, NEC", "Industrials"],
    ["Services-Educational Services", "Consumer Discretionary"],
    ["Motor Vehicle Parts & Accessories", "Consumer Discretionary"],
    ["Truck & Bus Bodies", "Industrials"],
    ["Electrical Work", "Industrials"],
    ["Operative Builders", "Consumer Discretionary"],
    ["General Bldg Contractors - Residential Bldgs", "Consumer Discretionary"],
    ["Services-Computer Integrated Systems Design", "Information Technology"],
    ["Wholesale-Electronic Parts & Equipment, NEC", "Information Technology"],
    ["Wholesale-Hardware & Plumbing & Heating Equipment & Supplies", "Industrials"],
    ["Services-Offices & Clinics of  Doctors of  Medicine", "Health Care"],
    ["Laboratory Analytical Instruments", "Health Care"],
    ["Concrete Products, Except Block & Brick", "Materials"],
    ["Grain Mill Products", "Consumer Staples"],
    ["Poultry Slaughtering and Processing", "Consumer Staples"],
    ["Retail-Furniture Stores", "Consumer Discretionary"],
    ["Retail-Grocery Stores", "Consumer Staples"],
    ["Retail-Building Materials, Hardware, Garden Supply", "Consumer Discretionary"],
    ["Savings Institution, Federally Chartered", "Financials"],
    ["Industrial Organic Chemicals", "Materials"],
    ["Natural Gas Distribution", "Utilities"],
    ["Telephone Communications (No Radiotelephone)", "Communication Services"],
    ["Wholesale-Drugs Proprietaries & Druggists' Sundries", "Health Care"],
    ["Air-Cond & Warm Air Heatg Equip & Comm & Indl Refrig Equip", "Industrials"],
    ["Pharmaceutical Preparations", "Health Care"],
    ["Semiconductors & Related Devices", "Information Technology"],
    ["Motor Vehicles & Passenger Car Bodies", "Consumer Discretionary"],
    ["Retail-Lumber & Other Building Materials Dealers", "Consumer Discretionary"],
    ["Wholesale-Lumber & Other Construction Materials", "Industrials"],
    ["Gas & Other Services Combined", "Utilities"],
    ["Computer & Office Equipment", "Information Technology"],
    ["Radio & Tv Broadcasting & Communications Equipment", "Information Technology"],
    ["Telephone & Telegraph Apparatus", "Information Technology"],
    ["Services-Commercial Physical & Biological Research", "Health Care"],
    ["Medicinal Chemicals & Botanical Products", "Health Care"],
    ["Guided Missiles & Space Vehicles & Parts", "Industrials"],
    ["Search, Detection, Navigation, Guidance, Aeronautical Sys", "Industrials"],
    ["Refuse Systems", "Industrials"],
    ["Wholesale-Motor Vehicle Supplies & New Parts", "Consumer Discretionary"],
    ["Fabricated Plate Work (Boiler Shops)", "Industrials"],
    ["Power, Distribution & Specialty Transformers", "Industrials"],
    ["Misc Food Preparations & Kindred Products", "Consumer Staples"],
    ["State Commercial Banks", "Financials"],
    ["Electronic Computers", "Information Technology"],
    ["Services-Prepackaged Software", "Information Technology"],
    ["Crude Petroleum & Natural Gas", "Energy"],
    ["Fire, Marine & Casualty Insurance", "Financials"],
    ["Retail-Variety Stores", "Consumer Staples"],
    ["Real Estate Investment Trusts", "Real Estate"],
    ["Electric Services", "Utilities"],
    ["Biological Products, (No Diagnostic Substances)", "Health Care"],
    ["Surgical & Medical Instruments & Apparatus", "Health Care"],
    ["Aircraft Engines & Engine Parts", "Industrials"],
    ["Cable & Other Pay Television Services", "Communication Services"],
    ["Retail-Eating Places", "Consumer Discretionary"],
    ["Hotels & Motels", "Consumer Discretionary"],
    ["Beverages", "Consumer Staples"],
  ];
  it.each(cases)("%s → %s", (sic, gics) => {
    expect(toGicsL1(sic)).toBe(gics);
  });

  it("los overrides por ticker ganan (Visa es Financials aunque su SIC diga servicios)", () => {
    expect(gicsFor("V", "Services-Business Services, NEC")).toBe("Financials");
    expect(gicsFor("GOOGL", "Services-Computer Programming, Data Processing, Etc.")).toBe("Communication Services");
    expect(gicsFor("XYZ", null, "Grain Mill Products")).toBe("Consumer Staples");
    expect(gicsFor("XYZ", null, null)).toBeNull();
  });
});

describe("gate con deuda sin tag", () => {
  const base = { ni: 20, eq: 100, oi: 30, ocf: 40, capex: 10, rev: 200, gp: 80, assets: 150, curA: 60, curL: 30, re: 50 };

  it("sin tags de deuda y balance que cuadra: usa pasivos/patrimonio como techo", () => {
    const f = computeMetrics("X", { ...base, liab: 50 });
    expect(f.debtToEquity).toBeNull();
    expect(f.debtUntagged).toBe(true);
    expect(f.debtToEquityMax).toBeCloseTo(0.5);
    expect(qualityGate(f).pass).toBe(true);
  });

  it("sin pasivos totales los deduce de activos menos patrimonio", () => {
    const f = computeMetrics("X", { ...base, liab: null });
    expect(f.debtToEquityMax).toBeCloseTo(0.5);
    expect(qualityGate(f).pass).toBe(true);
  });

  it("si el techo no alcanza para asegurar D/E < 2, rechaza", () => {
    const f = computeMetrics("X", { ...base, assets: 400, liab: 300 });
    expect(qualityGate(f).pass).toBe(false);
  });

  it("si el balance no cuadra, no se asume nada", () => {
    const f = computeMetrics("X", { ...base, liab: 10 });
    expect(f.debtUntagged).toBe(false);
    expect(qualityGate(f).pass).toBe(false);
  });

  it("con deuda tageada sigue mandando el D/E real", () => {
    const f = computeMetrics("X", { ...base, liab: 50, ltd: 30, std: 0 });
    expect(f.debtToEquity).toBeCloseTo(0.3);
    expect(f.debtUntagged).toBe(false);
  });
});

describe("percentil de preScore dentro del sector", () => {
  it("rankea dentro de cada sector y deja null sectores chicos o sin sector", () => {
    const gems = {};
    for (let i = 0; i < 5; i++) gems[`T${i}`] = { symbol: `T${i}`, gatePass: true, gicsSector: "Information Technology", preScore: 50 + i * 10 };
    gems.F0 = { symbol: "F0", gatePass: true, gicsSector: "Financials", preScore: 90 };
    gems.N0 = { symbol: "N0", gatePass: true, gicsSector: null, preScore: 70 };
    const pct = sectorPercentiles(gems, 5);
    expect(pct.T4).toBe(1);
    expect(pct.T0).toBe(0);
    expect(pct.T2).toBeCloseTo(0.5);
    expect(pct.F0).toBeNull();
    expect(pct.N0).toBeNull();
  });
});

describe("marcas semanales", () => {
  it("weekKey devuelve el lunes de la semana", () => {
    expect(weekKey("2026-11-17")).toBe("2026-11-16");
    expect(weekKey("2026-11-16")).toBe("2026-11-16");
    expect(weekKey("2026-11-22")).toBe("2026-11-16");
  });

  it("rankMap ordena por preScore entre los que pasan el gate", () => {
    const gems = { A: { gatePass: true, preScore: 80 }, B: { gatePass: true, preScore: 90 }, C: { gatePass: false, preScore: 99 } };
    expect(rankMap(gems)).toEqual({ B: 1, A: 2 });
  });

  it("rollWeekly rota al cambiar de semana y actualiza dentro de la misma", () => {
    const first = rollWeekly(null, "2026-11-17", { A: 1 });
    expect(first).toEqual({ current: { weekOf: "2026-11-16", ranks: { A: 1 } }, prev: null });
    const same = rollWeekly(first, "2026-11-19", { A: 2 });
    expect(same.current.ranks).toEqual({ A: 2 });
    expect(same.prev).toBeNull();
    const next = rollWeekly(same, "2026-11-24", { A: 3 });
    expect(next.prev).toEqual({ weekOf: "2026-11-16", ranks: { A: 2 } });
    expect(next.current.weekOf).toBe("2026-11-23");
  });

  it("weeklyMarks: NUEVO, SUBE, BAJA o nada", () => {
    const prev = { A: 5, B: 50, C: 20 };
    const now = { A: 6, B: 10, C: 60, D: 3 };
    const marks = weeklyMarks(now, prev, { topN: 100, move: 10 });
    expect(marks.D).toEqual({ mark: "NUEVO", rankPrev: null });
    expect(marks.B).toEqual({ mark: "SUBE", rankPrev: 50 });
    expect(marks.C).toEqual({ mark: "BAJA", rankPrev: 20 });
    expect(marks.A).toEqual({ mark: null, rankPrev: 5 });
  });

  it("sin semana anterior no marca nada", () => {
    expect(weeklyMarks({ A: 1 }, null).A).toEqual({ mark: null, rankPrev: null });
  });
});

describe("scanView", () => {
  const gem = (symbol, gicsSector, preScore, extra = {}) => ({ symbol, gicsSector, preScore, gatePass: true, ...extra });
  const gems = {
    A: gem("A", "Energy", 90), B: gem("B", "Energy", 80), C: gem("C", "Energy", 70), D: gem("D", "Energy", 60),
    E: gem("E", "Utilities", 50), F: gem("F", null, 99),
    M: gem("M", "Information Technology", 40, { gatePass: false, megacap: true, marketCap: 3e12 }),
    N: gem("N", "Information Technology", 85, { megacap: true, marketCap: 1e12 }),
  };

  it("descubrimiento con máximo 3 por sector y megacaps aparte", () => {
    const v = scanView(gems, { perSector: 3 });
    expect(v.discovery.Energy.map((g) => g.symbol)).toEqual(["A", "B", "C"]);
    expect(v.discovery.Utilities.map((g) => g.symbol)).toEqual(["E"]);
    expect(v.discovery["Sin sector"].map((g) => g.symbol)).toEqual(["F"]);
    expect(v.megacaps.map((g) => g.symbol)).toEqual(["M", "N"]);
    expect(v.discovery["Information Technology"].map((g) => g.symbol)).toEqual(["N"]);
  });

  it("la lista de megacaps trae a los que faltaban", () => {
    for (const t of ["GOOGL", "META", "AVGO", "AMD", "TSLA", "V", "MA"]) expect(MEGACAPS).toContain(t);
  });
});

describe("conservar lo técnico entre corridas", () => {
  it("copia solo los campos técnicos definidos", () => {
    expect(carryTechnical({ trendScore: 70, trendLabel: "EN ZONA", preScore: 80, roe: 0.2 })).toEqual({ trendScore: 70, trendLabel: "EN ZONA" });
    expect(carryTechnical(undefined)).toEqual({});
    expect(technicalMeta({ market: { regime: 1 }, updatedAt: "x", trendScored: 5 })).toEqual({ market: { regime: 1 }, trendScored: 5 });
  });
});
