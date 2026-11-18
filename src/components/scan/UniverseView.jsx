import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C, panel, btn, th, td, input, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { Segmented, EmptyState } from "../ui.jsx";

// Vista "Mercado completo" del Scan: todas las empresas comunes de NYSE y
// Nasdaq (fila 'universe', cron 12:00 UTC). El gate es una etiqueta. Es
// contexto: /api/scan y la vista de calidad no cambian.

const GATE_VIEWS = [
  { key: "all", label: "Todas" },
  { key: "pass", label: "Pasan el gate" },
  { key: "waitlist", label: "Lista de espera" },
  { key: "fail", label: "No pasan" },
];
const SECTORS = [
  "Communication Services", "Consumer Discretionary", "Consumer Staples", "Energy", "Financials", "Health Care",
  "Industrials", "Information Technology", "Materials", "Real Estate", "Utilities",
];
const SORTS = [
  { key: "marketCap", label: "Capitalización" },
  { key: "preScore", label: "preScore" },
  { key: "roe", label: "ROE" },
  { key: "fcfYield", label: "FCF yield" },
  { key: "dollarVolume", label: "Volumen $" },
  { key: "trendScore", label: "Tendencia" },
];
const TREND_TONE = { "EN ZONA": C.pos, ALCISTA: C.pos, EXTENDIDA: C.amber, RETROCESO: C.amber, RECUPERANDO: C.accent, ROTA: C.neg };

// Score de tendencia. Fuera del universo de calidad lleva "≈": el v4 se validó
// en large caps del S&P 500 y su percentil se mide contra ese universo.
function TrendCell({ row }) {
  if (row.trendScore == null) return <span style={{ color: C.muted }}>—</span>;
  const outside = (row.trendFlags || []).includes("fuera_validado");
  return (
    <span title={outside ? "Fuera del universo validado: percentil contra el universo de calidad" : "Universo de calidad"}>
      <span style={{ color: TREND_TONE[row.trendLabel] ?? C.text }}>{row.trendLabel}</span>{" "}
      <span style={{ color: C.muted }}>{outside ? "≈" : ""}{row.trendScore}</span>
    </span>
  );
}
const PAGE = 50;

