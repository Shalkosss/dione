import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot } from "recharts";
import { C, mono, btn, input } from "../../theme.js";
import { splitHeld } from "../../lib/chartData.js";
import { fetchNews } from "../../lib/newsApi.js";
import { money, moneySigned } from "../../lib/format.js";

const pct = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
const f2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const tone = (v) => (v == null ? C.muted : v >= 0 ? C.pos : C.neg);
const LEAD = 20; // sesiones previas a la compra que se muestran

function MiniChart({ series, plan, levels }) {
  const rows = useMemo(() => {
    const i = series.findIndex((p) => p.date >= plan.startDate);
    const from = i === -1 ? Math.max(0, series.length - 60) : Math.max(0, i - LEAD);
    return splitHeld(series.slice(from), plan.startDate);
  }, [series, plan.startDate]);
  if (rows.length < 2) return <div style={{ height: 150, fontSize: 11, color: C.muted }}>Sin precios todavía.</div>;
  const x1 = rows.find((r) => r.date >= plan.startDate)?.date || rows[0].date;
  const x2 = rows[rows.length - 1].date;
  const up = rows[rows.length - 1].close >= plan.avgCost;
  const dates = new Set(rows.map((r) => r.date));
  return (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={rows} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis domain={["auto", "auto"]} width={44} fontSize={9.5} tick={{ fill: C.muted }} stroke={C.border} tickFormatter={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1))} />
        <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 10.5, fontFamily: mono }} labelStyle={{ color: C.muted }} formatter={(v) => [f2(v), "cierre"]} />
        {levels.target && <ReferenceArea x1={x1} x2={x2} y1={plan.avgCost} y2={levels.target} fill={C.pos} fillOpacity={0.09} ifOverflow="extendDomain" />}
        {levels.stop && <ReferenceArea x1={x1} x2={x2} y1={levels.stop} y2={plan.avgCost} fill={C.neg} fillOpacity={0.09} ifOverflow="extendDomain" />}
        <ReferenceLine y={plan.avgCost} stroke={C.accent} strokeDasharray="5 3" ifOverflow="extendDomain" />
        {levels.stop && <ReferenceLine y={levels.stop} stroke={C.neg} strokeWidth={1.3} ifOverflow="extendDomain" label={{ value: "SL", fill: C.neg, fontSize: 9, position: "insideBottomLeft" }} />}
        {levels.target && <ReferenceLine y={levels.target} stroke={C.pos} strokeWidth={1.3} ifOverflow="extendDomain" label={{ value: "TP", fill: C.pos, fontSize: 9, position: "insideTopLeft" }} />}
        <Line dataKey="closePre" stroke={C.muted} strokeWidth={1.2} dot={false} isAnimationActive={false} connectNulls={false} />
        <Line dataKey="closeHeld" stroke={up ? C.pos : C.neg} strokeWidth={2} strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls={false} />
        {plan.buys.filter((b) => dates.has(b.date)).map((b) => <ReferenceDot key={b.id} x={b.date} y={b.price} r={3.5} fill={C.pos} stroke={C.bg} ifOverflow="extendDomain" />)}
        {plan.sells.filter((s) => dates.has(s.date)).map((s) => <ReferenceDot key={s.id} x={s.date} y={s.price} r={3.5} fill={C.neg} stroke={C.bg} ifOverflow="extendDomain" />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Barra stop → take profit con el precio y la entrada marcados.
function RangeBar({ plan, levels, price }) {
  const { stop, target } = levels;
  if (!(stop > 0 && target > stop)) return null;
  const at = (v) => `${Math.max(0, Math.min(100, ((v - stop) / (target - stop)) * 100))}%`;
  return (
    <div style={{ margin: "6px 0 2px" }}>
      <div style={{ position: "relative", height: 8, background: `linear-gradient(90deg, ${C.negSoft}, ${C.panel2} 50%, ${C.posSoft})`, border: `1px solid ${C.border}` }}>
        <span title="entrada" style={{ position: "absolute", left: at(plan.avgCost), top: -3, width: 2, height: 12, background: C.accent }} />
        <span title="precio" style={{ position: "absolute", left: at(price), top: -4, width: 8, height: 14, marginLeft: -4, background: price >= plan.avgCost ? C.pos : C.neg }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 9.5, color: C.muted, marginTop: 2 }}>
        <span>SL {f2(stop)}</span><span>entrada {f2(plan.avgCost)}</span><span>TP {f2(target)}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, color = C.text, hint }) {
  return (
    <div title={hint} style={{ minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.08em", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color, whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function alertsOf(m, levels) {
  const out = [];
  if (!levels.stop) out.push([C.amber, "Sin stop definido"]);
  if (m.toStop != null && m.toStop <= 0) out.push([C.neg, "El precio está bajo el stop: la regla dice salir"]);
  else if (m.stopHit) out.push([C.neg, "El precio tocó el stop desde la compra"]);
  else if (m.toStopAtr != null && m.toStopAtr < 1) out.push([C.neg, `A menos de 1 ATR del stop (${m.toStopAtr.toFixed(1)})`]);
  if (m.targetHit) out.push([C.pos, "Tocó el take profit: decidir si se cierra"]);
  return out;
}

function LevelsEditor({ plan, levels, thesisLevels, onSave }) {
  const [stop, setStop] = useState(levels.stop ?? "");
  const [target, setTarget] = useState(levels.target ?? "");
  const [msg, setMsg] = useState(null);
  const field = { ...input, width: 86, padding: "4px 6px", fontSize: 11.5, textAlign: "right" };
  const save = (s, t) => {
    const r = onSave(plan.ticker, { stop: s, target: t });
    setMsg(r.ok ? "guardado" : r.errors[0]);
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontFamily: mono, fontSize: 10.5, color: C.muted }}>
      SL <input type="number" step="any" value={stop} onChange={(e) => setStop(e.target.value)} style={field} />
      TP <input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} style={field} />
      <button onClick={() => save(stop, target)} style={{ ...btn, padding: "3px 9px", fontSize: 10, color: C.accent, borderColor: C.accent, background: "transparent" }}>GUARDAR</button>
      {thesisLevels && (thesisLevels.stop || thesisLevels.target) && (
        <button onClick={() => { setStop(thesisLevels.stop ?? ""); setTarget(thesisLevels.target ?? ""); save(thesisLevels.stop, thesisLevels.target); }} style={{ ...btn, padding: "3px 9px", fontSize: 10, background: "transparent" }}>USAR LOS DE LA TESIS</button>
      )}
      {msg && <span style={{ color: msg === "guardado" ? C.pos : C.neg }}>{msg}</span>}
    </div>
  );
}

function News({ ticker }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchNews(ticker).then((list) => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, [ticker]);
  if (items == null) return <div style={{ fontSize: 10.5, color: C.muted }}>buscando noticias…</div>;
  if (!items.length) return <div style={{ fontSize: 10.5, color: C.muted }}>Sin noticias (Yahoo no respondió o no hay titulares).</div>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 5 }}>
      {items.slice(0, 4).map((n) => (
        <li key={n.link} style={{ fontSize: 11.5, lineHeight: 1.35 }}>
          <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{n.title}</a>
          <div style={{ fontFamily: mono, fontSize: 9.5, color: C.muted }}>{n.publisher || ""}{n.time ? ` · ${n.time.slice(0, 10)}` : ""}</div>
        </li>
      ))}
    </ul>
  );
}

