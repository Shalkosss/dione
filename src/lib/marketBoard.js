// src/lib/marketBoard.js — Régimen de mercado y tablero sectorial.
// Funciones puras sobre series [{ date, close }] (roadmap, Fase 3, ítems 7 y 8).

import { SECTOR_ETFS } from "./sectors.js";

const HORIZONS = { r1d: 1, r1m: 21, r3m: 63, r6m: 126, r12m: 252 };

const trailing = (series, sessions) => {
  if (!series || series.length <= sessions) return null;
  const base = series[series.length - 1 - sessions].close;
  return base > 0 ? series[series.length - 1].close / base - 1 : null;
};

// Media simple de los últimos `period` cierres; null si no alcanza la historia.
export function lastSma(series, period) {
  if (!series || series.length < period) return null;
  return series.slice(-period).reduce((s, c) => s + c.close, 0) / period;
}

// Distancia del último cierre a su media de 200 sesiones.
export function distanceToSma200(series) {
  const sma = lastSma(series, 200);
  return sma ? series[series.length - 1].close / sma - 1 : null;
}

// Una fila por ETF sectorial: retornos por plazo y fuerza relativa contra SPY.
export function sectorBoard(prices) {
  const spy = prices.SPY;
  return Object.entries(SECTOR_ETFS).map(([etf, sector]) => {
    const series = prices[etf];
    const returns = Object.fromEntries(Object.entries(HORIZONS).map(([key, n]) => [key, trailing(series, n)]));
    const spy3m = trailing(spy, HORIZONS.r3m);
    const dist = distanceToSma200(series);
    return {
      etf, sector, ...returns,
      rs3m: returns.r3m != null && spy3m != null ? returns.r3m - spy3m : null,
      aboveSma200: dist == null ? null : dist > 0,
    };
  });
}

// Lectura de régimen con tres datos: tendencia de SPY, amplitud sectorial y VIX.
// Es una regla simple de lectura, no una señal de compra o venta.
export function marketRegime(prices, board) {
  const spyDist = distanceToSma200(prices.SPY);
  const vixSeries = prices["^VIX"];
  const vix = vixSeries?.length ? vixSeries[vixSeries.length - 1].close : null;
  const known = board.filter((r) => r.aboveSma200 != null);
  const breadth = known.length ? known.filter((r) => r.aboveSma200).length / known.length : null;

  let label = "SIN DATOS", tone = "muted";
  if (spyDist != null) {
    if (spyDist <= 0) { label = "DEFENSIVO"; tone = "neg"; }
    else if ((vix != null && vix >= 22) || (breadth != null && breadth < 0.5)) { label = "CAUTELA"; tone = "amber"; }
    else { label = "RIESGO ACTIVO"; tone = "pos"; }
  }
  return { label, tone, spyDist, vix, breadth, sectorsAbove: known.filter((r) => r.aboveSma200).length, sectorsKnown: known.length };
}
