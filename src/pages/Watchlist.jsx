import React, { useState, useEffect, useRef, useMemo } from "react";
import { usePortfolio } from "../store/PortfolioContext.jsx";
import { C, mono, panel, btn, th, td } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import {
  hasApiKey,
  refreshMarketData,
  loadMarketDataCache,
  saveMarketDataCache,
  MARKET_PROXY,
} from "../lib/marketData.js";
import { UNIVERSE } from "../lib/universe.js";

/* ---- helpers ---- */
function ageLabel(savedAt) {
  if (!savedAt) return null;
  const mins = Math.floor((Date.now() - savedAt) / 60_000);
  if (mins < 1) return "ahora";
  if (mins === 1) return "hace 1 min";
  if (mins < 60) return `hace ${mins} min`;
  return `hace ${Math.floor(mins / 60)}h`;
}

function changeColor(v) {
  if (v == null) return C.muted;
  return v > 0 ? C.pos : v < 0 ? C.neg : C.muted;
}

function fmtPrice(v) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChg(v) {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";
}

function fmtVol(v) {
  if (v == null) return "—";
  return Number(v).toFixed(1) + "%";
}

function fmtBeta(v) {
  if (v == null) return "—";
  return Number(v).toFixed(2);
}

/* ---- componente principal ---- */
export default function Watchlist() {
  const { assets, applyHistoricalData } = usePortfolio();
  const [mktData, setMktData] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingTickers, setPendingTickers] = useState(new Set());
  const [fetchError, setFetchError] = useState(null);
  const [injected, setInjected] = useState(new Set());
  const abortRef = useRef(false);

  // Carga caché al montar
  useEffect(() => {
    const { data, savedAt: ts } = loadMarketDataCache();
    if (Object.keys(data).length > 0) {
      setMktData(data);
      setSavedAt(ts);
    }
  }, []);

  const tickers = assets.map((a) => a.ticker);

  const handleRefresh = async () => {
    if (!hasApiKey()) return;
    setLoading(true);
    setFetchError(null);
    setInjected(new Set());
    abortRef.current = false;
    setPendingTickers(new Set(tickers));

    const accumulated = {};
    try {
      await refreshMarketData(tickers, (ticker, data) => {
        if (abortRef.current) return;
        accumulated[ticker] = data;
        setMktData((prev) => ({ ...prev, [ticker]: data }));
        setPendingTickers((prev) => {
          const next = new Set(prev);
          next.delete(ticker);
          return next;
        });
      });
      const now = Date.now();
      setSavedAt(now);
      saveMarketDataCache(accumulated);
    } catch (e) {
      setFetchError(e.message);
    }
    setLoading(false);
    setPendingTickers(new Set());
  };

  // Mapa ticker → sector del universo curado (para inyectar sector cuando coincide)
  const universeSector = useMemo(() => {
    const m = {};
    UNIVERSE.forEach((u) => { m[u.ticker.toUpperCase()] = u.sector; });
    return m;
  }, []);

  const inject = (ticker) => {
    const d = mktData[ticker];
    if (!d || d.nonTradeable) return;
    const sector = universeSector[ticker.toUpperCase()]; // undefined si no está en el universo
    applyHistoricalData(ticker, d.vol90, d.beta90, sector);
    setInjected((prev) => new Set([...prev, ticker]));
  };

  const injectAll = () => {
    tickers.forEach((t) => inject(t));
  };

  const anyInjectable = tickers.some((t) => {
    const d = mktData[t];
    return d && !d.nonTradeable && !d.error && (d.vol90 != null || d.beta90 != null);
  });

  const noKey = !hasApiKey();

  return (
    <div>
      {/* BANNER — API key faltante */}
      {noKey && (
        <div style={{ ...panel, borderColor: C.accent, marginBottom: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginBottom: 8 }}>
            ⚠ VITE_FINNHUB_KEY no configurada
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            1. Registrate gratis en{" "}
            <span style={{ color: C.blue }}>finnhub.io/register</span>
            {" "}→ copiá tu API key.<br />
            2. Creá el archivo{" "}
            <code style={{ color: C.text, background: C.panel2, padding: "1px 4px", borderRadius: 3 }}>.env.local</code>
            {" "}en la raíz del proyecto:<br />
            <code style={{ color: C.pos, display: "block", marginTop: 4, padding: "6px 10px", background: C.panel2, borderRadius: 4 }}>
              VITE_FINNHUB_KEY=tu_key_aqui
            </code>
            3. Reiniciá el servidor ({" "}
            <code style={{ color: C.text }}>npm run dev</code>
            {" "}) para que tome la variable.
          </div>
        </div>
      )}

      {/* CONTROLES */}
      <div style={{ ...panel, display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className="dione-hover"
          onClick={handleRefresh}
          disabled={loading || noKey}
          style={{
            ...btn,
            color: loading ? C.muted : C.accent,
            borderColor: loading ? C.border : C.accent,
            cursor: loading || noKey ? "not-allowed" : "pointer",
            opacity: noKey ? 0.45 : 1,
          }}
        >
          {loading ? "Actualizando…" : "↻ Actualizar precios"}
        </button>

        <button
          className="dione-hover"
          onClick={injectAll}
          disabled={!anyInjectable || loading}
          style={{
            ...btn,
            color: anyInjectable && !loading ? C.blue : C.muted,
            cursor: anyInjectable && !loading ? "pointer" : "not-allowed",
          }}
        >
          ⇒ Inyectar todo al Optimizer
        </button>

        <div style={{ flex: 1 }} />

        {savedAt && (
          <span style={{ fontSize: 10, color: C.muted }}>
            Datos: {ageLabel(savedAt)}
            {" · "}proxy β = {MARKET_PROXY}
          </span>
        )}
      </div>

      {fetchError && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, fontSize: 11, color: C.neg, padding: "10px 16px" }}>
          Error: {fetchError}
        </div>
      )}

      {/* TABLA */}
      <Panel
        title="WATCHLIST — PORTAFOLIO ACTUAL"
        right={
          <span style={{ fontSize: 10, color: C.muted }}>
            Vol y β calculadas sobre ~90 días hábiles vs {MARKET_PROXY}
          </span>
        }
      >
        <div style={{ overflowX: "auto", margin: -16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Ticker</th>
                <th style={{ ...th, textAlign: "left" }}>Sector</th>
                <th style={th}>Precio</th>
                <th style={th}>Δ 1d</th>
                <th style={th}>Vol 90d %</th>
                <th style={th}>Beta 90d</th>
                <th style={{ ...th, width: 100 }}>Optimizer</th>
                <th style={{ ...th, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const d = mktData[a.ticker];
                const isPending = pendingTickers.has(a.ticker);
                const isNonTradeable = d?.nonTradeable;
                const hasData = d && !isNonTradeable && !d.error;
                const isInjected = injected.has(a.ticker);
                const canInject = hasData && (d.vol90 != null || d.beta90 != null);

                return (
                  <tr key={a.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                    {/* Ticker */}
                    <td style={{ ...td, textAlign: "left", paddingLeft: 16, color: C.accent, fontWeight: 600 }}>
                      {a.ticker}
                    </td>
                    {/* Sector */}
                    <td style={{ ...td, textAlign: "left", color: C.muted, fontSize: 11 }}>
                      {a.sector}
                    </td>
                    {/* Precio */}
                    <td style={{ ...td, color: C.text }}>
                      {isPending ? <Spinner /> : isNonTradeable ? "—" : d?.error ? <ErrBadge /> : fmtPrice(d?.price)}
                    </td>
                    {/* Δ 1d */}
                    <td style={{ ...td, color: isPending || !hasData ? C.muted : changeColor(d?.changePct) }}>
                      {isPending ? "…" : isNonTradeable ? "—" : d?.error ? "—" : fmtChg(d?.changePct)}
                    </td>
                    {/* Vol 90d */}
                    <td style={{ ...td }}>
                      {isPending ? <Spinner /> : isNonTradeable ? "—" : d?.error ? "—" : (
                        <span>
                          <span style={{ color: C.text }}>{fmtVol(d?.vol90)}</span>
                          {d?.vol90 != null && (
                            <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>
                              manual: {Number(a.vol).toFixed(1)}%
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    {/* Beta 90d */}
                    <td style={{ ...td }}>
                      {isPending ? <Spinner /> : isNonTradeable ? "—" : d?.error ? "—" : (
                        <span>
                          <span style={{ color: C.text }}>{fmtBeta(d?.beta90)}</span>
                          {d?.beta90 != null && (
                            <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>
                              manual: {Number(a.beta).toFixed(2)}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    {/* Estado en Optimizer */}
                    <td style={{ ...td, fontSize: 10 }}>
                      {isInjected ? (
                        <span style={{ color: C.pos }}>✓ inyectado</span>
                      ) : canInject ? (
                        <span style={{ color: C.muted }}>pendiente</span>
                      ) : (
                        <span style={{ color: C.border }}>—</span>
                      )}
                    </td>
                    {/* Botón inyectar */}
                    <td style={{ ...td, paddingRight: 16 }}>
                      {canInject && !isInjected && (
                        <button
                          className="dione-hover"
                          onClick={() => inject(a.ticker)}
                          style={{
                            ...btn,
                            fontSize: 10,
                            padding: "3px 9px",
                            color: C.blue,
                            borderColor: C.blue,
                          }}
                        >
                          ⇒ Inyectar
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

      {/* EXPLICACION */}
      <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
        <b style={{ color: C.text }}>Vol 90d</b> = volatilidad anualizada calculada de retornos log-diarios (~90 días hábiles).{" "}
        <b style={{ color: C.text }}>Beta 90d</b> = regresión OLS de retornos del activo vs {MARKET_PROXY}.{" "}
        <b style={{ color: C.text }}>Inyectar</b> reemplaza los supuestos manuales en el Optimizer con estos valores históricos.
        Los retornos esperados (E[R]) <i>no</i> se modifican — esos son tus views, no el pasado.
      </div>
    </div>
  );
}

function Spinner() {
  return <span style={{ color: C.muted, fontSize: 11 }}>…</span>;
}

function ErrBadge() {
  return <span style={{ color: C.neg, fontSize: 10 }}>error</span>;
}
