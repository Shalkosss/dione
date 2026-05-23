import React from "react";
import { C } from "../theme.js";

export function Panel({ title, right, children, style }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: "hidden",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${C.border}`,
            fontSize: 11,
            color: C.muted,
            letterSpacing: "0.08em",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{title}</span>
          {right}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.muted }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          color: color || C.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
