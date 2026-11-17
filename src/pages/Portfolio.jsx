import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { C, mono, btn, panel } from "../theme.js";
import { useLedger, ACCOUNTS } from "../store/LedgerContext.jsx";
import { usePortfolioData } from "../lib/usePortfolioData.js";
import { buildExampleOrders } from "../lib/exampleBook.js";
import { totalReturn } from "../lib/perf.js";
import { money, moneySigned } from "../lib/format.js";
import RaceChart from "../components/portfolio/RaceChart.jsx";
import ReturnsMatrix from "../components/portfolio/ReturnsMatrix.jsx";
import SectorTilt from "../components/portfolio/SectorTilt.jsx";
import TradeTicket from "../components/portfolio/TradeTicket.jsx";
import MandatePanel from "../components/portfolio/MandatePanel.jsx";
import BenchmarkEditor from "../components/portfolio/BenchmarkEditor.jsx";
import { Positions, Blotter } from "../components/portfolio/Positions.jsx";
import SyncBar from "../components/portfolio/SyncBar.jsx";

const signedPct = (v, d = 2) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
const tone = (v) => (v == null ? C.muted : v >= 0 ? C.pos : C.neg);

function Figure({ label, value, color = C.text, sub, big = false }) {
  return (
    <div style={{ padding: "10px 16px", borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: big ? 26 : 19, fontWeight: 600, color, letterSpacing: "-0.01em", lineHeight: 1.25, whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

// Franja superior: valor de la cuenta y su resultado contra el S&P 500.
function Hero({ data }) {
  const { curve, index, benchSeries, valued, account } = data;
  const last = curve[curve.length - 1];
  const prev = curve[curve.length - 2];
  const dayPnl = last && prev ? last.value - last.flow - prev.value : null;
  const dayPct = dayPnl != null && prev.value > 0 ? dayPnl / prev.value : null;
  const ret = totalReturn(index);
  const spyRet = totalReturn(benchSeries.find((b) => b.id === "spy")?.series || []);
  const excess = ret != null && spyRet != null ? ret - spyRet : null;
  const nav = valued?.total ?? account.initialCash;
  const invested = valued ? 1 - valued.cash / valued.total : 0;

  return (
    <div style={{ ...panel, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 12, overflow: "hidden" }}>
      <Figure big label="Valor de la cuenta" value={money(nav)} sub={`capital inicial ${money(account.initialCash)}`} />
      <Figure label="Hoy" value={dayPnl == null ? "—" : moneySigned(dayPnl)} color={tone(dayPnl)} sub={signedPct(dayPct)} />
      <Figure label="Retorno desde el inicio" value={signedPct(ret)} color={tone(ret)} sub={`S&P 500 ${signedPct(spyRet)}`} />
      <Figure label="Contra el S&P 500" value={excess == null ? "—" : `${excess >= 0 ? "+" : ""}${(excess * 100).toFixed(2)} pp`} color={tone(excess)} sub={excess == null ? "sin historia" : excess >= 0 ? "le ganás al índice" : "el índice te gana"} />
      <Figure label="Invertido" value={`${(invested * 100).toFixed(1)}%`} sub={`caja ${money(valued?.cash ?? account.initialCash)}`} />
      <Figure label="Posiciones" value={valued?.rows.length ?? 0} sub={`desde ${data.startDate}`} />
    </div>
  );
}

function Welcome({ onExample, busy, error }) {
  return (
    <div style={{ ...panel, borderColor: C.accent, marginBottom: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: C.accent, marginBottom: 4 }}>CUENTA VACÍA</div>
        <div style={{ fontSize: 13, color: C.text }}>
          Registrá tu primera compra en la boleta de orden o escribí <b style={{ fontFamily: mono }}>buy voo 10</b> en la línea de comandos.
          Podés poner fechas pasadas: la curva se reconstruye con los precios reales desde ese día.
        </div>
      </div>
      <button onClick={onExample} disabled={busy} style={{ ...btn, padding: "9px 16px", color: C.accent, borderColor: C.accent, background: "transparent" }}>
        {busy ? "ARMANDO…" : "CARGAR CARTERA DE EJEMPLO"}
      </button>
      {error && <div style={{ flexBasis: "100%", fontSize: 11.5, color: C.neg }}>{error}</div>}
    </div>
  );
}

// Módulo 1: la cartera ficticia contra sus benchmarks, con sectores, mandato y órdenes.
export default function Portfolio() {
  const data = usePortfolioData();
  const { account, activeId, placeOrders, removeTransaction, resetAccount } = useLedger();
  const [params, setParams] = useSearchParams();
  const [prefill, setPrefill] = useState(null);
  const [showRefs, setShowRefs] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Orden rápida que llega por la URL desde la línea de comandos (?side=BUY&t=NU&q=10).
  const urlTicker = params.get("t");
  useEffect(() => {
    if (!urlTicker) return;
    setPrefill({ side: params.get("side") === "SELL" ? "SELL" : "BUY", ticker: urlTicker.toUpperCase(), qty: Number(params.get("q")) || null });
    setParams({}, { replace: true });
  }, [urlTicker]); // eslint-disable-line react-hooks/exhaustive-deps

  const fallbackValued = useMemo(() => ({ total: account.initialCash, cash: account.initialCash, rows: [] }), [account.initialCash]);
  const valued = data.valued || fallbackValued;

  async function loadExample() {
    setBusy(true);
    setNotice(null);
    try {
      const orders = await buildExampleOrders(account.initialCash, activeId === "paper");
      const result = placeOrders(orders);
      if (!result.ok) setNotice(result.errors[0]);
    } catch (e) {
      setNotice(e.message);
    }
    setBusy(false);
  }

  function handleRemove(id) {
    const result = removeTransaction(id);
    setNotice(result.ok ? null : `No se puede borrar ese movimiento: ${result.errors[0]}`);
  }

  function handleReset() {
    if (window.confirm(`¿Borrar todas las órdenes de la cuenta ${ACCOUNTS[activeId].label}? No se puede deshacer.`)) resetAccount();
  }

  return (
    <div>
      {data.error && <div style={{ ...panel, borderColor: C.neg, color: C.neg, marginBottom: 12, fontSize: 12 }}>{data.error}</div>}
      <SyncBar />
      {!data.hasTrades && <Welcome onExample={loadExample} busy={busy} error={notice} />}

      <Hero data={{ ...data, valued }} />

      <div className="dione-grid-2" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <RaceChart
            index={data.index}
            benchSeries={data.benchSeries}
            right={<button onClick={() => setShowRefs((v) => !v)} style={{ ...btn, padding: "2px 9px", fontSize: 10, color: showRefs ? C.accent : C.text }}>{showRefs ? "OCULTAR REFERENCIAS" : "EDITAR REFERENCIAS"}</button>}
          />
          {showRefs && <BenchmarkEditor />}
          <ReturnsMatrix index={data.index} benchSeries={data.benchSeries} spyHistory={data.spyHistory} />
        </div>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <TradeTicket nav={valued.total} prefill={prefill} />
          <MandatePanel valued={valued} accountId={activeId} />
        </div>
      </div>

      <div className="dione-grid-2" style={{ marginBottom: 12 }}>
        <Positions valued={valued} onSell={(row) => { setPrefill({ side: "SELL", ticker: row.ticker, qty: row.qty }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        <SectorTilt valued={valued} />
      </div>

      {notice && data.hasTrades && <div style={{ ...panel, borderColor: C.amber, color: C.amber, marginBottom: 12, fontSize: 12 }}>{notice}</div>}
      <Blotter transactions={account.transactions} onRemove={handleRemove} />

      {data.hasTrades && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button onClick={handleReset} style={{ ...btn, background: "transparent", color: C.muted, fontSize: 10 }}>VACIAR CUENTA {ACCOUNTS[activeId].label.toUpperCase()}</button>
        </div>
      )}
    </div>
  );
}
