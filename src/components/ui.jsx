import React from "react";
import { C, mono, radius } from "../theme.js";

// Tarjeta de indicador: número grande con una franja de color a la izquierda.
export function KpiCard({ label, value, color = C.text, hint }) {
  return (
    <div
      className="dione-panel"
      style={{
        position: "relative",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: radius.lg,
        boxShadow: "var(--shadow)",
        padding: "14px 16px 14px 20px",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderRadius: 3, background: color === C.text ? C.border : color }} />
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color, fontVariantNumeric: "tabular-nums", lineHeight: 1.25 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children, min = 150 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

// Selector de pestañas en una sola pieza. options: [{ key, label, count? }]
export function Segmented({ options, value, onChange }) {
  return (
    <div role="tablist" style={{ display: "inline-flex", padding: 2, gap: 2, borderRadius: 2, background: C.panel2, border: `1px solid ${C.border}` }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "5px 12px", borderRadius: 2, cursor: "pointer",
              border: "1px solid transparent",
              background: active ? C.panel : "transparent",
              boxShadow: "none",
              color: active ? C.text : C.muted,
              fontFamily: "inherit", fontSize: 12.5, fontWeight: active ? 600 : 500,
            }}
          >
            {o.label}
            {o.count != null && (
              <span style={{ fontFamily: mono, fontSize: 10.5, padding: "0 6px", borderRadius: 2, background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.muted }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Mensaje para listas vacías.
export function EmptyState({ title, children }) {
  return (
    <div style={{ padding: "30px 16px", textAlign: "center" }}>
      <div style={{ width: 38, height: 38, margin: "0 auto 12px", borderRadius: 2, background: C.accentSoft, border: `1px dashed ${C.accent}` }} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{title}</div>
      {children && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 440, marginInline: "auto" }}>{children}</div>}
    </div>
  );
}

// Etiqueta de estado con fondo suave. tone: pos | neg | accent | blue | muted
const TONES = {
  pos: [C.pos, C.posSoft],
  neg: [C.neg, C.negSoft],
  accent: [C.accent, C.accentSoft],
  blue: [C.blue, C.blueSoft],
  muted: [C.muted, C.panel2],
};

export function Badge({ tone = "muted", children }) {
  const [fg, bg] = TONES[tone] || TONES.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 9px", borderRadius: 20, background: bg, color: fg, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: fg }} />
      {children}
    </span>
  );
}
