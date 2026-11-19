/* chartData.js — Prepara las velas para el módulo Chart. Funciones puras.

   Los indicadores se calculan sobre toda la historia descargada (con
   calentamiento) y después se recorta al rango visible: así la SMA 200 y los
   eventos Wyckoff existen desde la primera vela que se ve.
*/

import { sma, rsi, bollinger, obv, relVolume } from "./indicators.js";

// Días calendario extra que se bajan antes del rango visible.
export const WARMUP_DAYS = 420;

export function enrichCandles(candles, { rvolPeriod = 20 } = {}) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume ?? null);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);
  const bb = bollinger(closes, 20, 2);
  const obvArr = obv(candles);
  const rv = relVolume(volumes, rvolPeriod);
  return candles.map((c, i) => ({
    ...c,
    idx: i,
    hl: c.high != null && c.low != null ? [c.low, c.high] : null,
    up: c.open != null ? c.close >= c.open : i > 0 ? c.close >= candles[i - 1].close : true,
    sma50: sma50[i],
    sma200: sma200[i],
    rsi14: rsi14[i],
    bbUpper: bb[i].upper,
    bbLower: bb[i].lower,
    bbMid: bb[i].mid,
    obv: obvArr[i],
    rvol: rv[i],
  }));
}

// Índice de la primera vela visible para un rango de `days` días calendario.
export function visibleStart(candles, days) {
  if (days == null || !candles.length) return 0;
  const last = Date.parse(`${candles[candles.length - 1].date}T00:00:00Z`);
  const from = new Date(last - days * 86400000).toISOString().slice(0, 10);
  const i = candles.findIndex((c) => c.date >= from);
  return i === -1 ? 0 : i;
}

/* Separa el cierre en dos series para dibujar la tenencia distinta:
   closePre hasta la fecha de compra (inclusive) y closeHeld desde ella.
   Comparten la vela de compra para que la línea no quede cortada. */
export function splitHeld(rows, startDate) {
  if (!startDate) return rows.map((r) => ({ ...r, closePre: r.close, closeHeld: null }));
  return rows.map((r) => ({
    ...r,
    closePre: r.date <= startDate ? r.close : null,
    closeHeld: r.date >= startDate ? r.close : null,
  }));
}

// Agrega a cada fila el valor de las líneas de tendencia (null fuera de su tramo).
export function withTrendlines(rows, lines) {
  const { support, resistance } = lines || {};
  return rows.map((r) => ({
    ...r,
    trendSup: support && r.idx >= support.from ? support.at(r.idx) : null,
    trendRes: resistance && r.idx >= resistance.from ? resistance.at(r.idx) : null,
  }));
}
