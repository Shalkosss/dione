/* Chart.jsx — Página de análisis técnico individual.
   Trae OHLCV de /api/candles/<ticker> y calcula indicadores client-side:
   SMA 50/200, RSI 14, Bollinger (20, 2), OBV, y eventos Wyckoff.

   El endpoint /api/candles ya existe — passthrough simple al chart API de
   Yahoo. Recibe period1/period2 (epoch seconds) e interval. En dev,
   vite.config.js proxea; en prod, lo levanta la serverless function.
*/

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ComposedChart, LineChart, BarChart, Line, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot, Legend,
} from "recharts";
import { C, mono, panel, btn, input } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { sma, rsi, bollinger, obv } from "../lib/indicators.js";
import { detectWyckoffEvents, WYCKOFF_COLORS } from "../lib/wyckoff.js";

const STORAGE_KEY = "dione:chart:lastTicker";

const RANGES = [
  { id: "1mo", label: "1M", days: 30 },
  { id: "3mo", label: "3M", days: 90 },
  { id: "6mo", label: "6M", days: 180 },
  { id: "1y",  label: "1Y", days: 365 },
  { id: "2y",  label: "2Y", days: 730 },
  { id: "5y",  label: "5Y", days: 1825 },
  { id: "max", label: "MAX", days: null },
];

// ---- helpers ----

const fmtPrice = (v) =>
  v == null ? "—" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v) =>
  v == null ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";

const fmtVol = (v) => {
  if (v == null) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
};

// Lee la respuesta cruda de Yahoo y arma candles ordenados.
function parseYahooCandles(raw) {
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const adj = r.indicators?.adjclose?.[0]?.adjclose || [];
  return ts
    .map((t, i) => ({
      t: t * 1000,
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? null,
      high: q.high?.[i] ?? null,
      low: q.low?.[i] ?? null,
      close: q.close?.[i] ?? null,
      adjClose: adj[i] ?? q.close?.[i] ?? null,
      volume: q.volume?.[i] ?? null,
    }))
    .filter((c) => c.close != null && c.high != null && c.low != null);
}

