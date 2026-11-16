import React from "react";
import { C, th, td } from "../../theme.js";
import { Panel, Stat } from "../Panel.jsx";
import { pctSigned, signColor } from "./ThesisTable.jsx";

const MIN_READ = 30; // THESIS_LOG.md: primera lectura con 30 registros

const pct0 = (v) => (v == null ? "—" : `${(v * 100).toFixed(0)}%`);
const rTxt = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}R`);

function AlphaCell({ h }) {
  if (!h || !h.n) return <td style={{ ...td, color: C.muted }}>—</td>;
  return (
    <td style={{ ...td, color: signColor(h.mean) }} title={`mediana ${pctSigned(h.median)}`}>
      {pctSigned(h.mean)} <span style={{ color: C.muted, fontSize: 10 }}>n={h.n}</span>
    </td>
  );
}

function AlphaTable({ title, groups }) {
  if (!groups?.length) return null;
  return (
    <div style={{ minWidth: 300, flex: 1 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ ...th, textAlign: "left" }}>{title}</th>
            <th style={th}>n</th><th style={th}>20s</th><th style={th}>60s</th><th style={th}>120s</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ ...td, textAlign: "left" }}>{g.key}</td>
              <td style={{ ...td, color: C.muted }}>{g.n}</td>
              <AlphaCell h={g.h20} /><AlphaCell h={g.h60} /><AlphaCell h={g.h120} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Métricas de la sección 6 de THESIS_LOG.md. `stats` viene de /api/theses/stats.
export default function EfficiencyPanel({ stats }) {
  if (!stats || !stats.total) return null;
  const { limit, expired, trades, alpha } = stats;
  return (
    <Panel
      title="EFICIENCIA DE LOS DEEPS — ALFA CONTRA SPY DESDE REF_PRICE"
      right={stats.total < MIN_READ && <span style={{ fontSize: 10, color: C.accent }}>{stats.total} de {MIN_READ} registros: todavía es ruido</span>}
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="EJECUCIÓN DE LIMIT" value={limit.fillRate == null ? "—" : `${pct0(limit.fillRate)} (${limit.filled}/${limit.resolved})`}
          color={limit.fillRate == null ? C.muted : limit.fillRate < 0.4 ? C.neg : C.text} />
        <Stat label="SESIONES HASTA EJECUTAR" value={limit.medianSessionsToFill ?? "—"} />
        <Stat label={`RETORNO PERDIDO (${expired.n} EXP.)`} value={pctSigned(expired.avgMissedRet)} color={signColor(expired.avgMissedRet == null ? null : -expired.avgMissedRet)} />
        <Stat label={`ACIERTO (${trades.n} CERRADAS)`} value={pct0(trades.winRate)} />
        <Stat label="EXPECTATIVA" value={rTxt(trades.expectancy)} color={signColor(trades.expectancy)} />
        <Stat label="ALFA 60S (TODAS)" value={pctSigned(alpha.overall.h60.mean)} color={signColor(alpha.overall.h60.mean)} />
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <AlphaTable title="Rating" groups={alpha.byRating} />
        <AlphaTable title="Convicción" groups={alpha.byConviction} />
        <AlphaTable title="Sector" groups={alpha.bySector} />
        <AlphaTable title="Tendencia al emitir" groups={alpha.byTrendLabel} />
      </div>
    </Panel>
  );
}
