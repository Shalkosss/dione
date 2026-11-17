import React, { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { C, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";

const RANGES = [["1M", 21], ["3M", 63], ["6M", 126], ["1A", 252], ["TODO", Infinity]];
const tick = { fill: C.muted, fontSize: 10, fontFamily: mono };
const PORT_COLOR = C.accent;

// Une las series por fecha y las rebasa a 100 al inicio de la ventana elegida,
// para que todas partan del mismo punto.
function buildRows(lines, sessions) {
  const port = lines[0].series;
  const window = Number.isFinite(sessions) ? port.slice(-(sessions + 1)) : port;
  if (window.length < 2) return [];
  const start = window[0].date;
  const portBase = window[0].value;
  const portAt = new Map(window.map((p) => [p.date, (p.value / portBase) * 100]));
  const maps = lines.map((l) => {
    const map = new Map(l.series.map((p) => [p.date, p.value]));
    const first = l.series.find((p) => p.date >= start);
    // Una línea que arranca después del inicio de la ventana parte del nivel
    // que tenía la cartera ese día, no de 100 en medio del gráfico.
    const anchor = map.has(start) || !first ? 100 : portAt.get(first.date) ?? 100;
    return { id: l.id, map, base: map.get(start) ?? first?.value, anchor };
  });
  return window.map((p) => maps.reduce((row, m) => {
    const v = m.map.get(p.date);
    return { ...row, [m.id]: v != null && m.base > 0 ? (v / m.base) * m.anchor : null };
  }, { date: p.date }));
}

// Carrera de la cartera contra sus benchmarks, todo en base 100.
export default function RaceChart({ index, benchSeries, right }) {
  const [range, setRange] = useState("TODO");
  const [hidden, setHidden] = useState([]);

  const lines = useMemo(() => [{ id: "port", name: "Cartera", color: PORT_COLOR, series: index }, ...benchSeries], [index, benchSeries]);
  const sessions = RANGES.find(([k]) => k === range)[1];
  const rows = useMemo(() => buildRows(lines, sessions), [lines, sessions]);
  const last = rows[rows.length - 1] || {};

  const toggle = (id) => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));

  return (
    <Panel
      title="Cartera contra benchmarks · base 100"
      right={(
        <>
          {right}
          <span style={{ display: "inline-flex" }}>
            {RANGES.map(([k]) => (
              <button key={k} className="dione-chip" data-active={range === k} onClick={() => setRange(k)} style={{ height: 22, padding: "0 7px", marginLeft: -1, fontSize: 10 }}>{k}</button>
            ))}
          </span>
        </>
      )}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {lines.map((l) => {
          const v = last[l.id];
          const off = hidden.includes(l.id);
          return (
            <button key={l.id} onClick={() => toggle(l.id)} title="Mostrar u ocultar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: C.panel2, border: `1px solid ${C.border}`, borderLeft: `3px solid ${l.color}`, borderRadius: 2, cursor: "pointer", opacity: off ? 0.4 : 1, fontFamily: mono, fontSize: 11, color: C.text }}>
              <span style={{ color: C.muted }}>{l.name}</span>
              <span style={{ fontWeight: 600, color: v == null ? C.muted : v >= 100 ? C.pos : C.neg }}>
                {v == null ? "—" : `${v >= 100 ? "+" : ""}${(v - 100).toFixed(2)}%`}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length < 2 ? (
        <div style={{ height: 300, display: "grid", placeItems: "center", color: C.muted, fontSize: 12 }}>
          Todavía no hay dos sesiones de historia para dibujar la curva.
        </div>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" tick={tick} tickFormatter={(d) => d.slice(5)} minTickGap={48} stroke={C.border} />
              <YAxis domain={["auto", "auto"]} tick={tick} stroke={C.border} width={44} tickFormatter={(v) => v.toFixed(0)} />
              <ReferenceLine y={100} stroke={C.borderStrong} />
              <Tooltip
                contentStyle={{ background: C.panel2, border: `1px solid ${C.borderStrong}`, fontFamily: mono, fontSize: 11 }}
                labelStyle={{ color: C.muted }}
                formatter={(v, name) => [v == null ? "—" : `${(v - 100 >= 0 ? "+" : "")}${(v - 100).toFixed(2)}%`, name]}
              />
              {lines.filter((l) => !hidden.includes(l.id)).map((l) => (
                <Line key={l.id} type="linear" dataKey={l.id} name={l.name} stroke={l.color} strokeWidth={l.id === "port" ? 2.2 : 1.3} dot={false} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
