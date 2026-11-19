/* levels.js — Soportes, resistencias, líneas de tendencia y perfil de volumen
   calculados solos a partir de las velas. Funciones puras.

   Pivote: un máximo (mínimo) con `k` velas más bajas (altas) a cada lado.
   Nivel: pivotes a menos de 0.75 × ATR entre sí se agrupan en un nivel; vale
   más cuantas más veces se tocó y cuanto más reciente es el último toque.
   Línea de tendencia: une los dos últimos pivotes del mismo tipo y se proyecta
   hasta hoy; se descarta si algún cierre intermedio la cruzó por más de medio ATR.
   Perfil de volumen: el volumen de cada vela se asigna a su precio típico;
   POC = precio con más volumen, área de valor = 70% del volumen alrededor del POC.

   Son descriptivos (TECHNICAL_VALIDATED.md): ubican stops y entradas límite,
   no predicen por sí solos.
*/

import { atr } from "./indicators.js";

export function pivots(candles, k = 5) {
  const out = [];
  for (let i = k; i < candles.length - k; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - k; j <= i + k && (isHigh || isLow); j++) {
      if (j === i) continue;
      if (candles[j].high > candles[i].high || (j < i && candles[j].high === candles[i].high)) isHigh = false;
      if (candles[j].low < candles[i].low || (j < i && candles[j].low === candles[i].low)) isLow = false;
    }
    if (isHigh) out.push({ idx: i, type: "H", price: candles[i].high });
    if (isLow) out.push({ idx: i, type: "L", price: candles[i].low });
  }
  return out;
}

const lastAtr = (candles) => {
  const a = atr(candles, 14);
  for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i];
  const c = candles[candles.length - 1];
  return c ? (c.high - c.low) || c.close * 0.02 : 0;
};

// Agrupa pivotes cercanos en niveles. Devuelve [{ price, touches, lastIdx, score }].
export function clusterLevels(points, tolerance, lastIdx) {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const groups = [];
  for (const p of sorted) {
    const g = groups[groups.length - 1];
    if (g && p.price - g.items[g.items.length - 1].price <= tolerance) g.items.push(p);
    else groups.push({ items: [p] });
  }
  return groups.map(({ items }) => {
    const price = items.reduce((s, p) => s + p.price, 0) / items.length;
    const last = Math.max(...items.map((p) => p.idx));
    const recency = lastIdx > 0 ? 1 - (lastIdx - last) / lastIdx : 1;
    return { price, touches: items.length, lastIdx: last, score: items.length + recency };
  });
}

// Soportes bajo el precio y resistencias sobre él, los más fuertes primero
// dentro de los `max` más cercanos. Exige al menos 2 toques.
export function supportResistance(candles, { k = 5, lookback = 250, max = 3, minTouches = 2 } = {}) {
  if (!candles || candles.length < 2 * k + 10) return { supports: [], resistances: [], tolerance: null };
  const from = Math.max(0, candles.length - lookback);
  const recent = candles.slice(from);
  const tolerance = 0.75 * lastAtr(recent);
  const price = recent[recent.length - 1].close;
  const pts = pivots(recent, k).map((p) => ({ ...p, idx: p.idx + from }));
  const levels = clusterLevels(pts, tolerance, candles.length - 1).filter((l) => l.touches >= minTouches);
  const nearest = (list, dir) => list.sort((a, b) => dir * (a.price - b.price)).slice(0, max);
  const supports = nearest(levels.filter((l) => l.price < price - tolerance * 0.25), -1);
  const resistances = nearest(levels.filter((l) => l.price > price + tolerance * 0.25), 1);
  return { supports, resistances, tolerance };
}

// Línea entre dos pivotes, proyectada. Devuelve null si un cierre intermedio la cruzó.
function lineFrom(candles, a, b, side, slack) {
  const slope = (b.price - a.price) / (b.idx - a.idx);
  const at = (i) => a.price + slope * (i - a.idx);
  for (let i = a.idx + 1; i < b.idx; i++) {
    const c = candles[i].close;
    if (side === "support" ? c < at(i) - slack : c > at(i) + slack) return null;
  }
  return { from: a.idx, to: b.idx, slope, at, side, startPrice: a.price, endPrice: at(candles.length - 1) };
}

export function trendlines(candles, { k = 5, lookback = 250, tries = 4 } = {}) {
  if (!candles || candles.length < 2 * k + 10) return { support: null, resistance: null };
  const from = Math.max(0, candles.length - lookback);
  const pts = pivots(candles, k).filter((p) => p.idx >= from);
  const slack = 0.5 * lastAtr(candles.slice(from));
  const find = (type, side) => {
    const list = pts.filter((p) => p.type === type);
    for (let i = list.length - 1, n = 0; i > 0 && n < tries; i--, n++) {
      for (let j = i - 1; j >= Math.max(0, i - tries); j--) {
        const line = lineFrom(candles, list[j], list[i], side, slack);
        if (line) return line;
      }
    }
    return null;
  };
  return { support: find("L", "support"), resistance: find("H", "resistance") };
}

export function volumeProfile(candles, { bins = 24, valueArea = 0.7 } = {}) {
  const rows = (candles || []).filter((c) => c.volume > 0 && c.high >= c.low);
  if (rows.length < 10) return null;
  const lo = Math.min(...rows.map((c) => c.low));
  const hi = Math.max(...rows.map((c) => c.high));
  if (!(hi > lo)) return null;
  const step = (hi - lo) / bins;
  const vol = new Array(bins).fill(0);
  for (const c of rows) {
    const typical = (c.high + c.low + c.close) / 3;
    vol[Math.min(bins - 1, Math.floor((typical - lo) / step))] += c.volume;
  }
  const total = vol.reduce((s, v) => s + v, 0);
  const poc = vol.indexOf(Math.max(...vol));
  let a = poc, b = poc, acc = vol[poc];
  while (acc < total * valueArea && (a > 0 || b < bins - 1)) {
    const down = a > 0 ? vol[a - 1] : -1;
    const up = b < bins - 1 ? vol[b + 1] : -1;
    if (up >= down) acc += vol[++b];
    else acc += vol[--a];
  }
  const mid = (i) => lo + step * (i + 0.5);
  return {
    poc: mid(poc),
    val: lo + step * a,
    vah: lo + step * (b + 1),
    bins: vol.map((v, i) => ({ price: mid(i), volume: v, share: total > 0 ? v / total : 0 })),
  };
}
