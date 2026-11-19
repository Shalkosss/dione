/* wyckoff.js — Eventos Wyckoff de acumulación sobre velas diarias, según
   project-docs/WYCKOFF_FRAMEWORK.md (revisión del 8-nov-2026).

   Volumen relativo (RVOL) = volumen del día / promedio de las 20 sesiones
   ANTERIORES (base del framework: avg(volume[t-20:t-1])).

   Fase A
     SC     rango > 2.5 × ATR(14), RVOL > 2.5, en tendencia bajista
     AR     máximo entre 5 y 15 sesiones después del SC, al menos +10% sobre su mínimo
     ST     primer retest del mínimo del SC (±5%) con volumen < 70% del volumen del SC
   Fase C (el precio decide y el volumen clasifica: ningún umbral de volumen
           confirma ni descarta un Spring o un Test)
     Spring nivel = mínimo de los 60 lows previos.
            (A) cierre bajo el nivel y algún cierre de vuelta encima en 1 a 5 sesiones
            (B) low bajo el nivel y cierre de vuelta encima el mismo día
            spring_low = mínimo de los lows entre la ruptura y la recuperación
     Test   primera vela entre e+2 y e+20 que vuelve a la zona (low ≤ spring_low × 1.05)
            después de un rebote (algún cierre ≥ spring_low × 1.05) y sin nuevo
            mínimo. Vale si cierra en su mitad superior; si cierra en la inferior
            el test queda pendiente (aceptar una vela posterior no está medido).
            Un low bajo spring_low antes del test invalida el Spring.
            Clasificación por RVOL del Spring: seco < 0.80 ≤ moderado ≤ 1.50 < shakeout.
   Fase D
     SOS    cierre sobre el máximo de 20 sesiones con RVOL > 1.5, vela ancha
            (rango > 1.2 × ATR) y cierre en el 30% superior
     LPS    primer retroceso de bajo volumen (RVOL < 0.85) que se mantiene sobre
            el nivel roto, dentro de las 12 sesiones siguientes al SOS

   Desde v4 (14-nov-2026) Wyckoff es descriptivo: no puntúa ni prioriza.
   Devuelve eventos { type, idx, date, price, level, rvol, note, status? }.
*/

import { atr, sma, relVolume } from "./indicators.js";

export const WYCKOFF_COLORS = {
  SC: "#e5634d",
  AR: "#5aa0e8",
  ST: "#f0a040",
  Spring: "#4ec9a3",
  Test: "#22c55e",
  SOS: "#a78bfa",
  LPS: "#7dd3fc",
};

export const RVOL_PERIOD = 20;
const SPRING_LOOKBACK = 60;
const TEST_ZONE = 1.05;

// Etiqueta del Spring por volumen relativo (no cambia la decisión).
export function springVolumeClass(rvol) {
  if (rvol == null) return null;
  if (rvol < 0.8) return "seco";
  if (rvol <= 1.5) return "moderado";
  return "shakeout";
}

const closePosition = (c) => (c.high > c.low ? (c.close - c.low) / (c.high - c.low) : 0.5);
const fmtX = (v) => (v == null ? "—" : `${v.toFixed(2)}×`);

