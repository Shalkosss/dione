/* Chart.jsx — Análisis técnico de un ticker.
   Velas de /api/candles (Yahoo, sin key). Los indicadores se calculan sobre
   la historia completa con calentamiento y se muestra el rango elegido:
   SMA 50/200, Bollinger, RSI, OBV, volumen relativo, eventos Wyckoff,
   soportes y resistencias, directrices y perfil de volumen. Si el ticker está
   en la cartera activa, dibuja la compra, el stop y el take profit.
*/

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Link, useSearchParams } from "react-router-dom";
import { C, mono, panel, btn, input } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { Segmented } from "../components/ui.jsx";
import PriceChart from "../components/chart/PriceChart.jsx";
import VolumePanel, { fmtVol } from "../components/chart/VolumePanel.jsx";
import { WyckoffTable, LevelsTable } from "../components/chart/ChartTables.jsx";
import { detectWyckoffEvents, wyckoffPhase, WYCKOFF_COLORS } from "../lib/wyckoff.js";
import { supportResistance, trendlines, volumeProfile } from "../lib/levels.js";
import { enrichCandles, visibleStart, splitHeld, withTrendlines, WARMUP_DAYS } from "../lib/chartData.js";
import { positionPlan, levelsFromThesis, effectiveLevels } from "../lib/positionStats.js";
import { useLiveTheses } from "../lib/useLiveTheses.js";
import { useLedger, ACCOUNTS } from "../store/LedgerContext.jsx";

const STORAGE_KEY = "dione:chart:lastTicker";
const PREFS_KEY = "dione:chart:prefs";
const RANGES = [
  { id: "1mo", label: "1M", days: 30 }, { id: "3mo", label: "3M", days: 90 }, { id: "6mo", label: "6M", days: 180 },
  { id: "1y", label: "1A", days: 365 }, { id: "2y", label: "2A", days: 730 }, { id: "5y", label: "5A", days: 1825 },
  { id: "max", label: "MAX", days: null },
];
const DEFAULT_SHOW = { wyckoff: true, levels: true, trend: true, profile: false, boll: false, obv: false, position: true };
const TOGGLES = [["wyckoff", "Wyckoff", "accent"], ["levels", "Soportes/Resist.", "pos"], ["trend", "Directrices", "neg"], ["profile", "Perfil vol.", "amber"], ["boll", "Bollinger", "blue"], ["obv", "OBV", "pos"], ["position", "Mi posición", "accent"]];

const fmtPrice = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtPct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`);

function loadPrefs() {
  try { return { mode: "line", vol: "rvol20", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return { mode: "line", vol: "rvol20" }; }
}

function parseYahooCandles(raw) {
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const q = r.indicators?.quote?.[0] || {};
  return (r.timestamp || [])
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), open: q.open?.[i] ?? null, high: q.high?.[i] ?? null, low: q.low?.[i] ?? null, close: q.close?.[i] ?? null, volume: q.volume?.[i] ?? null }))
    .filter((c) => c.close != null && c.high != null && c.low != null);
}

async function fetchCandles(ticker, days) {
  const to = Math.floor(Date.now() / 1000);
  const from = days == null ? 0 : to - (days + WARMUP_DAYS) * 86400;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`/api/candles/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data?.chart?.error) throw new Error(data.chart.error.description || "Yahoo error");
    return parseYahooCandles(data);
  } finally {
    clearTimeout(timer);
  }
}

function Toggle({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{ ...btn, padding: "5px 10px", fontSize: 10, color: active ? C.bg : color, background: active ? color : "transparent", borderColor: color }}>
      {active ? "● " : "○ "}{label}
    </button>
  );
}

