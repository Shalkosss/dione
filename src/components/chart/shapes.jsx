import React from "react";
import { C } from "../../theme.js";

/* Formas para recharts. La barra recibe el rango [low, high] de la vela, así
   que `y` es el píxel del máximo y `height` el del rango completo; la apertura
   y el cierre se ubican por proporción dentro de ese rango. */
export function CandleShape({ x, y, width, height, payload }) {
  if (!payload || payload.high == null || payload.low == null) return null;
  const { open, close, high, low } = payload;
  const o = open ?? close;
  const span = high - low;
  const yOf = (v) => (span > 0 ? y + ((high - v) / span) * height : y);
  const color = close >= o ? C.pos : C.neg;
  const bodyTop = yOf(Math.max(o, close));
  const bodyH = Math.max(1, Math.abs(yOf(o) - yOf(close)));
  const cx = x + width / 2;
  const bodyW = Math.max(1, width * 0.7);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + Math.max(height, 1)} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} />
    </g>
  );
}

// Barra de volumen coloreada por día alcista o bajista; las de RVOL alto se resaltan.
export function VolumeShape({ x, y, width, height, payload, highlight }) {
  if (!(height > 0)) return null;
  const strong = highlight && payload?.rvol != null && payload.rvol >= highlight;
  const color = payload?.up ? C.pos : C.neg;
  return <rect x={x} y={y} width={Math.max(1, width)} height={height} fill={color} fillOpacity={strong ? 0.95 : 0.4} />;
}