function phaseA(candles, ctx, events) {
  const { atr14, rvol, inDowntrend } = ctx;
  const scIdxs = [];
  for (let i = RVOL_PERIOD; i < candles.length; i++) {
    const c = candles[i];
    if (atr14[i] == null || rvol[i] == null || !inDowntrend(i)) continue;
    const range = c.high - c.low;
    if (range > 2.5 * atr14[i] && rvol[i] > 2.5) {
      if (scIdxs.length && i - scIdxs[scIdxs.length - 1] < 30) continue;
      scIdxs.push(i);
      events.push({ type: "SC", idx: i, date: c.date, price: c.low, level: c.low, rvol: rvol[i], note: `RVOL ${fmtX(rvol[i])} · rango ${(range / atr14[i]).toFixed(1)}× ATR` });
    }
  }

  const ranges = [];
  for (const scIdx of scIdxs) {
    const scLow = candles[scIdx].low;
    let arIdx = null, arHigh = -Infinity;
    for (let j = scIdx + 5; j <= Math.min(scIdx + 15, candles.length - 1); j++) {
      if (candles[j].high > arHigh) { arHigh = candles[j].high; arIdx = j; }
    }
    if (arIdx == null || arHigh < scLow * 1.1) continue;
    events.push({ type: "AR", idx: arIdx, date: candles[arIdx].date, price: arHigh, level: arHigh, rvol: rvol[arIdx], note: `+${(((arHigh - scLow) / scLow) * 100).toFixed(1)}% desde el SC` });
    const range = { scIdx, arIdx, top: arHigh, bottom: scLow, stIdx: null };
    const scVol = candles[scIdx].volume;
    for (let j = arIdx + 1; j <= Math.min(arIdx + 60, candles.length - 1); j++) {
      const c = candles[j];
      if (Math.abs(c.low - scLow) / scLow <= 0.05 && c.volume < 0.7 * scVol) {
        range.stIdx = j;
        events.push({ type: "ST", idx: j, date: c.date, price: c.low, level: c.low, rvol: rvol[j], note: `retest del SC con ${((c.volume / scVol) * 100).toFixed(0)}% de su volumen` });
        break;
      }
    }
    ranges.push(range);
  }
  return ranges;
}

// Busca el test de un Spring. Devuelve { status, idx? }.
function findTest(candles, e, springLow) {
  const last = candles.length - 1;
  const end = Math.min(e + 20, last);
  let maxClose = candles[e].close;
  for (let j = e + 1; j <= end; j++) {
    const c = candles[j];
    if (c.low < springLow) return { status: "invalidado", idx: j };
    if (j >= e + 2 && maxClose >= springLow * TEST_ZONE && c.low <= springLow * TEST_ZONE) {
      return closePosition(c) >= 0.5 ? { status: "confirmado", idx: j } : { status: "pendiente", idx: j, lowerHalf: true };
    }
    maxClose = Math.max(maxClose, c.close);
  }
  return { status: e + 20 > last ? "pendiente" : "sin test" };
}

function phaseC(candles, ctx, events) {
  const { rvol } = ctx;
  let lastEnd = -1;
  for (let t = SPRING_LOOKBACK; t < candles.length; t++) {
    if (t <= lastEnd) continue;
    let level = Infinity;
    for (let j = t - SPRING_LOOKBACK; j < t; j++) level = Math.min(level, candles[j].low);
    const c = candles[t];
    let e = null, variant = null;
    if (c.close < level) {
      for (let k = t + 1; k <= Math.min(t + 5, candles.length - 1); k++) {
        if (candles[k].close > level) { e = k; variant = "A"; break; }
      }
    } else if (c.low < level) {
      e = t; variant = "B";
    }
    if (e == null) continue;
    let springLow = Infinity;
    for (let k = t; k <= e; k++) springLow = Math.min(springLow, candles[k].low);
    const test = findTest(candles, e, springLow);
    const volClass = springVolumeClass(rvol[t]);
    events.push({
      type: "Spring", idx: t, date: c.date, price: springLow, level, rvol: rvol[t], variant, status: test.status, volClass,
      note: `${variant === "A" ? "cierre bajo" : "perforó"} ${level.toFixed(2)} y recuperó · ${volClass || "sin volumen"} (RVOL ${fmtX(rvol[t])}) · test ${test.status}${test.lowerHalf ? " (cerró en la mitad inferior)" : ""}`,
    });
    if (test.status === "confirmado") {
      const tc = candles[test.idx];
      events.push({ type: "Test", idx: test.idx, date: tc.date, price: tc.low, level: springLow, rvol: rvol[test.idx], note: `entrada al cierre ${tc.close.toFixed(2)} · stop bajo ${springLow.toFixed(2)} · RVOL ${fmtX(rvol[test.idx])}` });
    }
    lastEnd = Math.max(e, test.idx ?? e);
  }
}

