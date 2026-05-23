import React from "react";
import { C } from "../theme.js";
import { Panel } from "../components/Panel.jsx";

export default function Placeholder({ title, phase, desc, features }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0, color: C.text }}>{title}</h1>
        <span
          style={{
            fontSize: 10,
            color: C.accent,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          FASE {phase} — EN CONSTRUCCIÓN
        </span>
      </div>

      <Panel title="QUÉ VA A HACER ESTE MÓDULO">
        <p style={{ fontSize: 13, color: C.text, marginTop: 0, lineHeight: 1.6 }}>
          {desc}
        </p>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
          INCLUIRÁ:
        </div>
        {features.map((f, i) => (
          <div
            key={i}
            style={{ fontSize: 12.5, color: C.text, padding: "3px 0" }}
          >
            <span style={{ color: C.accent }}>›</span> {f}
          </div>
        ))}
      </Panel>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: C.muted,
          lineHeight: 1.6,
        }}
      >
        Fase 1 (Optimizer + Risk Engine) ya está operativa. Este módulo se
        construye después — no es un placeholder vacío, es el roadmap real.
      </div>
    </div>
  );
}
