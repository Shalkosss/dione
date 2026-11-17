import { describe, it, expect } from "vitest";
import { accountState, validateOrder, closeOn, equityCurve, twrIndex, modelIndex, valuedPositions, parseWeights, formatWeights, ledgerIssues } from "../src/lib/ledger.js";
import {
  dailyReturns, alignSeries, totalReturn, trailingReturn, ytdReturn, maxDrawdown, drawdownSeries,
  alphaBeta, trackingError, informationRatio, hitRate, sharpe, monthlyReturns, summarize,
} from "../src/lib/perf.js";
import { sleeveOf, sectorExposure, activeWeights, sleeveWeights, mandateChecks, SPY_WEIGHTS, CASH } from "../src/lib/sectors.js";
import { extractEarnings, earningsReaction, filingTiming, parseTickers } from "../lib/earningsEvents.js";
import { lastSma, distanceToSma200, sectorBoard, marketRegime } from "../src/lib/marketBoard.js";

const series = (values, start = 1) => values.map((value, i) => ({ date: `2026-01-${String(start + i).padStart(2, "0")}`, value }));
const closes = (values, start = 1) => values.map((close, i) => ({ date: `2026-01-${String(start + i).padStart(2, "0")}`, close }));

describe("ledger: estado de la cuenta", () => {
  const txs = [
    { id: "1", date: "2026-01-02", side: "BUY", ticker: "NU", qty: 100, price: 10, sector: "Financials" },
    { id: "2", date: "2026-01-05", side: "BUY", ticker: "NU", qty: 100, price: 14 },
    { id: "3", date: "2026-01-07", side: "SELL", ticker: "NU", qty: 50, price: 16 },
  ];

  it("usa costo promedio y descuenta la caja", () => {
    const s = accountState(5000, txs, "2026-01-05");
    expect(s.positions.NU.qty).toBe(200);
    expect(s.positions.NU.cost).toBe(12);
    expect(s.cash).toBe(5000 - 1000 - 1400);
    expect(s.positions.NU.sector).toBe("Financials");
  });

  it("al vender registra la ganancia realizada y mantiene el costo", () => {
    const s = accountState(5000, txs);
    expect(s.positions.NU.qty).toBe(150);
    expect(s.positions.NU.cost).toBe(12);
    expect(s.realized).toBe(50 * (16 - 12));
    expect(s.cash).toBe(2600 + 800);
  });

  it("vender todo elimina la posición", () => {
    const s = accountState(5000, [...txs, { id: "4", date: "2026-01-08", side: "SELL", ticker: "NU", qty: 150, price: 12 }]);
    expect(s.positions.NU).toBeUndefined();
  });

  it("no muta la lista de transacciones", () => {
    const frozen = Object.freeze(txs.map((t) => Object.freeze({ ...t })));
    expect(() => accountState(5000, frozen)).not.toThrow();
  });

  it("aportes y retiros mueven la caja", () => {
    const s = accountState(1000, [{ date: "2026-01-02", side: "DEPOSIT", qty: 500 }, { date: "2026-01-03", side: "WITHDRAW", qty: 200 }]);
    expect(s.cash).toBe(1300);
  });
});

