import React from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot, ReferenceArea,
} from "recharts";
import { C, mono } from "../../theme.js";
import { WYCKOFF_COLORS } from "../../lib/wyckoff.js";
import { CandleShape } from "./shapes.jsx";

const f2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const lbl = (value, fill, position = "insideTopLeft") => ({ value, fill, fontSize: 9.5, fontFamily: mono, position });
const BELOW = new Set(["SC", "ST", "Spring", "Test", "LPS"]);

function PriceTooltip({ active, payload }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const row = (k, v, color = C.text) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><span style={{ color: C.muted }}>{k}</span><span style={{ color }}>{v}</span></div>
  );
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.border}`, padding: "7px 9px", fontFamily: mono, fontSize: 10.5, minWidth: 150 }}>
      <div style={{ color: C.muted, marginBottom: 3 }}>{p.date}</div>
      {p.open != null && row("Apertura", f2(p.open))}
      {row("Máximo", f2(p.high))}
      {row("Mínimo", f2(p.low))}
      {row("Cierre", f2(p.close), p.up ? C.pos : C.neg)}
      {p.sma50 != null && row("SMA 50", f2(p.sma50), C.blue)}
      {p.sma200 != null && row("SMA 200", f2(p.sma200), C.amber)}
      {p.rvol != null && row("Vol. relativo", `${p.rvol.toFixed(2)}×`)}
    </div>
  );
}

// Zonas de la posición: verde entre la entrada y el take profit, roja entre el stop y la entrada.
function positionLayers(position, rows) {
  if (!position?.plan) return null;
  const { plan, levels } = position;
  const first = rows[0]?.date, last = rows[rows.length - 1]?.date;
  if (!first || plan.startDate > last) return null;
  const x1 = plan.startDate < first ? first : rows.find((r) => r.date >= plan.startDate)?.date;
  const out = [];
  if (levels.target) out.push(<ReferenceArea key="tp-zone" x1={x1} x2={last} y1={plan.avgCost} y2={levels.target} fill={C.pos} fillOpacity={0.08} ifOverflow="extendDomain" />);
  if (levels.stop) out.push(<ReferenceArea key="sl-zone" x1={x1} x2={last} y1={levels.stop} y2={plan.avgCost} fill={C.neg} fillOpacity={0.08} ifOverflow="extendDomain" />);
  out.push(<ReferenceLine key="entry" y={plan.avgCost} stroke={C.accent} strokeDasharray="6 3" ifOverflow="extendDomain" label={lbl(`ENTRADA ${f2(plan.avgCost)}`, C.accent, "insideBottomRight")} />);
  if (levels.stop) out.push(<ReferenceLine key="stop" y={levels.stop} stroke={C.neg} strokeWidth={1.4} ifOverflow="extendDomain" label={lbl(`STOP ${f2(levels.stop)}`, C.neg, "insideBottomRight")} />);
  if (levels.target) out.push(<ReferenceLine key="tp" y={levels.target} stroke={C.pos} strokeWidth={1.4} ifOverflow="extendDomain" label={lbl(`TAKE PROFIT ${f2(levels.target)}`, C.pos, "insideTopRight")} />);
  const dates = new Set(rows.map((r) => r.date));
  plan.buys.filter((b) => dates.has(b.date)).forEach((b, i) => out.push(
    <ReferenceDot key={`buy-${i}`} x={b.date} y={b.price} r={5} fill={C.pos} stroke={C.bg} strokeWidth={1.5} label={lbl("COMPRA", C.pos, "bottom")} ifOverflow="extendDomain" />,
  ));
  plan.sells.filter((s) => dates.has(s.date)).forEach((s, i) => out.push(
    <ReferenceDot key={`sell-${i}`} x={s.date} y={s.price} r={5} fill={C.neg} stroke={C.bg} strokeWidth={1.5} label={lbl("VENTA", C.neg, "top")} ifOverflow="extendDomain" />,
  ));
  return out;
}

function levelLines(sr) {
  if (!sr) return null;
  const line = (l, i, kind) => {
    const color = kind === "S" ? C.pos : C.neg;
    return (
      <ReferenceLine key={`${kind}${i}`} y={l.price} stroke={color} strokeOpacity={0.35 + Math.min(0.5, l.touches * 0.1)} strokeWidth={Math.min(3, 0.8 + l.touches * 0.35)}
        label={lbl(`${kind === "S" ? "SOPORTE" : "RESISTENCIA"} ${f2(l.price)} · ${l.touches} toques`, color, kind === "S" ? "insideBottomLeft" : "insideTopLeft")} />
    );
  };
  return [...sr.supports.map((l, i) => line(l, i, "S")), ...sr.resistances.map((l, i) => line(l, i, "R"))];
}

function profileLines(profile) {
  if (!profile) return null;
  return [
    <ReferenceLine key="poc" y={profile.poc} stroke={C.amber} strokeDasharray="2 2" label={lbl(`POC ${f2(profile.poc)}`, C.amber, "insideRight")} />,
    <ReferenceLine key="vah" y={profile.vah} stroke={C.amber} strokeOpacity={0.4} strokeDasharray="1 4" label={lbl(`VAH ${f2(profile.vah)}`, C.amber, "insideRight")} />,
    <ReferenceLine key="val" y={profile.val} stroke={C.amber} strokeOpacity={0.4} strokeDasharray="1 4" label={lbl(`VAL ${f2(profile.val)}`, C.amber, "insideRight")} />,
  ];
}

function wyckoffLayers(events, range, rows) {
  const out = [];
  if (range) {
    const first = rows[0].date, last = rows[rows.length - 1].date;
    if (range.to >= first) {
      out.push(<ReferenceArea key="wy-range" x1={range.from < first ? first : range.from} x2={range.to > last ? last : range.to} y1={range.bottom} y2={range.top}
        fill={WYCKOFF_COLORS.AR} fillOpacity={0.07} stroke={WYCKOFF_COLORS.AR} strokeOpacity={0.35} strokeDasharray="3 3" label={lbl("RANGO WYCKOFF (AR–SC)", WYCKOFF_COLORS.AR)} />);
    }
  }
  events.forEach((ev, i) => out.push(
    <ReferenceDot key={`${ev.type}-${i}`} x={ev.date} y={ev.price} r={4} fill={WYCKOFF_COLORS[ev.type] || C.accent}
      fillOpacity={ev.status === "invalidado" ? 0.35 : 1} stroke={C.bg} strokeWidth={1}
      label={{ value: ev.type, position: BELOW.has(ev.type) ? "bottom" : "top", fill: WYCKOFF_COLORS[ev.type] || C.text, fontSize: 9, fontWeight: 600 }} />,
  ));
  return out;
}

export default function PriceChart({ rows, mode, show, events, wyRange, sr, profile, position, tickInterval, height = 420 }) {
  const held = position?.plan && rows.some((r) => r.closeHeld != null);
  const heldUp = held && rows[rows.length - 1].close >= position.plan.avgCost;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
        <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
        <YAxis stroke={C.muted} fontSize={10} domain={["auto", "auto"]} tick={{ fill: C.muted }} tickFormatter={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(2))} width={52} />
        <Tooltip content={<PriceTooltip />} />

        {show.position && positionLayers(position, rows)}
        {show.wyckoff && wyckoffLayers(events, wyRange, rows)}
        {show.levels && levelLines(sr)}
        {show.profile && profileLines(profile)}

        {show.boll && <Line dataKey="bbUpper" stroke={C.blue} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />}
        {show.boll && <Line dataKey="bbLower" stroke={C.blue} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />}

        {mode === "candles" ? (
          <Bar dataKey="hl" shape={<CandleShape />} isAnimationActive={false} />
        ) : (
          <Line dataKey={show.position && held ? "closePre" : "close"} stroke={C.accent} strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls={false} />
        )}
        {/* Tramo con la posición abierta: línea punteada desde la compra hasta hoy. */}
        {show.position && held && (
          <Line dataKey="closeHeld" stroke={heldUp ? C.pos : C.neg} strokeWidth={mode === "candles" ? 1.2 : 2} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls={false} />
        )}
        <Line dataKey="sma50" stroke={C.blue} strokeWidth={1} dot={false} isAnimationActive={false} />
        <Line dataKey="sma200" stroke={C.amber} strokeWidth={1} dot={false} isAnimationActive={false} />
        {show.trend && <Line dataKey="trendSup" stroke={C.pos} strokeWidth={1.3} strokeDasharray="8 4" dot={false} isAnimationActive={false} connectNulls={false} />}
        {show.trend && <Line dataKey="trendRes" stroke={C.neg} strokeWidth={1.3} strokeDasharray="8 4" dot={false} isAnimationActive={false} connectNulls={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
