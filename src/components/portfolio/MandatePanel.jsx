import React, { useMemo } from "react";
import { C, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { SLEEVE_RANGES, sleeveWeights, mandateChecks } from "../../lib/sectors.js";

const SCALE = 0.7; // el eje de las barras llega a 70% de la cuenta

// Núcleo-satélite contra los rangos de MANDATE.md. La banda marcada es el rango
// permitido; la barra es el peso actual.
export default function MandatePanel({ valued, accountId }) {
  const cashWeight = valued.total > 0 ? valued.cash / valued.total : 1;
  const sleeves = useMemo(() => sleeveWeights(valued.rows, cashWeight), [valued, cashWeight]);
  const alerts = useMemo(() => mandateChecks(valued.rows, cashWeight, accountId), [valued, cashWeight, accountId]);

  return (
    <Panel title="Mandato · núcleo y satélite" right={alerts.length ? `${alerts.length} fuera de rango` : "dentro de rango"}>
      <div style={{ display: "grid", gap: 9 }}>
        {Object.entries(SLEEVE_RANGES).map(([key, range]) => {
          const w = sleeves[key];
          const inside = w >= range.min - 0.005 && w <= range.max + 0.005;
          const color = !valued.rows.length ? C.muted : inside ? C.pos : w > range.max ? C.neg : C.amber;
          return (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, marginBottom: 3 }}>
                <span style={{ color: C.text }}>{range.label}</span>
                <span style={{ color: C.muted }}>
                  rango {(range.min * 100).toFixed(0)}–{(range.max * 100).toFixed(0)}% · <b style={{ color }}>{(w * 100).toFixed(1)}%</b>
                </span>
              </div>
              <div style={{ position: "relative", height: 10, background: C.panel2 }}>
                <span style={{ position: "absolute", top: 0, bottom: 0, left: `${(range.min / SCALE) * 100}%`, width: `${((range.max - range.min) / SCALE) * 100}%`, background: C.accentSoft, borderLeft: `1px solid ${C.accent}`, borderRight: `1px solid ${C.accent}` }} />
                <span style={{ position: "absolute", top: 3, bottom: 3, left: 0, width: `${Math.min(100, (w / SCALE) * 100)}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {alerts.map((a) => (
            <li key={a.text} style={{ fontSize: 11.5, padding: "5px 9px", borderLeft: `3px solid ${a.level === "alerta" ? C.neg : C.amber}`, background: a.level === "alerta" ? C.negSoft : C.amberSoft, color: C.text }}>
              {a.text}
            </li>
          ))}
        </ul>
      )}
      {!valued.rows.length && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Con la cuenta en caja no hay nada que controlar todavía.</div>}
    </Panel>
  );
}
