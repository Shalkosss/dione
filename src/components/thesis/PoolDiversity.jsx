import React from "react";
import { C, mono } from "../../theme.js";

const pct = (v) => `${Math.round(v * 100)}%`;

// Regla de diversidad del pool: no más del 40% de las tesis vivas en un mismo
// sector o tema. Recibe `diversity` de /api/theses/stats (lib/thesisStats.js).
export default function PoolDiversity({ diversity, compact = false }) {
  if (!diversity || !diversity.live) return null;
  const { live, cap, evaluated, groups, breaches } = diversity;
  const top = groups[0];

  if (!evaluated) {
    return (
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: compact ? 10 : 0 }}>
        Diversidad del pool: {live} tesis viva{live === 1 ? "" : "s"}. La regla del {pct(cap)} se evalúa desde 3.
      </div>
    );
  }
  if (!breaches.length) {
    return (
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: compact ? 10 : 0 }}>
        Diversidad del pool: dentro del tope del {pct(cap)}.
        {top && <> Mayor concentración: <span style={{ fontFamily: mono, color: C.text }}>{top.name}</span> con {pct(top.share)} de {live} tesis vivas.</>}
      </div>
    );
  }
  return (
    <ul style={{ margin: compact ? "10px 0 0" : 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
      {breaches.map((g) => (
        <li key={`${g.kind}-${g.name}`} style={{ fontSize: 11.5, padding: "5px 9px", borderLeft: `3px solid ${C.neg}`, background: C.negSoft, color: C.text }}>
          {g.kind === "tema" ? "Tema" : "Sector"} <b>{g.name}</b>: {g.n} de {live} tesis vivas ({pct(g.share)}), supera el tope del {pct(cap)}.{" "}
          <span style={{ fontFamily: mono, color: C.muted }}>{g.tickers.join(" · ")}</span>
        </li>
      ))}
    </ul>
  );
}
