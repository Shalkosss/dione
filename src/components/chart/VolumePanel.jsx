import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C, mono } from "../../theme.js";
import { VolumeShape } from "./shapes.jsx";

export const fmtVol = (v) => {
  if (v == null) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
};

const lbl = (value, fill) => ({ value, fill, fontSize: 9, fontFamily: mono, position: "insideTopRight" });

/* Volumen relativo (RVOL): volumen del día / promedio de las N sesiones previas.
   1× = un día normal. Las líneas marcan los cortes que usa Wyckoff:
   0.8× (seco), 1.5× (alto, SOS) y 2.5× (clímax, SC). Verde = día alcista. */
export default function VolumePanel({ rows, mode, period, tickInterval }) {
  const relative = mode === "rvol";
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barCategoryGap={0}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
        <YAxis stroke={C.muted} fontSize={10} width={52} tick={{ fill: C.muted }}
          tickFormatter={relative ? (v) => `${v.toFixed(1)}×` : fmtVol}
          domain={relative ? [0, (max) => Math.max(3, Math.ceil(max))] : [0, "auto"]} allowDataOverflow={false} />
        <Tooltip
          contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: mono }}
          labelStyle={{ color: C.muted }}
          formatter={(v, _n, item) => (relative
            ? [`${Number(v).toFixed(2)}× (vol. ${fmtVol(item.payload.volume)})`, `RVOL ${period}d`]
            : [fmtVol(v), item.payload.rvol != null ? `Volumen · RVOL ${item.payload.rvol.toFixed(2)}×` : "Volumen"])}
        />
        {relative && <ReferenceLine y={1} stroke={C.muted} strokeDasharray="3 3" label={lbl("1× promedio", C.muted)} />}
        {relative && <ReferenceLine y={0.8} stroke={C.blue} strokeOpacity={0.5} strokeDasharray="1 3" />}
        {relative && <ReferenceLine y={1.5} stroke={C.amber} strokeOpacity={0.7} strokeDasharray="3 3" label={lbl("1.5× alto", C.amber)} />}
        {relative && <ReferenceLine y={2.5} stroke={C.neg} strokeOpacity={0.7} strokeDasharray="3 3" label={lbl("2.5× clímax", C.neg)} />}
        <Bar dataKey={relative ? "rvol" : "volume"} isAnimationActive={false} shape={<VolumeShape highlight={1.5} />} />
      </BarChart>
    </ResponsiveContainer>
  );
}
