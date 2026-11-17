import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { C, mono, panel } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { fetchMany } from "../lib/priceHistory.js";
import { sectorBoard, marketRegime } from "../lib/marketBoard.js";
import { SECTOR_ETFS } from "../lib/sectors.js";

const COLUMNS = [["1D", "r1d", 0.02], ["1M", "r1m", 0.08], ["3M", "r3m", 0.15], ["6M", "r6m", 0.25], ["12M", "r12m", 0.4]];
const TONE = { pos: C.pos, neg: C.neg, amber: C.amber, muted: C.muted };
const signed = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);

function heat(v, scale) {
  if (v == null) return "transparent";
  const strength = Math.min(1, Math.abs(v) / scale);
  return `color-mix(in srgb, ${v >= 0 ? C.pos : C.neg} ${Math.round(8 + strength * 38)}%, transparent)`;
}

function Gauge({ label, value, color, note }) {
  return (
    <div style={{ padding: "10px 16px", borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.1em", color: C.muted }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 21, fontWeight: 600, color, lineHeight: 1.3, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{note}</div>
    </div>
  );
}

// Módulo 3: régimen de mercado y tablero de los 11 sectores, calculado en el
// navegador con velas de Yahoo. No gasta tokens ni usa keys.
export default function Market() {
  const [prices, setPrices] = useState(null);
  const [sortKey, setSortKey] = useState("rs3m");

  useEffect(() => {
    let cancelled = false;
    fetchMany(["SPY", "^VIX", ...Object.keys(SECTOR_ETFS)], 420).then((data) => { if (!cancelled) setPrices(data); });
    return () => { cancelled = true; };
  }, []);

  const board = useMemo(() => (prices ? sectorBoard(prices) : []), [prices]);
  const regime = useMemo(() => (prices ? marketRegime(prices, board) : null), [prices, board]);
  const rows = useMemo(() => [...board].sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity)), [board, sortKey]);

  if (!prices) return <div style={{ ...panel, color: C.muted, fontFamily: mono, fontSize: 11.5 }}>bajando 13 series de precios…</div>;
  if (!prices.SPY?.length) return <div style={{ ...panel, borderColor: C.neg, color: C.neg, fontSize: 12 }}>Yahoo no devolvió precios. Reintentá en unos segundos.</div>;

  const asOf = prices.SPY[prices.SPY.length - 1].date;
  const template = `minmax(120px, 1.4fr) repeat(${COLUMNS.length}, minmax(60px, 1fr)) minmax(120px, 1.3fr) 70px`;
  const maxRs = Math.max(0.01, ...board.map((r) => Math.abs(r.rs3m ?? 0)));

  return (
    <div>
      <div style={{ ...panel, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 12, overflow: "hidden", borderLeft: `3px solid ${TONE[regime.tone]}` }}>
        <Gauge label="RÉGIMEN" value={regime.label} color={TONE[regime.tone]} note={`datos al ${asOf}`} />
        <Gauge label="S&P 500 VS MEDIA DE 200" value={signed(regime.spyDist)} color={regime.spyDist > 0 ? C.pos : C.neg} note={regime.spyDist > 0 ? "tendencia de fondo alcista" : "por debajo de su tendencia"} />
        <Gauge label="VIX" value={regime.vix == null ? "—" : regime.vix.toFixed(1)} color={regime.vix == null ? C.muted : regime.vix >= 22 ? C.neg : regime.vix >= 17 ? C.amber : C.pos} note="bajo 17 calma · sobre 22 tensión" />
        <Gauge label="SECTORES SOBRE SU MEDIA DE 200" value={`${regime.sectorsAbove} de ${regime.sectorsKnown}`} color={regime.breadth >= 0.5 ? C.pos : C.neg} note="amplitud: cuántos sectores acompañan" />
      </div>

      <Panel title="Tablero sectorial" right="clic en un encabezado para ordenar">
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: template, gap: 4, marginBottom: 5, fontFamily: mono, fontSize: 10, letterSpacing: "0.08em", color: C.muted }}>
              <span>SECTOR</span>
              {COLUMNS.map(([label, key]) => (
                <button key={key} onClick={() => setSortKey(key)} style={{ background: "transparent", border: "none", cursor: "pointer", font: "inherit", letterSpacing: "inherit", color: sortKey === key ? C.accent : C.muted, textAlign: "center" }}>{label}{sortKey === key ? " ▾" : ""}</button>
              ))}
              <button onClick={() => setSortKey("rs3m")} style={{ background: "transparent", border: "none", cursor: "pointer", font: "inherit", letterSpacing: "inherit", color: sortKey === "rs3m" ? C.accent : C.muted, textAlign: "center" }}>FUERZA VS SPY 3M{sortKey === "rs3m" ? " ▾" : ""}</button>
              <span style={{ textAlign: "right" }}>MEDIA 200</span>
            </div>

            {rows.map((r) => (
              <div key={r.etf} style={{ display: "grid", gridTemplateColumns: template, gap: 4, marginBottom: 4, alignItems: "stretch" }}>
                <Link to={`/chart?t=${r.etf}`} title="Ver gráfico" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 11.5, minWidth: 0 }}>
                  <span style={{ color: C.accent, fontWeight: 700, width: 40 }}>{r.etf}</span>
                  <span style={{ color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sector}</span>
                </Link>
                {COLUMNS.map(([label, key, scale]) => (
                  <span key={label} style={{ background: heat(r[key], scale), border: `1px solid ${C.border}`, padding: "7px 4px", textAlign: "center", fontFamily: mono, fontSize: 12, fontWeight: 600, color: r[key] == null ? C.muted : C.text }}>
                    {signed(r[key])}
                  </span>
                ))}
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ position: "relative", flex: 1, height: 12, background: C.panel2 }}>
                    <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.borderStrong }} />
                    {r.rs3m != null && (
                      <span style={{ position: "absolute", top: 2, bottom: 2, left: r.rs3m >= 0 ? "50%" : `${50 - (Math.abs(r.rs3m) / maxRs) * 50}%`, width: `${(Math.abs(r.rs3m) / maxRs) * 50}%`, background: r.rs3m >= 0 ? C.pos : C.neg }} />
                    )}
                  </span>
                  <span style={{ width: 48, textAlign: "right", fontFamily: mono, fontSize: 11, color: r.rs3m == null ? C.muted : r.rs3m >= 0 ? C.pos : C.neg }}>{r.rs3m == null ? "—" : `${r.rs3m >= 0 ? "+" : ""}${(r.rs3m * 100).toFixed(1)}`}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", fontFamily: mono, fontSize: 10.5, color: r.aboveSma200 == null ? C.muted : r.aboveSma200 ? C.pos : C.neg }}>
                  {r.aboveSma200 == null ? "—" : r.aboveSma200 ? "▲ ARRIBA" : "▼ ABAJO"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Fuerza relativa: retorno del sector a 3 meses menos el del S&P 500, en puntos. El régimen es una lectura simple (tendencia de SPY, VIX y amplitud), no una señal de compra.
        </div>
      </Panel>
    </div>
  );
}
