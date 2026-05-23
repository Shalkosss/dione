/* wyckoff.js — Detección heurística de eventos Wyckoff sobre candles diarios.

   Eventos cubiertos (en orden de aparición típica en un ciclo de acumulación):
     SC     Selling Climax        — clímax de venta al final del downtrend
     AR     Automatic Rally       — rebote técnico tras el SC
     ST     Secondary Test        — retest del low del SC con menos volumen
     Spring Penetración engañosa  — falsa ruptura bajo el soporte del rango
     SOS    Sign of Strength      — breakout del rango hacia arriba con volumen
     LPS    Last Point of Support — pullback de bajo volumen tras un SOS

   Reglas según el brief del usuario:
     - SC:     range > 2.5x ATR(14)  AND  vol > 2.5x avg vol 20d  AND  en bottom de downtrend
     - AR:     rebote >10% en 5–15 días post-SC
     - ST:     retest del SC low ±5% con vol < 70% del SC vol
     - Spring: close < min(low últimos 60d) AND vol < 0.80x avg20 AND recovery sobre ese min en 1-5 días
     - SOS:    breakout con vol > 1.5x avg20, wide range bar, close cerca del high
     - LPS:    pullback post-SOS con volume bajo

   Devuelve [{ type, idx, date, price, level?, note? }, ...] listo para anotar en recharts.
*/

import { atr, sma } from "./indicators.js";

export const WYCKOFF_COLORS = {
  SC: "#e5634d",
  AR: "#5aa0e8",
  ST: "#f0a040",
  Spring: "#4ec9a3",
  SOS: "#a78bfa",
  LPS: "#7dd3fc",
};

