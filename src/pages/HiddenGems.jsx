import React, { useState, useEffect, useMemo, useCallback } from "react";
import { C, panel, btn, th, td, input } from "../theme.js";
import { Panel } from "../components/Panel.jsx";

// ---- helpers de formato ----

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v * 100).toFixed(1) + "%";
}
function fmtNum(v, dec = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(dec);
}
function fmtCap(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + Math.round(v).toLocaleString("en-US");
}
function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ageLabel(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.floor(m / 60)}h`;
  return `hace ${Math.floor(m / 1440)}d`;
}

// ---- sub-componentes ----

function ScoreBadge({ score }) {
  if (score == null) return <span style={{ color: C.muted }}>—</span>;
  const color = score >= 70 ? C.pos : score >= 50 ? C.accent : C.neg;
  return (
    <span style={{ color, fontWeight: score >= 70 ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
      {score}
    </span>
  );
}

function SortHeader({ label, field, sortBy, onSort, style }) {
  const active = sortBy.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ ...th, cursor: "pointer", userSelect: "none", ...style, color: active ? C.accent : C.muted }}
    >
      {label}
      {active && <span style={{ marginLeft: 3 }}>{sortBy.dir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

// rangos de cap predefinidos (USD) — coinciden con el universo Tier-3 del backend
const CAP_PRESETS = [
  { id: "tier3", label: "Tier 3 (300M–2B)", min: 300_000_000, max: 2_000_000_000 },
  { id: "micro", label: "Micro (<300M)", min: 0, max: 300_000_000 },
  { id: "all", label: "Todo (0–10B)", min: 0, max: 10_000_000_000 },
];

// ---- página principal ----

export default function HiddenGems() {
  const [data, setData] = useState(null); // { meta, results }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // filtros
  const [capPreset, setCapPreset] = useState("tier3");
  const [minScore, setMinScore] = useState(60);

  // orden — el campo apunta a las propiedades aplanadas más abajo
  const [sortBy, setSortBy] = useState({ field: "preScore", dir: "desc" });

  const fetchGems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const preset = CAP_PRESETS.find((p) => p.id === capPreset) || CAP_PRESETS[0];
    const qs = new URLSearchParams({
      capMin: String(preset.min),
      capMax: String(preset.max),
      minScore: String(minScore),
      limit: "100",
    });
    try {
      const res = await fetch(`/api/screener?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    }
    setLoading(false);
  }, [capPreset, minScore]);

  // cargar al montar y cuando cambian los filtros
  useEffect(() => {
    fetchGems();
  }, [fetchGems]);

  const handleSort = useCallback((field) => {
    setSortBy((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  }, []);

  // aplana metrics al nivel raíz para ordenar por cualquier columna
  const rows = useMemo(() => {
    if (!data?.results) return [];
    const flat = data.results.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      marketCap: r.marketCap,
      price: r.price,
      preScore: r.preScore,
      ...r.metrics,
    }));
    return flat.sort((a, b) => {
      const av = a[sortBy.field] ?? (sortBy.dir === "desc" ? -Infinity : Infinity);
      const bv = b[sortBy.field] ?? (sortBy.dir === "desc" ? -Infinity : Infinity);
      return sortBy.dir === "desc" ? bv - av : av - bv;
    });
  }, [data, sortBy]);

  const meta = data?.meta;

  return (
    <div>
      {/* CONTROLES */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            className="dione-hover"
            onClick={fetchGems}
            disabled={loading}
            style={{
              ...btn, fontWeight: 700, fontSize: 12,
              color: loading ? C.muted : C.accent,
              borderColor: loading ? C.border : C.accent,
              cursor: loading ? "not-allowed" : "pointer",
              padding: "7px 16px",
            }}
          >
            {loading ? "⏳ cargando…" : "↻ ACTUALIZAR"}
          </button>

          {/* Rango de cap */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: C.muted }}>CAP</span>
            <select
              value={capPreset}
              onChange={(e) => setCapPreset(e.target.value)}
              style={{ ...input, width: 160, textAlign: "left", cursor: "pointer" }}
            >
              {CAP_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Score mínimo */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: C.muted }}>SCORE MÍN</span>
            <input
              type="number" min={0} max={100} step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              style={{ ...input, width: 52 }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {meta && !loading && (
            <span style={{ fontSize: 10, color: C.muted }}>
              {ageLabel(meta.updatedAt)} · FY{meta.fiscalYear} · {meta.totalTracked} en universo
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, padding: "10px 16px", fontSize: 11, color: C.neg }}>
          Error: {error}
          {error.includes("snapshot") && (
            <div style={{ color: C.muted, marginTop: 4 }}>
              El cron todavía no generó datos. Esperá al refresh diario (9:00 UTC) o disparalo manualmente.
            </div>
          )}
        </div>
      )}

      {/* ESTADO VACÍO */}
      {!error && !loading && rows.length === 0 && (
        <div style={{ ...panel, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⬡</div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
            Ninguna empresa pasa los filtros actuales.
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Probá bajar el score mínimo o ampliar el rango de cap.
          </div>
        </div>
      )}

      {/* TABLA */}
      {rows.length > 0 && (
        <Panel
          title={`HIDDEN GEMS — ${rows.length} candidatas`}
          right={
            <span style={{ fontSize: 10, color: C.muted }}>
              Pre-score 0-100 · fundamentales SEC EDGAR · precio Stooq
            </span>
          }
        >
          <div style={{ overflowX: "auto", margin: -16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ ...th, textAlign: "right", paddingLeft: 16, width: 36 }}>#</th>
                  <th style={{ ...th, textAlign: "left", paddingLeft: 8 }}>Ticker</th>
                  <th style={{ ...th, textAlign: "left" }}>Nombre</th>
                  <SortHeader label="Score"   field="preScore"     sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <SortHeader label="Cap"      field="marketCap"    sortBy={sortBy} onSort={handleSort} style={{ width: 80 }} />
                  <SortHeader label="ROE"      field="roe"          sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <SortHeader label="ROIC"     field="roic"         sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <SortHeader label="P/E"      field="pe"           sortBy={sortBy} onSort={handleSort} style={{ width: 60 }} />
                  <SortHeader label="FCF yld"  field="fcfYield"     sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <SortHeader label="M. neto"  field="netMargin"    sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <SortHeader label="D/E"      field="debtToEquity" sortBy={sortBy} onSort={handleSort} style={{ width: 60 }} />
                  <th style={{ ...th, paddingRight: 16, width: 80 }}>Precio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.symbol} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, textAlign: "right", paddingLeft: 16, color: C.muted, fontSize: 11 }}>
                      {idx + 1}
                    </td>
                    <td style={{ ...td, textAlign: "left", paddingLeft: 8 }}>
                      <span style={{ color: C.accent, fontWeight: 700 }}>{r.symbol}</span>
                    </td>
                    <td style={{ ...td, textAlign: "left", fontSize: 11, color: C.muted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name || "—"}
                    </td>
                    <td style={{ ...td, fontSize: 15, fontWeight: 700 }}>
                      <ScoreBadge score={r.preScore} />
                    </td>
                    <td style={{ ...td, color: C.text }}>{fmtCap(r.marketCap)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtPct(r.roe)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtPct(r.roic)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtNum(r.pe, 1)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtPct(r.fcfYield)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtPct(r.netMargin)}</td>
                    <td style={{ ...td, color: C.text }}>{fmtNum(r.debtToEquity, 2)}</td>
                    <td style={{ ...td, paddingRight: 16, color: C.text }}>{fmtPrice(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* LEYENDA */}
      <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
        <b style={{ color: C.text }}>Quality gate:</b> ROE {">"} 10% · FCF positivo · D/E {"<"} 2.{" "}
        <b style={{ color: C.text }}>Pre-score:</b> calidad 50 · márgenes 25 · value 15 · solidez 10.{" "}
        Score ≥ 70 <span style={{ color: C.pos }}>●</span> · 50–69 <span style={{ color: C.accent }}>●</span> · {"<"}50 <span style={{ color: C.neg }}>●</span>.{" "}
        Esto es un <b style={{ color: C.text }}>screen barato</b> para armar shortlist — el análisis serio (Beneish, Piotroski, DCF) va en DIONE sobre el top 3-5.{" "}
        Datos refrescados 1x/día (9:00 UTC).
      </div>
    </div>
  );
}
