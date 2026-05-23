import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePortfolio } from "../store/PortfolioContext.jsx";
import { C, mono, panel, btn, th, td, input } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { UNIVERSE, SECTORS, CAPS } from "../lib/universe.js";
import {
  scanUniverse,
  loadScreenerCache,
  saveScreenerCache,
} from "../lib/screener.js";
// ---- helpers ----

function ageLabel(ts) {
  if (!ts) return null;
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)}h`;
}

function capLabel(cap) {
  return { large: "L", mid: "M", small: "S", micro: "μ", etf: "ETF" }[cap] ?? cap;
}

function fmtPrice(v) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      style={{ ...th, cursor: "pointer", userSelect: "none", ...style,
        color: active ? C.accent : C.muted }}
    >
      {label}
      {active && <span style={{ marginLeft: 3 }}>{sortBy.dir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );
}

// ---- página principal ----

export default function Screener() {
  const { assets, addAssetToPortfolio } = usePortfolio();
  const [results, setResults] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanTicker, setScanTicker] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [scanError, setScanError] = useState(null);

  // filtros
  const [filterSector, setFilterSector] = useState("all");
  const [filterCaps, setFilterCaps] = useState(new Set(["large", "mid", "small", "micro", "etf"]));
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [filterPortfolio, setFilterPortfolio] = useState(false);

  // orden
  const [sortBy, setSortBy] = useState({ field: "composite", dir: "desc" });

  const portfolioTickers = useMemo(() => new Set(assets.map((a) => a.ticker)), [assets]);

  // cargar caché al montar
  useEffect(() => {
    const { data, savedAt: ts } = loadScreenerCache();
    if (Object.keys(data).length > 0) {
      setResults(data);
      setSavedAt(ts);
    }
  }, []);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanError(null);
    setScanCount(0);
    const accumulated = {};

    try {
      await scanUniverse(UNIVERSE, (ticker, data, count) => {
        accumulated[ticker] = data;
        setResults((prev) => ({ ...prev, [ticker]: data }));
        setScanTicker(ticker);
        setScanCount(count);
      });
      const now = Date.now();
      setSavedAt(now);
      saveScreenerCache(accumulated);
    } catch (e) {
      setScanError(e.message);
    }

    setScanning(false);
    setScanTicker("");
  };

  const handleSort = useCallback((field) => {
    setSortBy((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  }, []);

  const toggleCap = (cap) => {
    setFilterCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) { if (next.size > 1) next.delete(cap); }
      else next.add(cap);
      return next;
    });
  };

  // filas filtradas y ordenadas
  const rows = useMemo(() => {
    return UNIVERSE
      .filter((u) => {
        if (filterSector !== "all" && u.sector !== filterSector) return false;
        if (!filterCaps.has(u.cap)) return false;
        const d = results[u.ticker];
        if (filterMinScore > 0 && (!d || d.composite == null || d.composite < filterMinScore)) return false;
        if (filterPortfolio && !portfolioTickers.has(u.ticker)) return false;
        return true;
      })
      .map((u) => ({ ...u, ...(results[u.ticker] || {}) }))
      .sort((a, b) => {
        const av = a[sortBy.field] ?? (sortBy.dir === "desc" ? -Infinity : Infinity);
        const bv = b[sortBy.field] ?? (sortBy.dir === "desc" ? -Infinity : Infinity);
        return sortBy.dir === "desc" ? bv - av : av - bv;
      });
  }, [results, filterSector, filterCaps, filterMinScore, filterPortfolio, portfolioTickers, sortBy]);

  const hasResults = Object.keys(results).length > 0;
  const progress = UNIVERSE.length > 0 ? scanCount / UNIVERSE.length : 0;
  const etaSeconds = scanning ? Math.round((UNIVERSE.length - scanCount) * 0.15) : 0;

  return (
    <div>
      {/* CONTROLES */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            className="dione-hover"
            onClick={handleScan}
            disabled={scanning}
            style={{
              ...btn, fontWeight: 700, fontSize: 12,
              color: scanning ? C.muted : C.accent,
              borderColor: scanning ? C.border : C.accent,
              cursor: scanning ? "not-allowed" : "pointer",
              padding: "7px 16px",
            }}
          >
            {scanning ? `⏳ ${scanTicker || "…"}` : "▶ SCAN UNIVERSO"}
          </button>

          {/* Filtro sector */}
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            style={{ ...input, width: 160, cursor: "pointer" }}
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s === "all" ? "Todos los sectores" : s}</option>
            ))}
          </select>

          {/* Filtro cap */}
          <div style={{ display: "flex", gap: 4 }}>
            {CAPS.map((cap) => (
              <div
                key={cap}
                className="dione-hover"
                onClick={() => toggleCap(cap)}
                style={{
                  padding: "4px 9px", fontSize: 10, borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${filterCaps.has(cap) ? C.blue : C.border}`,
                  color: filterCaps.has(cap) ? C.blue : C.muted,
                  background: filterCaps.has(cap) ? `${C.blue}18` : "transparent",
                  fontWeight: 600, letterSpacing: "0.04em",
                }}
              >
                {capLabel(cap)}
              </div>
            ))}
          </div>

          {/* Score mínimo */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: C.muted }}>SCORE MÍN</span>
            <input
              type="number" min={0} max={100} step={5}
              value={filterMinScore}
              onChange={(e) => setFilterMinScore(Number(e.target.value) || 0)}
              style={{ ...input, width: 52 }}
            />
          </div>

          {/* Solo portfolio */}
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted, cursor: "pointer" }}>
            <input
              type="checkbox" checked={filterPortfolio}
              onChange={(e) => setFilterPortfolio(e.target.checked)}
              style={{ accentColor: C.accent }}
            />
            Solo portfolio
          </label>

          <div style={{ flex: 1 }} />

          {savedAt && !scanning && (
            <span style={{ fontSize: 10, color: C.muted }}>
              {ageLabel(savedAt)} · {UNIVERSE.length} tickers
            </span>
          )}
        </div>

        {/* Barra de progreso */}
        {scanning && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginBottom: 4 }}>
              <span>Escaneando <b style={{ color: C.text }}>{scanTicker}</b>…</span>
              <span>{scanCount}/{UNIVERSE.length} · ~{etaSeconds}s restantes</span>
            </div>
            <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2 }}>
              <div style={{
                width: `${progress * 100}%`, height: "100%",
                background: C.accent, borderRadius: 2,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        )}
      </div>

      {scanError && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, padding: "10px 16px", fontSize: 11, color: C.neg }}>
          Error: {scanError}
        </div>
      )}

      {/* ESTADO VACÍO */}
      {!hasResults && !scanning && (
        <div style={{ ...panel, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⬡</div>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
            Sin datos. Presioná <b style={{ color: C.accent }}>▶ SCAN UNIVERSO</b> para escanear los {UNIVERSE.length} tickers.
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            El scan tarda ~{Math.round(UNIVERSE.length * 0.15 / 60)} min · caché de 24h · no se repite solo
          </div>
        </div>
      )}

      {/* TABLA */}
      {(hasResults || scanning) && (
        <Panel
          title={`RESULTADOS — ${rows.length} tickers`}
          right={
            <span style={{ fontSize: 10, color: C.muted }}>
              70% Técnico · 30% Momentum/Calidad · RSI Wilder · proxy: SPY
            </span>
          }
        >
          <div style={{ overflowX: "auto", margin: -16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ ...th, textAlign: "right", paddingLeft: 16, width: 36 }}>#</th>
                  <th style={{ ...th, textAlign: "left", paddingLeft: 8 }}>Ticker</th>
                  <th style={{ ...th, textAlign: "left" }}>Nombre</th>
                  <th style={{ ...th, textAlign: "left" }}>Sector</th>
                  <th style={{ ...th, width: 40 }}>Cap</th>
                  <SortHeader label="Composite" field="composite" sortBy={sortBy} onSort={handleSort} style={{ width: 90 }} />
                  <SortHeader label="Técnico"   field="tech"      sortBy={sortBy} onSort={handleSort} style={{ width: 80 }} />
                  <SortHeader label="Fund."     field="fund"      sortBy={sortBy} onSort={handleSort} style={{ width: 70 }} />
                  <th style={{ ...th, width: 90 }}>Precio</th>
                  <th style={{ ...th, paddingRight: 16, width: 95 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const inPortfolio = portfolioTickers.has(r.ticker);
                  const isCurrent = scanning && r.ticker === scanTicker;
                  return (
                    <tr
                      key={r.ticker}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        background: inPortfolio ? `${C.accent}0a` : isCurrent ? `${C.blue}0a` : "transparent",
                      }}
                    >
                      <td style={{ ...td, textAlign: "right", paddingLeft: 16, color: C.muted, fontSize: 11 }}>
                        {r.composite != null ? idx + 1 : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "left", paddingLeft: 8 }}>
                        <span style={{ color: C.accent, fontWeight: 700 }}>{r.ticker}</span>
                        {inPortfolio && (
                          <span style={{ fontSize: 8, color: C.accent, marginLeft: 4, opacity: 0.7 }}>●</span>
                        )}
                        {isCurrent && (
                          <span style={{ fontSize: 9, color: C.blue, marginLeft: 4 }}>…</span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "left", fontSize: 11, color: C.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </td>
                      <td style={{ ...td, textAlign: "left", fontSize: 10, color: C.muted }}>
                        {r.sector}
                      </td>
                      <td style={{ ...td, fontSize: 10, color: C.muted }}>
                        {capLabel(r.cap)}
                      </td>
                      <td style={{ ...td, fontSize: 15, fontWeight: 700 }}>
                        {isCurrent ? <span style={{ color: C.muted }}>…</span> : <ScoreBadge score={r.composite} />}
                      </td>
                      <td style={{ ...td }}>
                        {isCurrent ? <span style={{ color: C.muted }}>…</span> : <ScoreBadge score={r.tech} />}
                      </td>
                      <td style={{ ...td }}>
                        {isCurrent ? <span style={{ color: C.muted }}>…</span> : <ScoreBadge score={r.fund} />}
                      </td>
                      <td style={{ ...td, color: C.text }}>
                        {r.error ? (
                          <span style={{ fontSize: 10, color: C.neg }}>error</span>
                        ) : (
                          fmtPrice(r.price)
                        )}
                      </td>
                      <td style={{ ...td, paddingRight: 16 }}>
                        {inPortfolio ? (
                          <span style={{ fontSize: 9, color: C.accent }}>● en portfolio</span>
                        ) : (
                          <button
                            className="dione-hover"
                            onClick={() => addAssetToPortfolio(r.ticker, r.sector)}
                            style={{ ...btn, fontSize: 10, padding: "3px 8px", color: C.blue, borderColor: C.blue }}
                          >
                            → Optimizer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* LEYENDA */}
      <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
        <b style={{ color: C.text }}>Técnico (70%):</b> momentum 3m · RSI Wilder 14 · precio vs MA200 · MA50/MA200 cross.{" "}
        <b style={{ color: C.text }}>Fund. (30%):</b> Sharpe 12m · % desde 52w high · Sharpe 6m.{" "}
        Score ≥ 70 <span style={{ color: C.pos }}>●</span> · 50–69 <span style={{ color: C.accent }}>●</span> · {"<"}50 <span style={{ color: C.neg }}>●</span>.{" "}
        <span style={{ color: C.accent }}>●</span> = en tu portfolio actual.{" "}
        Caché de 24h — datos vía Yahoo Finance, sin key requerida.
      </div>
    </div>
  );
}
