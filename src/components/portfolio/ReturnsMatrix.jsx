import React, { useMemo } from "react";
import { C, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { trailingReturn, ytdReturn, totalReturn } from "../../lib/perf.js";

const PERIODS = [
  ["1D", (s) => trailingReturn(s, 1)],
  ["1S", (s) => trailingReturn(s, 5)],
  ["1M", (s) => trailingReturn(s, 21)],
  ["3M", (s) => trailingReturn(s, 63)],
  ["6M", (s) => trailingReturn(s, 126)],
  // YTD e INICIO se miden desde que existe la cartera, para comparar el mismo tramo.
  ["YTD", (s) => ytdReturn(s), true],
  ["INICIO", (s) => totalReturn(s), true],
];

// Intensidad del color según el tamaño del retorno (satura en ±15%).
function heat(v) {
  if (v == null) return "transparent";
  const strength = Math.min(1, Math.abs(v) / 0.15);
  return `color-mix(in srgb, ${v >= 0 ? C.pos : C.neg} ${Math.round(8 + strength * 34)}%, transparent)`;
}

const signed = (v, d = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}`;

function Cell({ value, excess }) {
  return (
    <div style={{ background: heat(value), border: `1px solid ${C.border}`, borderRadius: 2, padding: "7px 6px 6px", textAlign: "center", minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: value == null ? C.muted : C.text }}>
        {value == null ? "—" : `${signed(value)}%`}
      </div>
      <div style={{ fontFamily: mono, fontSize: 9.5, color: excess == null ? C.muted : excess >= 0 ? C.pos : C.neg, height: 13 }}>
        {excess == null ? "" : `${signed(excess)} pp`}
      </div>
    </div>
  );
}

// Mapa de calor de retornos por plazo. Cada celda muestra el retorno y, debajo,
// la diferencia en puntos porcentuales contra el S&P 500 en ese mismo plazo.
export default function ReturnsMatrix({ index, benchSeries, spyHistory }) {
  const rows = useMemo(() => {
    const spyAligned = benchSeries.find((b) => b.id === "spy")?.series || [];
    const spy = PERIODS.map(([, fn, aligned]) => fn(aligned ? spyAligned : spyHistory));
    // `from`: una referencia que arranca después que la cartera se compara contra
    // el S&P 500 medido desde SU fecha de inicio, no desde la de la cartera.
    const make = (id, name, color, series, from) => {
      const own = from ? PERIODS.map(([, fn, aligned]) => fn(aligned ? spyAligned.filter((p) => p.date >= from) : spyHistory)) : spy;
      return {
        id, name, color,
        cells: PERIODS.map(([, fn], i) => {
          const value = fn(series);
          return { value, excess: value != null && own[i] != null ? value - own[i] : null };
        }),
      };
    };
    const others = benchSeries.filter((b) => b.id !== "spy").map((b) => make(b.id, b.name, b.color, b.series, b.series[0]?.date));
    return [make("port", "Cartera", C.accent, index, null), { id: "spy", name: "S&P 500", color: C.spy, cells: spy.map((value) => ({ value, excess: null })) }, ...others];
  }, [index, benchSeries, spyHistory]);

  const template = `92px repeat(${PERIODS.length}, minmax(58px, 1fr))`;

  return (
    <Panel title="Rentabilidad por plazo" right="abajo de cada cifra: puntos contra el S&P 500">
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 540 }}>
          <div style={{ display: "grid", gridTemplateColumns: template, gap: 4, marginBottom: 4 }}>
            <span />
            {PERIODS.map(([label]) => (
              <span key={label} style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", color: C.muted, textAlign: "center" }}>{label}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: template, gap: 4, marginBottom: 4, alignItems: "stretch" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: mono, fontSize: 11, color: C.text, borderLeft: `3px solid ${row.color}`, paddingLeft: 8 }}>{row.name}</span>
              {row.cells.map((cell, i) => <Cell key={PERIODS[i][0]} value={cell.value} excess={cell.excess} />)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
        “—” significa que la cartera todavía no tiene historia suficiente para ese plazo. YTD e INICIO se miden desde la primera orden, en la cartera y en el índice.
      </div>
    </Panel>
  );
}