function phaseD(candles, ctx, events) {
  const { atr14, rvol } = ctx;
  let lastSos = -Infinity;
  const sos = [];
  for (let i = 25; i < candles.length; i++) {
    if (atr14[i] == null || rvol[i] == null) continue;
    let maxPrev = -Infinity;
    for (let j = i - 20; j < i; j++) maxPrev = Math.max(maxPrev, candles[j].high);
    const c = candles[i];
    const range = c.high - c.low;
    if (range <= 0) continue;
    if (c.close > maxPrev && rvol[i] > 1.5 && range > 1.2 * atr14[i] && closePosition(c) >= 0.7 && i - lastSos >= 10) {
      lastSos = i;
      const ev = { type: "SOS", idx: i, date: c.date, price: c.high, level: maxPrev, rvol: rvol[i], note: `cierre sobre ${maxPrev.toFixed(2)} con RVOL ${fmtX(rvol[i])}` };
      sos.push(ev);
      events.push(ev);
    }
  }
  for (const s of sos) {
    for (let j = s.idx + 2; j <= Math.min(s.idx + 12, candles.length - 1); j++) {
      const c = candles[j];
      if (rvol[j] == null) continue;
      if (c.low > s.level && c.close < s.price && rvol[j] < 0.85) {
        events.push({ type: "LPS", idx: j, date: c.date, price: c.low, level: c.low, rvol: rvol[j], note: `retroceso sobre ${s.level.toFixed(2)} con RVOL ${fmtX(rvol[j])}` });
        break;
      }
    }
  }
}

// Fase actual (heurística descriptiva) a partir del último evento relevante.
export function wyckoffPhase(events, candles) {
  if (!events.length || !candles.length) return null;
  const last = candles.length - 1;
  const lastOf = (type) => [...events].reverse().find((e) => e.type === type);
  const sos = lastOf("SOS");
  const spring = [...events].reverse().find((e) => e.type === "Spring" && e.status !== "invalidado");
  const sc = lastOf("SC");
  if (sos && last - sos.idx <= 120) {
    const above = candles[last].close > sos.level;
    if (!above) return { phase: null, label: "SOS fallido: el precio volvió bajo el nivel roto", since: sos.date };
    return last - sos.idx > 30 ? { phase: "E", label: "Markup: tendencia sobre el último SOS", since: sos.date } : { phase: "D", label: "Markup inicial: SOS reciente, posible LPS", since: sos.date };
  }
  if (spring && last - spring.idx <= 40) {
    return { phase: "C", label: `Spring ${spring.status === "confirmado" ? "con test confirmado" : `con test ${spring.status}`}`, since: spring.date };
  }
  if (sc && last - sc.idx <= 250) {
    const ar = events.find((e) => e.type === "AR" && e.idx > sc.idx);
    if (!ar) return { phase: "A", label: "Clímax de venta reciente, falta el rally automático", since: sc.date };
    return last - ar.idx > 20 ? { phase: "B", label: "Rango lateral entre el AR y el SC (construcción de causa)", since: sc.date } : { phase: "A", label: "Frenando la bajada: SC y AR", since: sc.date };
  }
  return null;
}

export function detectWyckoffEvents(candles) {
  if (!candles || candles.length < SPRING_LOOKBACK + 10) return { events: [], ranges: [] };
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume ?? null);
  const sma50 = sma(closes, 50);
  const ctx = {
    atr14: atr(candles, 14),
    rvol: relVolume(volumes, RVOL_PERIOD),
    inDowntrend: (i) => sma50[i] != null && closes[i] < sma50[i] && i >= 5 && sma50[i - 5] != null && sma50[i] < sma50[i - 5],
  };
  const events = [];
  const ranges = phaseA(candles, ctx, events);
  phaseC(candles, ctx, events);
  phaseD(candles, ctx, events);
  return { events: events.sort((a, b) => a.idx - b.idx), ranges };
}
