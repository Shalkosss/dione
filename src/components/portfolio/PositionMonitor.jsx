import React, { useEffect, useMemo, useState } from "react";
import { C, mono, th, td } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { EmptyState } from "../ui.jsx";
import PositionCard from "./PositionCard.jsx";
import { useLedger } from "../../store/LedgerContext.jsx";
import { useLiveTheses } from "../../lib/useLiveTheses.js";
import { positionPlan, positionMetrics, levelsFromThesis, effectiveLevels, correlationMatrix } from "../../lib/positionStats.js";
import { fetchNews } from "../../lib/newsApi.js";
import { money } from "../../lib/format.js";

const CORR_WINDOW = 90;

// Color de la celda: rojo cuanto más se mueven juntas, azul si van en contra.
function corrColor(v) {
  if (v == null) return "transparent";
  return v >= 0 ? `rgba(229, 99, 77, ${Math.min(0.75, v * 0.75)})` : `rgba(90, 160, 232, ${Math.min(0.75, -v * 0.75)})`;
}

function CorrelationMatrix({ prices, tickers }) {
  const { matrix, sessions } = useMemo(() => correlationMatrix(prices, tickers, CORR_WINDOW), [prices, tickers]);
  const pairs = [];
  tickers.forEach((a, i) => tickers.forEach((b, j) => { if (j > i && b !== "SPY" && a !== "SPY" && matrix[i][j] >= 0.8) pairs.push(`${a}–${b}`); }));
  return (
    <Panel title="Correlación entre posiciones" right={`${sessions} sesiones · retornos diarios`} flush>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: mono, fontSize: 10.5 }}>
          <thead>
            <tr><th style={th} />{tickers.map((t) => <th key={t} style={{ ...th, textAlign: "center" }}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {tickers.map((a, i) => (
              <tr key={a}>
                <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{a}</td>
                {tickers.map((b, j) => (
                  <td key={b} title={`${a} / ${b}`} style={{ ...td, textAlign: "center", minWidth: 46, background: i === j ? C.panel2 : corrColor(matrix[i][j]), color: C.text }}>
                    {i === j ? "—" : matrix[i][j] == null ? "·" : matrix[i][j].toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 12px", fontSize: 11, color: pairs.length ? C.amber : C.muted, borderTop: `1px solid ${C.border}` }}>
        {pairs.length ? `Se mueven casi juntas (≥ 0.80): ${pairs.join(", ")}. Diversifican poco entre sí.` : "Ningún par de posiciones supera 0.80: la cartera no repite la misma apuesta."}
      </div>
    </Panel>
  );
}

function NewsFeed({ tickers }) {
  const [items, setItems] = useState(null);
  const key = tickers.join(",");
  useEffect(() => {
    let alive = true;
    Promise.all(key.split(",").filter(Boolean).map((t) => fetchNews(t).then((list) => list.slice(0, 4).map((n) => ({ ...n, ticker: t })))))
      .then((lists) => {
        if (!alive) return;
        const seen = new Set();
        const merged = lists.flat().filter((n) => (seen.has(n.link) ? false : seen.add(n.link))).sort((a, b) => (b.time || "").localeCompare(a.time || ""));
        setItems(merged.slice(0, 14));
      });
    return () => { alive = false; };
  }, [key]);
  return (
    <Panel title="Noticias de la cartera" right="Yahoo Finance · últimos titulares" flush>
      {items == null && <div style={{ padding: 12, fontSize: 11, color: C.muted }}>buscando…</div>}
      {items && !items.length && <div style={{ padding: 12, fontSize: 11, color: C.muted }}>Sin titulares (Yahoo no respondió).</div>}
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 360, overflow: "auto" }}>
          {items.map((n) => (
            <li key={n.link} style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: C.accent, minWidth: 48 }}>{n.ticker}</span>
              <span style={{ minWidth: 0 }}>
                <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ color: C.text, fontSize: 12 }}>{n.title}</a>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: C.muted }}>{n.publisher || ""}{n.time ? ` · ${n.time.slice(0, 16).replace("T", " ")} UTC` : ""}</div>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Summary({ items, nav }) {
  const withStop = items.filter((x) => x.metrics?.riskUsd != null);
  const risk = withStop.reduce((s, x) => s + Math.max(0, x.metrics.riskUsd), 0);
  const noStop = items.filter((x) => !x.levels.stop).map((x) => x.plan.ticker);
  const near = items.filter((x) => x.metrics?.toStopAtr != null && x.metrics.toStopAtr < 1).map((x) => x.plan.ticker);
  const beating = items.filter((x) => x.metrics?.excess > 0).length;
  const cell = (label, value, color = C.text, sub) => (
    <div style={{ padding: "8px 14px", borderRight: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", border: `1px solid ${C.border}`, background: C.panel, marginBottom: 12 }}>
      {cell("Riesgo hasta los stops", money(risk), C.neg, nav > 0 ? `${((risk / nav) * 100).toFixed(2)}% de la cuenta` : null)}
      {cell("Le ganan al S&P 500", `${beating} de ${items.length}`, beating * 2 >= items.length ? C.pos : C.neg, "desde su compra")}
      {cell("Sin stop", noStop.length ? noStop.join(" ") : "ninguna", noStop.length ? C.amber : C.pos)}
      {cell("A menos de 1 ATR del stop", near.length ? near.join(" ") : "ninguna", near.length ? C.neg : C.pos)}
    </div>
  );
}

// Seguimiento de cada posición abierta desde su compra: gráfico con stop y
// take profit, métricas, correlación y noticias.
export default function PositionMonitor({ valued, prices, nav }) {
  const { account, setPositionLevels } = useLedger();
  const theses = useLiveTheses();
  const tickers = useMemo(() => valued.rows.map((r) => r.ticker), [valued.rows]);

  const items = useMemo(() => tickers.map((t) => {
    const plan = positionPlan(account.transactions, t);
    const thesisLevels = levelsFromThesis(theses, t);
    const levels = effectiveLevels(plan, thesisLevels);
    const series = prices?.[t] || [];
    return { plan, levels, thesisLevels, series, metrics: plan ? positionMetrics(plan, series, prices?.SPY || [], levels) : null };
  }).filter((x) => x.plan && x.metrics), [tickers, account.transactions, theses, prices]);

  const corrTickers = useMemo(() => [...tickers.filter((t) => prices?.[t]?.length), "SPY"], [tickers, prices]);

  return (
    <section id="seguimiento" style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.12em", color: C.muted, margin: "4px 0 8px" }}>SEGUIMIENTO DE POSICIONES · DESDE LA COMPRA</div>
      {items.length === 0 ? (
        <Panel title="Seguimiento"><EmptyState title="Sin posiciones abiertas">Cada compra aparece acá con su gráfico desde la entrada, el stop, el take profit y sus métricas.</EmptyState></Panel>
      ) : (
        <>
          <Summary items={items} nav={nav} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12, marginBottom: 12 }}>
            {items.map((x) => <PositionCard key={x.plan.ticker} {...x} nav={nav} onSaveLevels={setPositionLevels} />)}
          </div>
          <div className="dione-grid-2">
            <NewsFeed tickers={tickers} />
            {corrTickers.length > 2 ? <CorrelationMatrix prices={prices} tickers={corrTickers} /> : <Panel title="Correlación"><div style={{ fontSize: 11, color: C.muted }}>Hace falta al menos dos posiciones.</div></Panel>}
          </div>
        </>
      )}
    </section>
  );
}
