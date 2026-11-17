import React from "react";
import { C, mono, radius } from "../theme.js";

// Panel de terminal: cabecera con título en mono y cuerpo.
// `flush` quita el relleno del cuerpo (para tablas a sangre).
export function Panel({ title, right, children, style, flush = false }) {
  return (
    <section
      className="dione-panel"
      style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: radius.lg, overflow: "hidden", minWidth: 0, ...style }}
    >
      {title && (
        <header
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "7px 12px", borderBottom: `1px solid ${C.border}`, background: C.panel2,
            fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 3, height: 11, background: C.accent, flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          </span>
          {right && <span style={{ fontWeight: 400, letterSpacing: "0.03em", textTransform: "none", color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>{right}</span>}
        </header>
      )}
      <div style={{ padding: flush ? 0 : 14 }}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 9.5, color: C.muted, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 600, color: color || C.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