function PositionStrip({ plan, levels, price, accountLabel }) {
  const ret = price / plan.avgCost - 1;
  const item = (k, v, color = C.text) => <span><span style={{ color: C.muted }}>{k} </span><b style={{ color }}>{v}</b></span>;
  return (
    <div style={{ ...panel, marginBottom: 12, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", fontFamily: mono, fontSize: 11.5, borderColor: C.accent }}>
      <span style={{ color: C.accent, letterSpacing: "0.1em", fontSize: 10 }}>EN CARTERA · {accountLabel.toUpperCase()}</span>
      {item("cantidad", +plan.qty.toFixed(3))}
      {item("costo prom.", fmtPrice(plan.avgCost))}
      {item("desde", plan.startDate)}
      {item("resultado", fmtPct(ret), ret >= 0 ? C.pos : C.neg)}
      {!levels.stop ? item("stop", "sin definir", C.amber)
        : price <= levels.stop ? item("stop", `perforado (${fmtPrice(levels.stop)})`, C.neg)
          : item("al stop", `${fmtPct(levels.stop / price - 1)} (${fmtPrice(levels.stop)})`, C.neg)}
      {levels.target ? item("al take profit", `${fmtPct(levels.target / price - 1)} (${fmtPrice(levels.target)})`, C.pos) : item("take profit", "sin definir", C.amber)}
      {levels.source === "tesis" && <span style={{ color: C.muted }}>niveles de la tesis</span>}
      <Link to="/#seguimiento" style={{ marginLeft: "auto", color: C.accent, fontSize: 10.5 }}>editar en Portafolio →</Link>
    </div>
  );
}

export default function Chart() {
  const [tickerInput, setTickerInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [range, setRange] = useState("1y");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [show, setShow] = useState(DEFAULT_SHOW);
  const [prefs, setPrefs] = useState(loadPrefs);
  const { account, activeId } = useLedger();
  const theses = useLiveTheses();

  const [searchParams] = useSearchParams();
  const urlTicker = (searchParams.get("t") || "").toUpperCase().trim();
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
    const initial = urlTicker || saved || "AAPL";
    setTickerInput(initial);
    setTicker(initial);
  }, [urlTicker]);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento */ }
  }, [prefs]);

  const days = RANGES.find((r) => r.id === range)?.days ?? 365;
  useEffect(() => {
    if (!ticker) return undefined;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchCandles(ticker, days)
      .then((cs) => {
        if (cancelled) return;
        if (cs.length === 0) setErr(`Sin datos para ${ticker}`);
        setCandles(cs);
        try { localStorage.setItem(STORAGE_KEY, ticker); } catch { /* sin almacenamiento */ }
      })
      .catch((e) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, days]);

  const rvolPeriod = prefs.vol === "rvol10" ? 10 : 20;
  const full = useMemo(() => enrichCandles(candles, { rvolPeriod }), [candles, rvolPeriod]);
  const start = useMemo(() => visibleStart(full, days), [full, days]);
  const wy = useMemo(() => detectWyckoffEvents(candles), [candles]);
  const phase = useMemo(() => wyckoffPhase(wy.events, candles), [wy, candles]);
  const lines = useMemo(() => trendlines(candles), [candles]);
  const sr = useMemo(() => supportResistance(candles), [candles]);

  const plan = useMemo(() => (ticker ? positionPlan(account.transactions, ticker) : null), [account.transactions, ticker]);
  const levels = useMemo(() => effectiveLevels(plan, levelsFromThesis(theses, ticker)), [plan, theses, ticker]);
  const position = plan ? { plan, levels } : null;

  const rows = useMemo(() => {
    const visible = full.slice(start);
    return splitHeld(withTrendlines(visible, lines), plan?.startDate);
  }, [full, start, lines, plan]);
  const profile = useMemo(() => volumeProfile(rows), [rows]);
  const events = useMemo(() => wy.events.filter((e) => e.idx >= start), [wy, start]);
  const wyRange = useMemo(() => {
    const r = wy.ranges[wy.ranges.length - 1];
    if (!r || !candles.length) return null;
    const sos = wy.events.find((e) => e.type === "SOS" && e.idx > r.arIdx);
    const end = sos ? sos.idx : candles.length - 1;
    return { from: candles[r.scIdx].date, to: candles[end].date, top: r.top, bottom: r.bottom };
  }, [wy, candles]);

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const dayChg = last && prev ? last.close / prev.close - 1 : null;
  const periodChg = rows.length > 1 ? last.close / rows[0].close - 1 : null;
  const tickInterval = rows.length > 0 ? Math.max(0, Math.floor(rows.length / 8) - 1) : 0;

  const submit = (e) => {
    e.preventDefault();
    const t = tickerInput.trim().toUpperCase();
    if (t) setTicker(t);
  };

  return (
    <div>
      <div style={{ ...panel, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
          <input value={tickerInput} onChange={(e) => setTickerInput(e.target.value.toUpperCase())} placeholder="Ticker (AAPL, NVDA, ^GSPC…)" style={{ ...input, width: 200, textAlign: "left", fontSize: 13, padding: "6px 10px" }} />
          <button type="submit" style={{ ...btn, color: C.accent, borderColor: C.accent }}>Buscar</button>
        </form>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} style={{ ...btn, padding: "5px 10px", fontSize: 10, color: range === r.id ? C.bg : C.muted, background: range === r.id ? C.accent : "transparent", borderColor: range === r.id ? C.accent : C.border }}>{r.label}</button>
          ))}
        </div>
        <Segmented options={[{ key: "line", label: "Línea" }, { key: "candles", label: "Velas" }]} value={prefs.mode} onChange={(mode) => setPrefs((p) => ({ ...p, mode }))} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
          {TOGGLES.map(([key, label, color]) => <Toggle key={key} label={label} active={show[key]} color={C[color]} onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))} />)}
        </div>
      </div>

      {ticker && (
        <div style={{ ...panel, marginBottom: 12, display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, color: C.accent, fontWeight: 700, letterSpacing: "0.04em" }}>{ticker}</div>
          {last && (
            <>
              <div style={{ fontSize: 22, color: C.text, fontFamily: mono }}>{fmtPrice(last.close)}</div>
              <div style={{ fontSize: 13, color: (dayChg ?? 0) >= 0 ? C.pos : C.neg, fontFamily: mono }}>{fmtPct(dayChg)} <span style={{ color: C.muted, fontSize: 10 }}>1d</span></div>
              <div style={{ fontSize: 11, color: (periodChg ?? 0) >= 0 ? C.pos : C.neg, fontFamily: mono }}>período {fmtPct(periodChg)}</div>
              {phase && (
                <span title={`desde ${phase.since}`} style={{ fontFamily: mono, fontSize: 10.5, padding: "2px 8px", border: `1px solid ${WYCKOFF_COLORS.SOS}`, color: WYCKOFF_COLORS.SOS }}>
                  WYCKOFF {phase.phase ? `FASE ${phase.phase}` : ""} · {phase.label}
                </span>
              )}
              <div style={{ fontSize: 10, color: C.muted, marginLeft: "auto", fontFamily: mono }}>{rows.length} sesiones · al {last.date}</div>
            </>
          )}
          {loading && <span style={{ fontSize: 11, color: C.muted }}>Cargando…</span>}
          {err && <span style={{ fontSize: 11, color: C.neg }}>{err}</span>}
        </div>
      )}

      {position && last && show.position && <PositionStrip plan={plan} levels={levels} price={last.close} accountLabel={ACCOUNTS[activeId].label} />}

      {rows.length > 0 && (
        <Panel title={`Precio · ${prefs.mode === "candles" ? "velas" : "línea"} · SMA 50 (azul) / 200 (ámbar)`} right={show.wyckoff ? `${events.length} eventos Wyckoff` : null}>
          <PriceChart rows={rows} mode={prefs.mode} show={show} events={events} wyRange={wyRange} sr={sr} profile={profile} position={position} tickInterval={tickInterval} />
        </Panel>
      )}

      {rows.length > 0 && (
        <Panel
          title={prefs.vol === "abs" ? "Volumen" : `Volumen relativo · ${rvolPeriod} sesiones previas`}
          right={<Segmented options={[{ key: "rvol20", label: "RVOL 20" }, { key: "rvol10", label: "RVOL 10" }, { key: "abs", label: "Volumen" }]} value={prefs.vol} onChange={(vol) => setPrefs((p) => ({ ...p, vol }))} />}
          style={{ marginTop: 12 }}
        >
          <VolumePanel rows={rows} mode={prefs.vol === "abs" ? "abs" : "rvol"} period={rvolPeriod} tickInterval={tickInterval} />
          <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 4 }}>
            RVOL = volumen del día ÷ promedio de las {rvolPeriod} sesiones anteriores. Wyckoff usa 20 (WYCKOFF_FRAMEWORK.md); 10 reacciona más rápido. Barras intensas: RVOL ≥ 1.5.
          </div>
        </Panel>
      )}

      {rows.length > 14 && (
        <Panel title="RSI 14" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
              <YAxis stroke={C.muted} fontSize={10} width={52} domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: C.muted }} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 11 }} formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)} />
              <ReferenceLine y={70} stroke={C.neg} strokeDasharray="3 3" strokeOpacity={0.6} />
              <ReferenceLine y={30} stroke={C.pos} strokeDasharray="3 3" strokeOpacity={0.6} />
              <Line dataKey="rsi14" stroke={C.accent} strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {show.obv && rows.length > 1 && (
        <Panel title="OBV · On-Balance Volume" style={{ marginTop: 12 }}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="date" stroke={C.muted} fontSize={10} interval={tickInterval} tick={{ fill: C.muted }} />
              <YAxis stroke={C.muted} fontSize={10} width={52} tickFormatter={fmtVol} tick={{ fill: C.muted }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 11 }} formatter={(v) => fmtVol(v)} />
              <Line dataKey="obv" stroke={C.pos} strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {rows.length > 0 && (
        <div className="dione-grid-2" style={{ marginTop: 12 }}>
          {show.wyckoff ? <WyckoffTable events={events} phase={phase} /> : <div />}
          <LevelsTable sr={sr} lines={lines} profile={profile} price={last?.close} />
        </div>
      )}

      {show.wyckoff && rows.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 10.5, color: C.muted, lineHeight: 1.7 }}>
          <b style={{ color: C.text }}>Cómo leerlo.</b> RVOL = volumen ÷ promedio de las 20 sesiones previas.{" "}
          <b style={{ color: WYCKOFF_COLORS.SC }}>SC</b> rango &gt; 2.5 ATR y RVOL &gt; 2.5 en tendencia bajista ·{" "}
          <b style={{ color: WYCKOFF_COLORS.AR }}>AR</b> rebote ≥ 10% a los 5–15 días ·{" "}
          <b style={{ color: WYCKOFF_COLORS.ST }}>ST</b> vuelve al mínimo del SC con menos del 70% de su volumen ·{" "}
          <b style={{ color: WYCKOFF_COLORS.Spring }}>Spring</b> rompe el mínimo de 60 sesiones y recupera en 1–5 días; el volumen solo lo clasifica (seco, moderado, shakeout) ·{" "}
          <b style={{ color: WYCKOFF_COLORS.Test }}>Test</b> primera vuelta a la zona del Spring sin nuevo mínimo y cerrando en la mitad superior: entrada al cierre, stop bajo el Spring ·{" "}
          <b style={{ color: WYCKOFF_COLORS.SOS }}>SOS</b> rompe el máximo de 20 sesiones con RVOL &gt; 1.5 ·{" "}
          <b style={{ color: WYCKOFF_COLORS.LPS }}>LPS</b> retroceso con RVOL &lt; 0.85 sobre el nivel roto.
          Desde v4 Wyckoff es descriptivo: no puntúa ni elige acciones (TECHNICAL_VALIDATED.md).
        </div>
      )}
    </div>
  );
}
