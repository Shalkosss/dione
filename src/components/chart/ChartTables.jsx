import React from "react";
import { C, mono, th, td } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { WYCKOFF_COLORS } from "../../lib/wyckoff.js";

const f2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const left = { textAlign: "left" };
const STATUS_COLOR = { confirmado: C.pos, pendiente: C.amber, invalidado: C.neg, "sin test": C.muted };

export function WyckoffTable({ events, phase }) {
  return (
    <Panel title={`Eventos Wyckoff · ${events.length}`} right={phase ? `fase ${phase.phase ?? "—"} · ${phase.label}` : "sin fase clara"} flush>
      {events.length === 0 ? (
        <div style={{ padding: 14, fontSize: 11.5, color: C.muted }}>No hay eventos en el rango visible.</div>
      ) : (
        <div style={{ overflowX: "auto", maxHeight: 320 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[["Evento", left], ["Fecha", left], ["Precio"], ["Nivel"], ["Vol. rel."], ["Estado", left], ["Detalle", left]].map(([l, s]) => <th key={l} style={{ ...th, ...s, background: C.panel }}>{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...events].reverse().map((ev, i) => (
                <tr key={`${ev.type}-${ev.idx}-${i}`} style={{ borderBottom: `1px solid ${C.border}`, opacity: ev.status === "invalidado" ? 0.55 : 1 }}>
                  <td style={{ ...td, ...left, color: WYCKOFF_COLORS[ev.type], fontWeight: 700 }}>{ev.type}{ev.variant ? ` ${ev.variant}` : ""}</td>
                  <td style={{ ...td, ...left, color: C.muted }}>{ev.date}</td>
                  <td style={td}>{f2(ev.price)}</td>
                  <td style={{ ...td, color: C.muted }}>{f2(ev.level)}</td>
                  <td style={{ ...td, color: ev.rvol >= 1.5 ? C.amber : ev.rvol != null && ev.rvol < 0.8 ? C.blue : C.text }}>{ev.rvol != null ? `${ev.rvol.toFixed(2)}×` : "—"}</td>
                  <td style={{ ...td, ...left, color: STATUS_COLOR[ev.status] || C.muted, fontSize: 10.5 }}>{ev.status || (ev.volClass ?? "")}</td>
                  <td style={{ ...td, ...left, color: C.muted, fontSize: 10.5, whiteSpace: "normal" }}>{ev.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function LevelsTable({ sr, lines, profile, price }) {
  const rows = [
    ...(sr?.resistances || []).map((l) => ({ kind: "Resistencia", color: C.neg, price: l.price, info: `${l.touches} toques` })),
    ...(lines?.resistance ? [{ kind: `Directriz de máximos (${lines.resistance.slope >= 0 ? "sube" : "baja"})`, color: C.neg, price: lines.resistance.endPrice, info: `une los 2 últimos máximos, proyectada a hoy${price > lines.resistance.endPrice ? " · el precio la superó" : ""}` }] : []),
    ...(profile ? [{ kind: "POC (más volumen)", color: C.amber, price: profile.poc, info: `área de valor ${f2(profile.val)}–${f2(profile.vah)}` }] : []),
    ...(lines?.support ? [{ kind: `Directriz de mínimos (${lines.support.slope >= 0 ? "sube" : "baja"})`, color: C.pos, price: lines.support.endPrice, info: `une los 2 últimos mínimos, proyectada a hoy${price < lines.support.endPrice ? " · el precio la perdió" : ""}` }] : []),
    ...(sr?.supports || []).map((l) => ({ kind: "Soporte", color: C.pos, price: l.price, info: `${l.touches} toques` })),
  ].sort((a, b) => b.price - a.price);
  return (
    <Panel title="Niveles automáticos" right={sr?.tolerance ? `agrupa pivotes a ±${f2(sr.tolerance)} (0.75 ATR)` : null} flush>
      {rows.length === 0 ? (
        <div style={{ padding: 14, fontSize: 11.5, color: C.muted }}>Hace falta más historia para ubicar niveles.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {[["Nivel", left], ["Precio"], ["Distancia"], ["Detalle", left]].map(([l, s]) => <th key={l} style={{ ...th, ...s }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ ...td, ...left, color: r.color }}>{r.kind}</td>
                <td style={td}>{f2(r.price)}</td>
                <td style={{ ...td, color: C.muted }}>{price ? `${r.price >= price ? "+" : ""}${((r.price / price - 1) * 100).toFixed(1)}%` : "—"}</td>
                <td style={{ ...td, ...left, color: C.muted, fontSize: 10.5 }}>{r.info}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ padding: "8px 12px", fontFamily: mono, fontSize: 10, color: C.muted, borderTop: `1px solid ${C.border}` }}>
        Descriptivos: sirven para ubicar el stop y la entrada límite. Los estudios del repo no les encontraron poder predictivo por sí solos.
      </div>
    </Panel>
  );
}