export function detectWyckoffEvents(candles) {
  if (!candles || candles.length < 70) return [];

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume || 0);
  const atr14 = atr(candles, 14);
  const sma50 = sma(closes, 50);
  const sma20Vol = sma(volumes, 20);

  const inDowntrend = (i) =>
    sma50[i] != null && closes[i] < sma50[i] &&
    i >= 5 && sma50[i - 5] != null && sma50[i] < sma50[i - 5];

  const events = [];

  // ---------- SC ----------
  // Bar climax: rango y volumen extremos en bottom de tendencia bajista.
  // Filtramos clusters: si ya hay un SC en las últimas 30 barras, no marcamos otro.
  const scIdxs = [];
  for (let i = 20; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    if (atr14[i] == null || sma20Vol[i] == null || sma20Vol[i] === 0) continue;
    if (!inDowntrend(i)) continue;
    const rangeOk = range > 2.5 * atr14[i];
    const volOk = c.volume > 2.5 * sma20Vol[i];
    if (rangeOk && volOk) {
      if (scIdxs.length && i - scIdxs[scIdxs.length - 1] < 30) continue;
      scIdxs.push(i);
      events.push({
        type: "SC",
        idx: i,
        date: c.date,
        price: c.low,
        level: c.low,
        note: `Vol ${(c.volume / sma20Vol[i]).toFixed(1)}× promedio · range ${(range / atr14[i]).toFixed(1)}× ATR`,
      });
    }
  }

  // ---------- AR ----------
  // Para cada SC, primer high que rebote >10% del SC low entre día 5 y 15 post-SC.
  const arIdxs = [];
  for (const scIdx of scIdxs) {
    const scLow = candles[scIdx].low;
    let arIdx = null, arHigh = -Infinity;
    for (let j = scIdx + 5; j <= Math.min(scIdx + 15, candles.length - 1); j++) {
      if (candles[j].high > arHigh) { arHigh = candles[j].high; arIdx = j; }
    }
    if (arIdx != null && arHigh >= scLow * 1.10) {
      arIdxs.push({ scIdx, arIdx, arHigh, scLow });
      events.push({
        type: "AR",
        idx: arIdx,
        date: candles[arIdx].date,
        price: arHigh,
        level: arHigh,
        note: `+${(((arHigh - scLow) / scLow) * 100).toFixed(1)}% desde SC`,
      });
    }
  }

  // ---------- ST ----------
  // Después del AR, primer retest del SC low ±5% con vol < 70% del SC vol.
  for (const { scIdx, arIdx, scLow } of arIdxs) {
    const scVol = candles[scIdx].volume;
    const window = Math.min(arIdx + 60, candles.length - 1);
    for (let j = arIdx + 1; j <= window; j++) {
      const c = candles[j];
      const within5pct = Math.abs(c.low - scLow) / scLow <= 0.05;
      const lowerVol = c.volume < 0.7 * scVol;
      if (within5pct && lowerVol) {
        events.push({
          type: "ST",
          idx: j,
          date: c.date,
          price: c.low,
          level: c.low,
          note: `Retest SC con ${((c.volume / scVol) * 100).toFixed(0)}% del vol`,
        });
        break;
      }
    }
  }

  // ---------- Spring ----------
  // Close por debajo del min(low) de los 60 días previos, vol < 0.80x avg20,
  // y recuperación por encima de ese mínimo en las próximas 1-5 barras.
  for (let i = 65; i < candles.length - 5; i++) {
    if (sma20Vol[i] == null) continue;
    // min(low) de las últimas 60 barras ANTES de i.
    let minPrev = Infinity;
    for (let j = i - 60; j < i; j++) if (candles[j].low < minPrev) minPrev = candles[j].low;
    const c = candles[i];
    if (!(c.close < minPrev)) continue;
    if (!(c.volume < 0.80 * sma20Vol[i])) continue;
    // Recovery: close > minPrev en alguna de las próximas 1-5 barras.
    let recovered = false;
    for (let j = i + 1; j <= i + 5; j++) {
      if (candles[j].close > minPrev) { recovered = true; break; }
    }
    if (recovered) {
      events.push({
        type: "Spring",
        idx: i,
        date: c.date,
        price: c.low,
        level: minPrev,
        note: `Penetración bajo soporte ${minPrev.toFixed(2)} con vol bajo, recovery confirmado`,
      });
    }
  }

  // ---------- SOS ----------
  // Breakout: cerrar por encima del max(high) últimas 20 barras
  // con vol > 1.5x avg20, range > 1.2x ATR y close en top 30% del range.
  let lastSosIdx = -Infinity;
  for (let i = 25; i < candles.length; i++) {
    if (atr14[i] == null || sma20Vol[i] == null) continue;
    let maxPrev = -Infinity;
    for (let j = i - 20; j < i; j++) if (candles[j].high > maxPrev) maxPrev = candles[j].high;
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;
    const breakout = c.close > maxPrev;
    const volOk = c.volume > 1.5 * sma20Vol[i];
    const wideBar = range > 1.2 * atr14[i];
    const closeNearHigh = (c.close - c.low) / range >= 0.70;
    if (breakout && volOk && wideBar && closeNearHigh) {
      if (i - lastSosIdx < 10) continue;
      lastSosIdx = i;
      events.push({
        type: "SOS",
        idx: i,
        date: c.date,
        price: c.high,
        level: maxPrev,
        note: `Breakout sobre ${maxPrev.toFixed(2)} con vol ${(c.volume / sma20Vol[i]).toFixed(1)}×`,
      });
    }
  }

  // ---------- LPS ----------
  // Tras un SOS, primer pullback de 2-10 barras donde:
  //   - close cae por debajo del high del SOS pero se mantiene sobre el nivel previo
  //   - volumen promedio del pullback < 0.85x avg20 al inicio del pullback
  const sosEvents = events.filter((e) => e.type === "SOS");
  for (const sos of sosEvents) {
    const start = sos.idx + 1;
    const end = Math.min(sos.idx + 12, candles.length - 1);
    for (let j = start + 1; j <= end; j++) {
      const c = candles[j];
      if (sma20Vol[j] == null) continue;
      const above = c.low > sos.level; // se mantiene sobre el soporte rebasado
      const below = c.close < sos.price; // pullback respecto al high del SOS
      const lowVol = c.volume < 0.85 * sma20Vol[j];
      if (above && below && lowVol) {
        events.push({
          type: "LPS",
          idx: j,
          date: c.date,
          price: c.low,
          level: c.low,
          note: `Pullback sobre ${sos.level.toFixed(2)} con vol ${(c.volume / sma20Vol[j]).toFixed(2)}× promedio`,
        });
        break;
      }
    }
  }

  return events.sort((a, b) => a.idx - b.idx);
}