const fmtPct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtCap = (v) => (v == null ? "—" : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`);
// Motivo corto para la tabla; el completo va en el title.
const shortReason = (r) => (/^Sin fundamentales/.test(r || "") ? "sin datos XBRL (IFRS o sin 10-K)" : r);
const fmtPrice = (v) => (v == null ? "—" : `$${v.toFixed(2)}`);

function GateCell({ row }) {
  if (row.gatePass) return <span style={{ color: C.pos }}>PASA</span>;
  if (row.waitlist) return <span style={{ color: C.amber }} title={row.gateReasons.join(" · ")}>ESPERA · {row.waitlist}</span>;
  return <span style={{ color: C.muted }} title={row.gateReasons.join(" · ")}>{shortReason(row.gateReasons[0]) ?? "—"}</span>;
}

export default function UniverseView() {
  const [gate, setGate] = useState("all");
  const [exchange, setExchange] = useState("");
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState("marketCap");
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ gate, sort, limit: String(PAGE), offset: String(offset) });
    if (exchange) qs.set("exchange", exchange);
    if (sector) qs.set("sector", sector);
    if (text.trim()) qs.set("q", text.trim());
    if (all) qs.set("all", "1");
    try {
      const res = await fetch(`/api/screener?mode=universe&${qs}`);
      const json = await res.json().catch(() => {
        throw new Error("El universo solo está disponible en la web publicada (Vercel); en local este endpoint no corre.");
      });
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    }
    setLoading(false);
  }, [gate, exchange, sector, sort, text, all, offset]);

  useEffect(() => { load(); }, [load]);
  // Cambiar un filtro vuelve a la primera página.
  const reset = (fn) => (v) => { setOffset(0); fn(v); };

  const meta = data?.meta;
  const rows = data?.rows ?? [];

  return (
    <div>
      <div style={{ ...panel, marginBottom: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Segmented value={gate} onChange={reset(setGate)} options={GATE_VIEWS} />
          <select value={exchange} onChange={(e) => reset(setExchange)(e.target.value)} style={{ ...input, width: 110, textAlign: "left" }}>
            <option value="">NYSE + Nasdaq</option>
            <option value="NYSE">NYSE</option>
            <option value="Nasdaq">Nasdaq</option>
          </select>
          <select value={sector} onChange={(e) => reset(setSector)(e.target.value)} style={{ ...input, width: 190, textAlign: "left" }}>
            <option value="">Todos los sectores</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={(e) => reset(setSort)(e.target.value)} style={{ ...input, width: 130, textAlign: "left" }}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input value={text} onChange={(e) => reset(setText)(e.target.value)} placeholder="ticker o nombre" style={{ ...input, width: 140, textAlign: "left" }} />
          <label style={{ fontSize: 11.5, color: C.muted, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={all} onChange={(e) => reset(setAll)(e.target.checked)} />
            incluir bajo el piso ($3 y $300M)
          </label>
        </div>
        {meta && (
          <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted }}>
            {meta.total} empresas · {meta.investable} sobre el piso · {meta.gatePass} pasan el gate · {meta.waitlist} en espera ·
            {" "}{meta.withFundamentals} con fundamentales XBRL · actualizado {meta.updatedAt?.slice(0, 16).replace("T", " ")} UTC
          </div>
        )}
      </div>

      {error && <div style={{ ...panel, borderColor: C.neg, color: C.neg, fontSize: 12, marginBottom: 16 }}>{error}</div>}

      <Panel title="MERCADO COMPLETO · NYSE Y NASDAQ" right={data ? `${data.total} resultados` : loading ? "cargando…" : ""}>
        {rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Ticker", "Empresa", "Bolsa", "Sector", "Precio", "Cap.", "preScore", "ROE", "FCF yield", "Tendencia", "Gate"].map((h) => (
                    <th key={h} style={{ ...th, textAlign: ["Empresa", "Gate", "Sector", "Tendencia"].includes(h) ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, textAlign: "right" }}>
                      <Link to={`/chart?t=${r.symbol}`} style={{ color: C.accent, fontWeight: 700 }}>{r.symbol}</Link>
                    </td>
                    <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</td>
                    <td style={{ ...td, textAlign: "right", color: C.muted, whiteSpace: "nowrap" }}>
                      {r.exchange}
                      {r.foreign && <span title={`Fundamentales ${r.taxonomy} en ${r.currency}, cierre ${r.fyEnd}. Sin capitalización: en un ADR precio × acciones no sirve.`} style={{ marginLeft: 5, color: C.amber }}>{r.currency}</span>}
                    </td>
                    <td style={{ ...td, color: C.muted, whiteSpace: "nowrap" }}>{r.gicsSector ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right" }} title={r.priceStale ? "precio de la corrida anterior" : undefined}>
                      {fmtPrice(r.price)}{r.priceStale ? "*" : ""}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtCap(r.marketCap)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{r.preScore ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtPct(r.roe)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtPct(r.fcfYield)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><TrendCell row={r} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }} title={r.staleFundamentals ? "fundamentales del año anterior" : undefined}>
                      <GateCell row={r} />{r.staleFundamentals ? <span style={{ color: C.muted }}> · año ant.</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={loading ? "Cargando…" : "Sin resultados"}>
            {!loading && !error && "Probá con otros filtros o marcá incluir bajo el piso."}
          </EmptyState>
        )}
        {data && data.total > PAGE && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", marginTop: 10, fontSize: 11.5, color: C.muted }}>
            <button className="dione-hover" style={btn} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Anterior</button>
            <span>{offset + 1}–{Math.min(offset + PAGE, data.total)} de {data.total}</span>
            <button className="dione-hover" style={btn} disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Siguiente</button>
          </div>
        )}
      </Panel>

      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Contexto, no candidatas: el descubrimiento del método sigue en la vista de calidad (máx. 3 por sector).
        Lista de espera = falla una sola regla del gate y por poco. Extranjeras (moneda en ámbar): fundamentales de
        companyfacts en su moneda, sin capitalización ni FCF yield porque en un ADR precio × acciones no sirve.
        Tendencia con ≈ = fuera del universo de calidad: el percentil se mide contra ese universo y no cambia sus
        scores. La tendencia describe el estado del precio, no predice: en S&P 500, 400 y 600 su rank IC fue cero
        (project-docs/SMALLMID_2026-11.md). * = precio de la corrida anterior.
      </div>
    </div>
  );
}