export default function PositionCard({ plan, metrics: m, levels, thesisLevels, series, nav, onSaveLevels }) {
  const [tab, setTab] = useState("metricas");
  if (!m) return null;
  const alerts = alertsOf(m, levels);
  return (
    <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: 12, minWidth: 0, display: "grid", gap: 8, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <Link to={`/chart?t=${encodeURIComponent(plan.ticker)}`} style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: C.accent }}>{plan.ticker}</Link>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{+plan.qty.toFixed(3)} × {f2(plan.avgCost)} · desde {plan.startDate} · {m.sessions} sesiones</span>
        <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 15, fontWeight: 700, color: tone(m.ret) }}>{pct(m.ret, 2)}</span>
      </div>

      <MiniChart series={series} plan={plan} levels={levels} />
      <RangeBar plan={plan} levels={levels} price={m.price} />

      {alerts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {alerts.map(([color, text]) => <span key={text} style={{ fontFamily: mono, fontSize: 10, padding: "2px 7px", border: `1px solid ${color}`, color }}>{text}</span>)}
        </div>
      )}

      <div style={{ display: "flex", gap: 4 }}>
        {[["metricas", "MÉTRICAS"], ["niveles", "STOP / TP"], ["noticias", "NOTICIAS"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...btn, padding: "3px 9px", fontSize: 9.5, color: tab === k ? C.bg : C.muted, background: tab === k ? C.accent : "transparent", borderColor: tab === k ? C.accent : C.border }}>{l}</button>
        ))}
        {levels.source === "tesis" && <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 9.5, color: C.muted, alignSelf: "center" }}>niveles de la tesis</span>}
      </div>

      {tab === "metricas" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px 10px" }}>
          <Metric label="Resultado" value={moneySigned(m.pnl)} color={tone(m.pnl)} hint={`valor ${money(m.value)}`} />
          <Metric label="vs S&P 500" value={m.excess == null ? "—" : `${m.excess >= 0 ? "+" : ""}${(m.excess * 100).toFixed(1)} pp`} color={tone(m.excess)} hint={`S&P 500 en el mismo tramo: ${pct(m.spyRet)}`} />
          <Metric label="Múltiplo R" value={m.r == null ? "—" : `${m.r >= 0 ? "+" : ""}${m.r.toFixed(2)}R`} color={tone(m.r)} hint="ganancia ÷ riesgo inicial (entrada − stop)" />
          <Metric label="Al stop" value={m.toStop == null ? "—" : m.toStop <= 0 ? "perforado" : `−${(m.toStop * 100).toFixed(1)}%`} color={C.neg} hint={m.toStopAtr != null ? `${m.toStopAtr.toFixed(1)} ATR` : undefined} />
          <Metric label="Al take profit" value={m.toTarget == null ? "—" : pct(m.toTarget)} color={C.pos} hint={m.rrPlanned != null ? `R:R planeado ${m.rrPlanned.toFixed(1)}` : undefined} />
          <Metric label="Riesgo al stop" value={m.riskUsd == null ? "—" : m.riskUsd <= 0 ? "perforado" : money(m.riskUsd)} color={m.riskUsd != null && m.riskUsd <= 0 ? C.neg : C.text} hint={m.riskUsd > 0 && nav > 0 ? `lo que se pierde desde hoy si toca el stop: ${((m.riskUsd / nav) * 100).toFixed(2)}% de la cuenta` : undefined} />
          <Metric label="Sharpe" value={m.sharpe == null ? "—" : m.sharpe.toFixed(2)} color={tone(m.sharpe)} hint="desde la compra, tasa libre 0; requiere 20 sesiones" />
          <Metric label="Volatilidad" value={m.volAnn == null ? "—" : `${(m.volAnn * 100).toFixed(0)}%`} hint="anualizada desde la compra" />
          <Metric label="Máx. caída" value={m.maxDD == null ? "—" : `${(m.maxDD * 100).toFixed(1)}%`} color={C.neg} hint="desde la compra" />
          <Metric label="Beta" value={m.beta == null ? "—" : m.beta.toFixed(2)} hint="contra SPY, últimas 120 sesiones" />
          <Metric label="Correl. SPY" value={m.corr == null ? "—" : m.corr.toFixed(2)} hint="últimas 120 sesiones" />
          <Metric label="ATR 14" value={m.atr == null ? "—" : f2(m.atr)} hint="rango diario promedio" />
        </div>
      )}
      {tab === "niveles" && <LevelsEditor plan={plan} levels={levels} thesisLevels={thesisLevels} onSave={onSaveLevels} />}
      {tab === "noticias" && <News ticker={plan.ticker} />}
    </div>
  );
}