async function fetchCandles(ticker, days) {
  const to = Math.floor(Date.now() / 1000);
  const from = days == null ? 0 : to - days * 86400;
  const url = `/api/candles/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data?.chart?.error) throw new Error(data.chart.error.description || "Yahoo error");
    return parseYahooCandles(data);
  } finally {
    clearTimeout(timer);
  }
}

// ---- estilos tooltip de recharts ----
const tooltipStyle = {
  background: C.panel2,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  fontSize: 11,
  color: C.text,
};
const tooltipLabelStyle = { color: C.muted, fontSize: 10 };

// ---- componente ----

export default function Chart() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [range, setRange] = useState("1y");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [showWyckoff, setShowWyckoff] = useState(true);
  const [showBoll, setShowBoll] = useState(false);
  const [showOBV, setShowOBV] = useState(false);

  // Carga ticker inicial desde localStorage.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved || "AAPL";
    setTickerInput(initial);
    setTicker(initial);
  }, []);

  // Cada vez que cambia ticker o range, refetch.
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const days = RANGES.find((r) => r.id === range)?.days ?? 365;
    fetchCandles(ticker, days)
      .then((cs) => {
        if (cancelled) return;
        if (cs.length === 0) setErr(`Sin datos para ${ticker}`);
        setCandles(cs);
        localStorage.setItem(STORAGE_KEY, ticker);
      })
      .catch((e) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, range]);

  const submit = (e) => {
    e.preventDefault();
    const t = tickerInput.trim().toUpperCase();
    if (t) setTicker(t);
  };

  // ---- cálculos derivados ----
  const enriched = useMemo(() => {
    if (candles.length === 0) return [];
    const closes = candles.map((c) => c.close);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    const rsi14 = rsi(closes, 14);
    const bb = bollinger(closes, 20, 2);
    const obvArr = obv(candles);
    return candles.map((c, i) => ({
      ...c,
      sma50: sma50[i],
      sma200: sma200[i],
      rsi14: rsi14[i],
      bbUpper: bb[i].upper,
      bbLower: bb[i].lower,
      bbMid: bb[i].mid,
      obv: obvArr[i],
    }));
  }, [candles]);

  const events = useMemo(
    () => (candles.length > 70 ? detectWyckoffEvents(candles) : []),
    [candles]
  );

  // Quote header derivado.
  const last = enriched[enriched.length - 1];
  const prev = enriched[enriched.length - 2];
  const dayChg = last && prev ? last.close - prev.close : null;
  const dayChgPct = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;
  const periodChg = enriched.length > 1
    ? ((last.close - enriched[0].close) / enriched[0].close) * 100
    : null;

  // niveles únicos de eventos para dibujar ReferenceLines del último Spring/SOS.
  const lastSpring = [...events].reverse().find((e) => e.type === "Spring");
  const lastSos = [...events].reverse().find((e) => e.type === "SOS");

  // Para que el eje X no esté abarrotado.
  const tickInterval = enriched.length > 0 ? Math.max(0, Math.floor(enriched.length / 8) - 1) : 0;

  return (
    <div>
      {/* SEARCH + RANGES */}
      <div style={{ ...panel, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="Ticker (AAPL, NVDA, ^GSPC...)"
            style={{ ...input, width: 220, textAlign: "left", fontSize: 13, padding: "6px 10px" }}
          />
          <button
            type="submit"
            className="dione-hover"
            style={{ ...btn, color: C.accent, borderColor: C.accent, cursor: "pointer" }}
          >
            Buscar
          </button>
        </form>

        <div style={{ width: 1, height: 22, background: C.border, margin: "0 4px" }} />

        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className="dione-hover"
            style={{
              ...btn,
              padding: "5px 11px",
              fontSize: 10,
              color: range === r.id ? C.bg : C.muted,
              background: range === r.id ? C.accent : "transparent",
              borderColor: range === r.id ? C.accent : C.border,
              cursor: "pointer",
            }}
          >
            {r.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Toggles */}
        <Toggle label="Wyckoff" active={showWyckoff} onClick={() => setShowWyckoff((v) => !v)} color={C.accent} />
        <Toggle label="Bollinger" active={showBoll} onClick={() => setShowBoll((v) => !v)} color={C.blue} />
        <Toggle label="OBV" active={showOBV} onClick={() => setShowOBV((v) => !v)} color={C.pos} />
      </div>

      {/* QUOTE HEADER */}
      {ticker && (
        <div style={{ ...panel, marginBottom: 14, display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, color: C.accent, fontWeight: 700, letterSpacing: "0.04em" }}>{ticker}</div>
          {last && (
            <>
              <div style={{ fontSize: 22, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                {fmtPrice(last.close)}
              </div>
              <div style={{ fontSize: 13, color: (dayChg ?? 0) >= 0 ? C.pos : C.neg }}>
                {(dayChg ?? 0) >= 0 ? "▲" : "▼"} {fmtPrice(Math.abs(dayChg ?? 0))} ({fmtPct(dayChgPct)})
                <span style={{ color: C.muted, marginLeft: 8, fontSize: 10 }}>1d</span>
              </div>
              {periodChg != null && (
                <div style={{ fontSize: 11, color: periodChg >= 0 ? C.pos : C.neg }}>
                  Periodo: {fmtPct(periodChg)}
                </div>
              )}
              <div style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>
                {enriched.length} barras · al {last.date}
              </div>
            </>
          )}
          {loading && <span style={{ fontSize: 11, color: C.muted }}>Cargando…</span>}
          {err && <span style={{ fontSize: 11, color: C.neg }}>{err}</span>}
        </div>
      )}

      {/* PRICE CHART */}
      {enriched.length > 0 && (
        <Panel
          title={`PRECIO · SMA 50/200${showBoll ? " · BOLLINGER 20,2" : ""}`}
          right={
            showWyckoff && events.length > 0 ? (
              <span style={{ fontSize: 10, color: C.muted }}>
                {events.length} eventos Wyckoff detectados
              </span>
            ) : null
          }
        >
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={enriched} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="date"
                stroke={C.muted}
                fontSize={10}
                interval={tickInterval}
                tick={{ fill: C.muted }}
              />
              <YAxis
                stroke={C.muted}
                fontSize={10}
                domain={["auto", "auto"]}
                tick={{ fill: C.muted }}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(v, n) => [typeof v === "number" ? v.toFixed(2) : v, n]}
              />

              {/* Bollinger bands (debajo del precio para que no tapen) */}
              {showBoll && (
                <>
                  <Line type="monotone" dataKey="bbUpper" stroke={C.blue} strokeWidth={1} strokeDasharray="3 3" dot={false} name="BB upper" isAnimationActive={false} />
                  <Line type="monotone" dataKey="bbLower" stroke={C.blue} strokeWidth={1} strokeDasharray="3 3" dot={false} name="BB lower" isAnimationActive={false} />
                  <Line type="monotone" dataKey="bbMid" stroke={C.blue} strokeWidth={0.6} strokeOpacity={0.5} dot={false} name="BB mid" isAnimationActive={false} />
                </>
              )}

              <Line type="monotone" dataKey="close" stroke={C.accent} strokeWidth={1.6} dot={false} name="Close" isAnimationActive={false} />
              <Line type="monotone" dataKey="sma50" stroke={C.blue} strokeWidth={1} dot={false} name="SMA 50" isAnimationActive={false} />
              <Line type="monotone" dataKey="sma200" stroke="#a78bfa" strokeWidth={1} dot={false} name="SMA 200" isAnimationActive={false} />

              {/* Niveles de soporte/breakout de últimos eventos clave */}
              {showWyckoff && lastSpring && (
                <ReferenceLine
                  y={lastSpring.level}
                  stroke={WYCKOFF_COLORS.Spring}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: `Spring lvl ${lastSpring.level.toFixed(2)}`, position: "insideTopLeft", fill: WYCKOFF_COLORS.Spring, fontSize: 9 }}
                />
              )}
              {showWyckoff && lastSos && (
                <ReferenceLine
                  y={lastSos.level}
                  stroke={WYCKOFF_COLORS.SOS}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: `SOS breakout ${lastSos.level.toFixed(2)}`, position: "insideBottomLeft", fill: WYCKOFF_COLORS.SOS, fontSize: 9 }}
                />
              )}

              {/* Wyckoff event markers */}
              {showWyckoff && events.map((ev, i) => (
                <ReferenceDot
                  key={`${ev.type}-${i}`}
                  x={ev.date}
                  y={ev.price}
                  r={4}
                  fill={WYCKOFF_COLORS[ev.type] || C.accent}
                  stroke={C.bg}
                  strokeWidth={1}
                  label={{
                    value: ev.type,
                    position: ev.type === "SC" || ev.type === "ST" || ev.type === "Spring" || ev.type === "LPS" ? "bottom" : "top",
                    fill: WYCKOFF_COLORS[ev.type] || C.text,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                  ifOverflow="extendDomain"
                />
              ))}

              <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} iconSize={8} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* RSI */}
      {enriched.length > 14 && (
        <Panel title="RSI 14" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={enriched} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
              <YAxis stroke={C.muted} fontSize={10} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: C.muted }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
              <ReferenceLine y={70} stroke={C.neg} strokeDasharray="3 3" strokeOpacity={0.6} />
              <ReferenceLine y={30} stroke={C.pos} strokeDasharray="3 3" strokeOpacity={0.6} />
              <Line type="monotone" dataKey="rsi14" stroke={C.accent} strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* VOLUME */}
      {enriched.length > 0 && (
        <Panel title="VOLUMEN" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={enriched} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
              <YAxis stroke={C.muted} fontSize={10} tickFormatter={fmtVol} tick={{ fill: C.muted }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(v) => fmtVol(v)} />
              <Bar dataKey="volume" fill={C.border} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* OBV */}
      {showOBV && enriched.length > 1 && (
        <Panel title="OBV — ON-BALANCE VOLUME" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={enriched} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
              <YAxis stroke={C.muted} fontSize={10} tickFormatter={fmtVol} tick={{ fill: C.muted }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} formatter={(v) => fmtVol(v)} />
              <Line type="monotone" dataKey="obv" stroke={C.pos} strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* Tabla de eventos Wyckoff detectados */}
      {showWyckoff && events.length > 0 && (
        <Panel
          title={`EVENTOS WYCKOFF — ${events.length}`}
          style={{ marginTop: 12 }}
          right={<span style={{ fontSize: 10, color: C.muted }}>SC · AR · ST · Spring · SOS · LPS</span>}
        >
          <div style={{ overflowX: "auto", margin: -16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={cellHead}>Tipo</th>
                  <th style={cellHead}>Fecha</th>
                  <th style={{ ...cellHead, textAlign: "right" }}>Precio</th>
                  <th style={{ ...cellHead, textAlign: "right" }}>Nivel</th>
                  <th style={{ ...cellHead, textAlign: "left" }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.slice().reverse().map((ev, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...cell, paddingLeft: 16, color: WYCKOFF_COLORS[ev.type], fontWeight: 700 }}>{ev.type}</td>
                    <td style={{ ...cell, color: C.muted, fontSize: 10 }}>{ev.date}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtPrice(ev.price)}</td>
                    <td style={{ ...cell, textAlign: "right", color: C.muted }}>{ev.level ? fmtPrice(ev.level) : "—"}</td>
                    <td style={{ ...cell, textAlign: "left", color: C.muted, fontSize: 10 }}>{ev.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Estado vacío */}
      {!ticker && (
        <div style={{ ...panel, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 12, color: C.muted }}>◎</div>
          <div style={{ fontSize: 13, color: C.text }}>Buscá un ticker para arrancar.</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            Datos vía Yahoo Finance · indicadores client-side · Wyckoff detectado sobre 70+ barras.
          </div>
        </div>
      )}

      {/* Leyenda Wyckoff */}
      {showWyckoff && enriched.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
          <b style={{ color: C.text }}>SC</b> Selling Climax · range &gt; 2.5×ATR(14) y volumen &gt; 2.5× promedio en bottom de downtrend.{" "}
          <b style={{ color: C.text }}>AR</b> Automatic Rally · rebote ≥10% en 5–15 días post-SC.{" "}
          <b style={{ color: C.text }}>ST</b> Secondary Test · retest del SC ±5% con vol &lt; 70% del SC.{" "}
          <b style={{ color: C.text }}>Spring</b> close bajo min(60d) con vol bajo y recovery en 1–5 días.{" "}
          <b style={{ color: C.text }}>SOS</b> Sign of Strength · breakout con vol &gt; 1.5× promedio y close cerca del high.{" "}
          <b style={{ color: C.text }}>LPS</b> Last Point of Support · pullback post-SOS con vol bajo.
        </div>
      )}
    </div>
  );
}

// ---- subcomponentes ----

function Toggle({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="dione-hover"
      style={{
        ...btn,
        padding: "5px 11px",
        fontSize: 10,
        color: active ? C.bg : color,
        background: active ? color : "transparent",
        borderColor: color,
        cursor: "pointer",
      }}
    >
      {active ? "● " : "○ "}{label}
    </button>
  );
}

const cellHead = {
  color: C.muted,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "8px",
  textAlign: "left",
};
const cell = {
  fontSize: 12,
  padding: "6px 8px",
  fontVariantNumeric: "tabular-nums",
};
