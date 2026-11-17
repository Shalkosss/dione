import React from "react";
import { C, th, td, sans } from "../../theme.js";

export const STATUS_CFG = {
  SIN_ORDEN:      { color: C.muted,  label: "SIN ORDEN" },
  ARMADA:         { color: C.amber,  label: "ARMADA" },
  ABIERTA:        { color: C.blue,   label: "ABIERTA" },
  CERRADA_TP:     { color: C.pos,    label: "OBJETIVO" },
  CERRADA_STOP:   { color: C.neg,    label: "STOP" },
  CERRADA_TIEMPO: { color: C.muted,  label: "TIEMPO" },
  CERRADA_TESIS:  { color: C.neg,    label: "TESIS ROTA" },
  EXPIRADA:       { color: C.muted,  label: "EXPIRADA" },
  INVALIDADA:     { color: C.muted,  label: "INVALIDADA" },
};

export const FLAG_LABEL = {
  EARNINGS: "Earnings",
  REGIMEN: "Régimen",
  SECTOR: "Sector",
  LIMIT_LEJOS: "Limit lejos",
  SIN_1R_60: "60s sin +1R",
  SIN_REVISION_90D: "+90 días",
};

export const pctSigned = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
export const signColor = (v) => (v == null ? C.muted : v > 0 ? C.pos : v < 0 ? C.neg : C.text);
export const price = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color: C.muted, label: status };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 9px", borderRadius: 20,
        background: `color-mix(in srgb, ${cfg.color} 14%, transparent)`,
        color: cfg.color, fontFamily: sans, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

export function FlagChips({ codes }) {
  if (!codes?.length) return <span style={{ color: C.muted }}>—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {codes.map((code) => (
        <span key={code} style={{ fontFamily: sans, fontSize: 10, fontWeight: 600, color: C.amber, background: `color-mix(in srgb, ${C.amber} 13%, transparent)`, borderRadius: 20, padding: "1px 8px" }}>
          {FLAG_LABEL[code] || code}
        </span>
      ))}
    </span>
  );
}

const left = { textAlign: "left", whiteSpace: "nowrap" };
const COLUMNS = [
  ["Estado", left], ["Ticker", left], ["Rating", left], ["Emisión", left], ["Días"],
  ["Precio"], ["A entrada"], ["A stop"], ["A objetivo"], ["R"], ["Alfa SPY"], ["Banderas"],
];

// Tabla principal: una fila por tesis. `rows` viene de thesisView.toRow.
export default function ThesisTable({ rows, selectedId, onSelect }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {COLUMNS.map(([label, style]) => <th key={label} style={{ ...th, ...style }}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="dione-hover"
              onClick={() => onSelect(r.id)}
              style={{
                borderBottom: `1px solid ${C.border}`,
                cursor: "pointer",
                background: r.id === selectedId ? C.accentSoft : "transparent",
              }}
            >
              <td style={{ ...td, ...left }}><StatusBadge status={r.status} /></td>
              <td style={{ ...td, ...left, color: C.accent, fontWeight: 600 }}>
                {r.ticker}
                {r.needsPostMortem && <span title="Post-mortem pendiente" style={{ color: C.neg }}> ●</span>}
              </td>
              <td style={{ ...td, ...left }}>{r.rating}{r.conviction ? ` · ${r.conviction}` : ""}</td>
              <td style={{ ...td, ...left, color: C.muted }}>{r.entryDate}</td>
              <td style={td}>{r.days}</td>
              <td style={td}>{price(r.price)}</td>
              <td style={td}>{pctSigned(r.toEntry)}</td>
              <td style={td}>{pctSigned(r.toStop)}</td>
              <td style={td}>{pctSigned(r.toTarget)}</td>
              <td style={{ ...td, color: signColor(r.r) }}>{r.r == null ? "—" : `${r.r >= 0 ? "+" : ""}${Number(r.r).toFixed(2)}R`}</td>
              <td style={{ ...td, color: signColor(r.alphaSpy) }}>{pctSigned(r.alphaSpy)}</td>
              <td style={{ ...td, minWidth: 110 }}><FlagChips codes={r.flags} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