describe("ledger: validación de órdenes", () => {
  const txs = [{ id: "1", date: "2026-01-02", side: "BUY", ticker: "NU", qty: 100, price: 10 }];

  it("rechaza una compra que excede la caja", () => {
    const r = validateOrder(5000, txs, { date: "2026-01-03", side: "BUY", ticker: "MU", qty: 10, price: 500 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Caja insuficiente/);
  });

  it("rechaza vender más de lo que hay a esa fecha", () => {
    expect(validateOrder(5000, txs, { date: "2026-01-03", side: "SELL", ticker: "NU", qty: 101, price: 11 }).ok).toBe(false);
    expect(validateOrder(5000, txs, { date: "2026-01-01", side: "SELL", ticker: "NU", qty: 10, price: 11 }).ok).toBe(false);
    expect(validateOrder(5000, txs, { date: "2026-01-03", side: "SELL", ticker: "NU", qty: 100, price: 11 }).ok).toBe(true);
  });

  it("detecta un libro incoherente al quitar una compra de la que dependía una venta", () => {
    const sell = { id: "2", date: "2026-01-05", side: "SELL", ticker: "NU", qty: 50, price: 12 };
    expect(ledgerIssues(5000, [...txs, sell])).toEqual([]);
    expect(ledgerIssues(5000, [sell])[0]).toMatch(/No se puede vender/);
  });

  it("rechaza datos mal formados", () => {
    expect(validateOrder(5000, [], { date: "ayer", side: "BUY", ticker: "nu", qty: 0, price: -1 }).errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("ledger: curva de valor y retorno ponderado por tiempo", () => {
  const prices = { NU: closes([10, 11, 12, 12]) };
  const dates = prices.NU.map((c) => c.date);

  it("closeOn devuelve el último cierre conocido", () => {
    expect(closeOn(prices.NU, "2026-01-02")).toBe(11);
    expect(closeOn(prices.NU, "2026-02-15")).toBe(12);
    expect(closeOn(prices.NU, "2025-12-31")).toBe(null);
  });

  it("valora caja más posiciones cada día", () => {
    const curve = equityCurve(1000, [{ date: "2026-01-01", side: "BUY", ticker: "NU", qty: 50, price: 10 }], prices, dates);
    expect(curve.map((p) => p.value)).toEqual([1000, 1050, 1100, 1100]);
  });

  it("un aporte no cuenta como retorno", () => {
    const txs = [
      { date: "2026-01-01", side: "BUY", ticker: "NU", qty: 100, price: 10 },
      { date: "2026-01-03", side: "DEPOSIT", qty: 1000 },
    ];
    const curve = equityCurve(1000, txs, prices, dates);
    expect(curve[2].value).toBe(2200);
    const idx = twrIndex(curve);
    expect(idx[2].value).toBeCloseTo(120, 6);
    expect(idx[3].value).toBeCloseTo(120, 6);
  });

  it("cartera modelo: compra y mantiene desde la fecha de inicio", () => {
    const idx = modelIndex({ NU: 0.5 }, prices, dates, "2026-01-02");
    expect(idx[0]).toEqual({ date: "2026-01-02", value: 100 });
    expect(idx[1].value).toBeCloseTo(100 * (0.5 + 0.5 * (12 / 11)), 6);
  });

  it("valuedPositions calcula pesos y ganancia", () => {
    const state = accountState(1000, [{ date: "2026-01-01", side: "BUY", ticker: "NU", qty: 50, price: 10 }]);
    const v = valuedPositions(state, prices, "2026-01-03");
    expect(v.total).toBe(1100);
    expect(v.rows[0].weight).toBeCloseTo(600 / 1100, 6);
    expect(v.rows[0].pnlPct).toBeCloseTo(0.2, 6);
  });
});

describe("ledger: carteras de referencia escritas a mano", () => {
  it("lee pesos por línea con % y coma decimal", () => {
    expect(parseWeights("nvda 25\nMSFT: 12,5%\nbasura\nBRK.B = 10")).toEqual({ NVDA: 0.25, MSFT: 0.125, "BRK.B": 0.1 });
    expect(parseWeights("")).toEqual({});
  });

  it("formatWeights es el inverso legible", () => {
    expect(parseWeights(formatWeights({ NVDA: 0.25, MU: 0.075 }))).toEqual({ NVDA: 0.25, MU: 0.075 });
  });
});

describe("perf: métricas", () => {
  it("retornos, total y móviles", () => {
    const s = series([100, 110, 99, 108.9]);
    expect(dailyReturns(s)[0]).toBeCloseTo(0.1, 9);
    expect(totalReturn(s)).toBeCloseTo(0.089, 9);
    expect(trailingReturn(s, 1)).toBeCloseTo(0.1, 9);
    expect(trailingReturn(s, 10)).toBe(null);
  });

  it("YTD parte del último cierre del año anterior", () => {
    const s = [{ date: "2025-12-30", value: 90 }, { date: "2025-12-31", value: 100 }, { date: "2026-01-02", value: 105 }];
    expect(ytdReturn(s)).toBeCloseTo(0.05, 9);
  });

  it("máxima caída con fechas de pico y piso", () => {
    const s = series([100, 120, 90, 96, 130]);
    const dd = maxDrawdown(s);
    expect(dd.value).toBeCloseTo(-0.25, 9);
    expect(dd.peakDate).toBe("2026-01-02");
    expect(dd.troughDate).toBe("2026-01-03");
    expect(drawdownSeries(s)[4].value).toBe(0);
  });

  it("beta 2 y alfa 0 cuando la cartera duplica al benchmark", () => {
    const bench = [0.01, -0.02, 0.015, 0.005, -0.01, 0.02];
    const { alpha, beta, r2 } = alphaBeta(bench.map((r) => 2 * r), bench);
    expect(beta).toBeCloseTo(2, 9);
    expect(alpha).toBeCloseTo(0, 9);
    expect(r2).toBeCloseTo(1, 9);
  });

  it("alfa positivo cuando gana un extra constante cada día", () => {
    const bench = [0.01, -0.02, 0.015, 0.005, -0.01, 0.02];
    const { alpha, beta } = alphaBeta(bench.map((r) => r + 0.001), bench);
    expect(beta).toBeCloseTo(1, 9);
    expect(alpha).toBeCloseTo(0.252, 9);
  });

  it("tracking error cero y sin information ratio si copia al benchmark", () => {
    const bench = [0.01, -0.02, 0.015];
    expect(trackingError(bench, bench)).toBe(0);
    expect(informationRatio(bench, bench)).toBe(null);
  });

  it("information ratio positivo si el exceso es positivo en promedio", () => {
    const bench = [0.01, -0.02, 0.015, 0.0];
    const port = [0.012, -0.019, 0.018, 0.001];
    expect(informationRatio(port, bench)).toBeGreaterThan(0);
    expect(hitRate(port, bench)).toBe(1);
  });

  it("devuelve null en vez de inventar cuando falta historia", () => {
    expect(sharpe([0.01])).toBe(null);
    expect(alphaBeta([0.01], [0.01]).alpha).toBe(null);
    expect(maxDrawdown([]).value).toBe(null);
  });

  it("alinea series por fecha y resume", () => {
    const [a, b] = alignSeries(series([1, 2, 3]), series([5, 6], 2));
    expect(a.map((p) => p.value)).toEqual([2, 3]);
    expect(b.map((p) => p.value)).toEqual([5, 6]);
    const sum = summarize(series([100, 102, 101, 104, 107]), series([100, 101, 100, 102, 103]));
    expect(sum.sessions).toBe(4);
    expect(sum.totalReturn).toBeCloseTo(0.07, 9);
    expect(sum.benchReturn).toBeCloseTo(0.03, 9);
  });

  it("retornos mensuales", () => {
    const s = [{ date: "2026-01-02", value: 100 }, { date: "2026-01-30", value: 110 }, { date: "2026-02-27", value: 99 }];
    const m = monthlyReturns(s);
    expect(m.map((x) => x.month)).toEqual(["2026-01", "2026-02"]);
    expect(m[0].value).toBeCloseTo(0.1, 9);
    expect(m[1].value).toBeCloseTo(-0.1, 9);
  });
});

describe("sectores y mandato", () => {
  it("clasifica tickers en tramos del mandato", () => {
    expect(sleeveOf("VOO")).toBe("NUCLEO");
    expect(sleeveOf("XLK")).toBe("TACTICO");
    expect(sleeveOf("NU")).toBe("SATELITE");
    expect(sleeveOf("BIL")).toBe("LIQUIDEZ");
  });

  it("abre VOO en los sectores del S&P 500", () => {
    const exp = sectorExposure([{ ticker: "VOO", weight: 0.5 }, { ticker: "NU", weight: 0.3, sector: "Financials" }], 0.2);
    expect(exp.Technology).toBeCloseTo(0.5 * SPY_WEIGHTS.Technology, 9);
    expect(exp.Financials).toBeCloseTo(0.5 * SPY_WEIGHTS.Financials + 0.3, 9);
    expect(exp[CASH]).toBe(0.2);
    const total = Object.values(exp).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it("100% VOO no tiene apuestas activas", () => {
    const act = activeWeights(sectorExposure([{ ticker: "VOO", weight: 1 }]));
    expect(Math.max(...act.map((a) => Math.abs(a.active)))).toBeCloseTo(0, 9);
  });

  it("detecta incumplimientos del mandato", () => {
    const rows = [{ ticker: "VOO", weight: 0.2 }, { ticker: "NU", weight: 0.6, sector: "Financials" }];
    const alerts = mandateChecks(rows, 0.2, "real").map((a) => a.text).join(" | ");
    expect(alerts).toMatch(/Satélite en 60\.0%/);
    expect(alerts).toMatch(/NU pesa 60\.0%/);
    expect(alerts).toMatch(/Financials en/);
    expect(alerts).toMatch(/Liquidez en 20\.0%/);
    expect(sleeveWeights(rows, 0.2).NUCLEO).toBe(0.2);
  });

  it("cartera vacía no genera alertas", () => {
    expect(mandateChecks([], 1)).toEqual([]);
  });
});

describe("earnings: publicaciones y reacción", () => {
  const recent = {
    form: ["8-K", "10-Q", "8-K", "8-K"],
    items: ["2.02,9.01", "", "5.02", "2.02"],
    filingDate: ["2026-11-05", "2026-11-05", "2026-09-01", "2026-08-06"],
    acceptanceDateTime: ["2026-11-05T21:05:00.000Z", "2026-11-05T21:30:00.000Z", "2026-09-01T12:00:00.000Z", "2026-08-06T11:00:00.000Z"],
  };

  it("se queda solo con los 8-K de ítem 2.02", () => {
    const ev = extractEarnings(recent);
    expect(ev.map((e) => e.filingDate)).toEqual(["2026-11-05", "2026-08-06"]);
    expect(ev[0].timing).toBe("DESPUES_CIERRE"); // 21:05 UTC = 16:05 ET
    expect(ev[1].timing).toBe("ANTES_APERTURA"); // 11:00 UTC = 07:00 ET (verano)
  });

  it("clasifica una publicación en plena sesión", () => {
    expect(filingTiming("2026-11-05T17:00:00.000Z").timing).toBe("EN_SESION");
    expect(filingTiming("no es fecha").timing).toBe("DESCONOCIDO");
  });

  it("publicado tras el cierre: la reacción es la sesión siguiente", () => {
    const candles = [{ date: "2026-11-04", close: 99 }, { date: "2026-11-05", close: 100 }, { date: "2026-11-06", close: 110 }];
    const r = earningsReaction({ nyDate: "2026-11-05", timing: "DESPUES_CIERRE" }, candles);
    expect(r.sessionDate).toBe("2026-11-06");
    expect(r.reaction).toBeCloseTo(0.1, 9);
    expect(r.drift5).toBe(null);
  });

  it("publicado antes de abrir: la reacción es el mismo día", () => {
    const candles = [{ date: "2026-08-05", close: 50 }, { date: "2026-08-06", close: 45 }, ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-08-1${i}`, close: 46 + i }))];
    const r = earningsReaction({ nyDate: "2026-08-06", timing: "ANTES_APERTURA" }, candles);
    expect(r.sessionDate).toBe("2026-08-06");
    expect(r.reaction).toBeCloseTo(-0.1, 9);
    expect(r.drift5).toBeCloseTo(50 / 45 - 1, 9);
  });

  it("limpia la lista de tickers", () => {
    expect(parseTickers("nu, DUOL,nu,,$$$,MU")).toEqual(["NU", "DUOL", "MU"]);
    expect(parseTickers(null)).toEqual([]);
  });
});

describe("mercado: régimen y tablero sectorial", () => {
  const flat = (n, close) => Array.from({ length: n }, (_, i) => ({ date: `d${String(i).padStart(4, "0")}`, close }));
  const rising = (n, from, to) => Array.from({ length: n }, (_, i) => ({ date: `d${String(i).padStart(4, "0")}`, close: from + ((to - from) * i) / (n - 1) }));

  it("media de 200 y distancia", () => {
    expect(lastSma(flat(199, 10), 200)).toBe(null);
    expect(lastSma(flat(200, 10), 200)).toBe(10);
    expect(distanceToSma200(rising(260, 100, 200))).toBeGreaterThan(0);
  });

  it("tablero: fuerza relativa del sector contra SPY", () => {
    const prices = { SPY: rising(260, 100, 110), XLK: rising(260, 100, 150), XLE: rising(260, 100, 80) };
    const board = sectorBoard(prices);
    const xlk = board.find((r) => r.etf === "XLK");
    const xle = board.find((r) => r.etf === "XLE");
    expect(xlk.rs3m).toBeGreaterThan(0);
    expect(xle.rs3m).toBeLessThan(0);
    expect(xlk.aboveSma200).toBe(true);
    expect(xle.aboveSma200).toBe(false);
    expect(board.find((r) => r.etf === "XLF").r3m).toBe(null);
  });

  it("régimen: defensivo si SPY está bajo su media, cautela si el VIX está alto", () => {
    const up = { SPY: rising(260, 100, 150), XLK: rising(260, 100, 150), XLF: rising(260, 100, 140) };
    expect(marketRegime({ ...up, "^VIX": flat(5, 14) }, sectorBoard(up)).label).toBe("RIESGO ACTIVO");
    expect(marketRegime({ ...up, "^VIX": flat(5, 30) }, sectorBoard(up)).label).toBe("CAUTELA");
    const down = { SPY: rising(260, 150, 100) };
    expect(marketRegime(down, sectorBoard(down)).label).toBe("DEFENSIVO");
    expect(marketRegime({}, []).label).toBe("SIN DATOS");
  });
});
