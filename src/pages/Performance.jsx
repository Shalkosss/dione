import React, { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { C, mono, panel } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { EmptyState } from "../components/ui.jsx";
import { usePortfolioData } from "../lib/usePortfolioData.js";
import { summarize, drawdownSeries, rollingExcess, monthlyReturns, alignSeries } from "../lib/perf.js";

const RF = 0.043; // tasa libre de riesgo anual de referencia
const MIN_SESSIONS = 60;
const tick = { fill: C.muted, fontSize: 10, fontFamily: mono };
const tooltipStyle = { background: C.panel2, border: `1px solid ${C.borderStrong}`, fontFamily: mono, fontSize: 11 };

const pct = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
const num = (v, d = 2) => (v == null ? "—" : v.toFixed(d));
const good = (v, threshold = 0) => (v == null ? C.muted : v > threshold ? C.pos : C.neg);

function Metric({ label, value, color = C.text, note }) {
  return (
    <div className="dione-panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `2px solid ${color === C.text ? C.borderStrong : color}`, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color, lineHeight: 1.3 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.35 }}>{note}</div>
    </div>
  );
}

function heat(v) {
  if (v == null) return "transparent";
  const strength = Math.min(1, Math.abs(v) / 0.08);
  return `color-mix(in srgb, ${v >= 0 ? C.pos : C.neg} ${Math.round(8 + strength * 36)}%, transparent)`;
}

// Módulo 2: métricas de desempeño de la cartera contra un benchmark.
export default function Performance() {
  const data = usePortfolioData();
  const [benchId, setBenchId] = useState("spy");

  const bench = data.benchSeries.find((b) => b.id === benchId) || data.benchSeries[0];
  const stats = useMemo(() => (bench ? summarize(data.index, bench.series, RF) : null), [data.index, bench]);
  const underwater = useMemo(() => drawdownSeries(data.index), [data.index]);
  const excess = useMemo(() => (bench ? rollingExcess(data.index, bench.series, 21) : []), [data.index, bench]);
  const months = useMemo(() => {
    if (!bench) return [];
    const [p, b] = alignSeries(data.index, bench.series);
    const bm = new Map(monthlyReturns(b).map((m) => [m.month, m.value]));
    return monthlyReturns(p).map((m) => ({ month: m.month, port: m.value, bench: bm.get(m.month) ?? null }));
  }, [data.index, bench]);

  if (data.loading) return <div style={{ ...panel, color: C.muted, fontFamily: mono, fontSize: 11.5 }}>bajando precios…</div>;
  if (!data.hasTrades || !stats || stats.sessions < 2) {
    return (
      <Panel title="Performance">
        <EmptyState title="Todavía no hay historia que medir">
          Estas métricas necesitan órdenes cargadas y al menos unas sesiones de historia. Registrá operaciones en el módulo Portafolio (podés usar fechas pasadas).
        </EmptyState>
      </Panel>
    );
  }

  const short = stats.sessions < MIN_SESSIONS;
  const dd = stats.maxDrawdown;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.1em", color: C.muted }}>BENCHMARK</span>
        <span style={{ display: "inline-flex" }}>
          {data.benchSeries.map((b) => (
            <button key={b.id} className="dione-chip" data-active={b.id === bench.id} onClick={() => setBenchId(b.id)} style={{ marginLeft: -1 }}>{b.name.toUpperCase()}</button>
          ))}
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>{stats.sessions} sesiones · desde {data.dates[0]} · tasa libre {(RF * 100).toFixed(1)}%</span>
      </div>

      {short && (
        <div style={{ ...panel, borderColor: C.amber, background: C.amberSoft, marginBottom: 12, fontSize: 12, color: C.text }}>
          <b style={{ color: C.amber }}>Muestra corta.</b> Con {stats.sessions} sesiones estas cifras son sobre todo ruido: un par de días buenos o malos las mueven mucho.
          Empiezan a decir algo a partir de unas {MIN_SESSIONS} sesiones (tres meses) y recién son confiables con uno o dos años.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Metric label="Alfa anualizado" value={pct(stats.alpha)} color={good(stats.alpha)} note={`Lo que rinde la cartera por encima de lo que explica su beta contra ${bench.name}.`} />
        <Metric label="Information ratio" value={num(stats.informationRatio)} color={good(stats.informationRatio)} note="Exceso de retorno por unidad de desvío contra el benchmark. Sobre 0.5 es bueno; sobre 1, excelente." />
        <Metric label="Máxima caída" value={pct(dd.value)} color={dd.value != null && dd.value < -0.15 ? C.neg : C.amber} note={dd.troughDate ? `Del pico del ${dd.peakDate} al piso del ${dd.troughDate}.` : "Sin caídas registradas."} />
        <Metric label="Beta" value={num(stats.beta)} note={`Cuánto se mueve la cartera por cada 1% de ${bench.name}. R² ${num(stats.r2)}.`} />
        <Metric label="Tracking error" value={pct(stats.trackingError).replace("+", "")} note="Qué tan distinto se mueve la cartera del benchmark, anualizado." />
        <Metric label="Sharpe" value={num(stats.sharpe)} color={good(stats.sharpe)} note="Retorno sobre la tasa libre por unidad de volatilidad total." />
        <Metric label="Sortino" value={num(stats.sortino)} color={good(stats.sortino)} note="Como Sharpe, pero solo castiga la volatilidad de los días malos." />
        <Metric label="Días que le gana" value={stats.hitRate == null ? "—" : `${(stats.hitRate * 100).toFixed(0)}%`} color={good(stats.hitRate, 0.5)} note={`Sesiones en que la cartera rinde más que ${bench.name}.`} />
        <Metric label="Captura al alza" value={stats.capture.up == null ? "—" : `${(stats.capture.up * 100).toFixed(0)}%`} color={good(stats.capture.up, 1)} note="Qué parte de los días positivos del benchmark se lleva la cartera." />
        <Metric label="Captura a la baja" value={stats.capture.down == null ? "—" : `${(stats.capture.down * 100).toFixed(0)}%`} color={stats.capture.down == null ? C.muted : stats.capture.down < 1 ? C.pos : C.neg} note="Qué parte de los días negativos sufre. Menos de 100% es defensivo." />
        <Metric label="Retorno total" value={pct(stats.totalReturn)} color={good(stats.totalReturn)} note={`${bench.name}: ${pct(stats.benchReturn)} en el mismo período.`} />
        <Metric label="Volatilidad" value={pct(stats.vol).replace("+", "")} note="Desvío anualizado de los retornos diarios." />
      </div>

      <div className="dione-grid-half" style={{ marginBottom: 12 }}>
        <Panel title="Bajo el agua · caída desde el máximo">
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={underwater} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={tick} tickFormatter={(d) => d.slice(5)} minTickGap={48} stroke={C.border} />
                <YAxis tick={tick} stroke={C.border} width={44} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} formatter={(v) => [`${(v * 100).toFixed(2)}%`, "Caída"]} />
                <Area type="linear" dataKey="value" stroke={C.neg} strokeWidth={1.4} fill={C.neg} fillOpacity={0.18} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={`Exceso móvil de 21 sesiones contra ${bench.name}`}>
          {excess.length < 2 ? <EmptyState title="Faltan sesiones">Hace falta más de un mes de historia para esta ventana.</EmptyState> : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={excess} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="date" tick={tick} tickFormatter={(d) => d.slice(5)} minTickGap={48} stroke={C.border} />
                  <YAxis tick={tick} stroke={C.border} width={44} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <ReferenceLine y={0} stroke={C.borderStrong} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.muted }} cursor={{ fill: C.accentSoft }} formatter={(v) => [`${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)} pp`, "Exceso"]} />
                  <Bar dataKey="value" isAnimationActive={false}>
                    {excess.map((p) => <Cell key={p.date} fill={p.value >= 0 ? C.pos : C.neg} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Retorno mes a mes" right={`arriba la cartera · abajo ${bench.name}`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 5 }}>
          {months.map((m) => (
            <div key={m.month} style={{ border: `1px solid ${C.border}`, textAlign: "center", fontFamily: mono }}>
              <div style={{ fontSize: 9.5, color: C.muted, padding: "3px 0", borderBottom: `1px solid ${C.border}`, letterSpacing: "0.06em" }}>{m.month}</div>
              <div style={{ background: heat(m.port), fontSize: 13, fontWeight: 600, padding: "5px 0", color: C.text }}>{pct(m.port)}</div>
              <div style={{ background: heat(m.bench), fontSize: 10.5, padding: "3px 0", color: C.muted }}>{pct(m.bench)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
