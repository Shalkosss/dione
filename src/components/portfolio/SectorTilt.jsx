import React, { useMemo } from "react";
import { C, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { sectorExposure, activeWeights, SPY_WEIGHTS_AS_OF } from "../../lib/sectors.js";

const pct = (v) => `${(v * 100).toFixed(1)}%`;

// Sectores de la cartera contra el S&P 500. Los ETFs amplios se abren en sus
// sectores. La barra central muestra la apuesta activa: a la derecha
// sobreponderado, a la izquierda subponderado.
export default function SectorTilt({ valued }) {
  const rows = useMemo(() => {
    const cashWeight = valued.total > 0 ? valued.cash / valued.total : 1;
    return activeWeights(sectorExposure(valued.rows, cashWeight)).sort((a, b) => b.active - a.active);
  }, [valued]);

  const maxWeight = Math.max(0.01, ...rows.map((r) => Math.max(r.port, r.bench)));
  const maxActive = Math.max(0.01, ...rows.map((r) => Math.abs(r.active)));

  return (
    <Panel title="Sectores contra el S&P 500" right={`pesos del índice: ${SPY_WEIGHTS_AS_OF}`}>
      <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr) minmax(0,1fr) 58px", gap: "0 10px", alignItems: "center", fontFamily: mono, fontSize: 10.5 }}>
        <span style={{ color: C.muted, letterSpacing: "0.08em" }}>SECTOR</span>
        <span style={{ color: C.muted, letterSpacing: "0.08em" }}><span style={{ color: C.accent }}>■</span> CARTERA <span style={{ color: C.spy, marginLeft: 6 }}>■</span> S&P 500</span>
        <span style={{ color: C.muted, letterSpacing: "0.08em", textAlign: "center" }}>− APUESTA ACTIVA +</span>
        <span style={{ color: C.muted, textAlign: "right" }}>PP</span>

        {rows.map((r) => (
          <React.Fragment key={r.sector}>
            <span style={{ color: C.text, padding: "5px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sector}</span>
            <div title={`Cartera ${pct(r.port)} · S&P 500 ${pct(r.bench)}`} style={{ display: "grid", gap: 2 }}>
              <div style={{ height: 6, width: `${(r.port / maxWeight) * 100}%`, minWidth: r.port > 0 ? 2 : 0, background: C.accent }} />
              <div style={{ height: 4, width: `${(r.bench / maxWeight) * 100}%`, minWidth: r.bench > 0 ? 2 : 0, background: C.spy, opacity: 0.7 }} />
            </div>
            <div style={{ position: "relative", height: 14, background: C.panel2 }}>
              <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.borderStrong }} />
              <span
                style={{
                  position: "absolute", top: 2, bottom: 2,
                  left: r.active >= 0 ? "50%" : `${50 - (Math.abs(r.active) / maxActive) * 50}%`,
                  width: `${(Math.abs(r.active) / maxActive) * 50}%`,
                  background: r.active >= 0 ? C.pos : C.neg,
                }}
              />
            </div>
            <span style={{ textAlign: "right", color: Math.abs(r.active) < 0.005 ? C.muted : r.active > 0 ? C.pos : C.neg }}>
              {r.active >= 0 ? "+" : ""}{(r.active * 100).toFixed(1)}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
        VOO, SPY, IVV, VTI y QQQ se reparten entre sus sectores. Los pesos del índice son aproximados y se cargan a mano.
      </div>
    </Panel>
  );
}
