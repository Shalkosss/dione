import React, { useMemo, useDeferredValue } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ZAxis,
} from "recharts";
import { usePortfolio, CONF_MAP } from "../store/PortfolioContext.jsx";
import { C, mono, panel, input, btn, th, td } from "../theme.js";
import { Panel, Stat } from "../components/Panel.jsx";
import { pct, money } from "../lib/format.js";
import {
  buildCovariance, blackLitterman, optimize,
  portReturn, portVariance, portBeta, sharpe,
} from "../lib/finance.js";

// Top-N holdings de un vector de pesos w, filtrando pesos despreciables.
function topHoldings(w, clean, n = 3) {
  return clean
    .map((a, i) => ({ ticker: a.ticker, w: w[i] }))
    .filter((x) => x.w > 0.005)
    .sort((a, b) => b.w - a.w)
    .slice(0, n);
}

export default function Optimizer() {
  const { assets, setAssets, params, setParam, resetPortfolio } = usePortfolio();
  const posCap = 0.15;
  const maxPositions = 8;
  const blMode = params.returnMode === "bl";

  // Defer assets para que typing en los inputs no bloquee el render
  // mientras corre el Monte Carlo. React 18 hace el trabajo pesado
  // con prioridad baja y mantiene los inputs responsivos.
  const deferredAssets = useDeferredValue(assets);

  /* ---- edicion ---- */
  const upd = (i, f, v) =>
    setAssets((p) => p.map((a, idx) => (idx === i ? { ...a, [f]: v } : a)));
  const addAsset = () =>
    setAssets((p) => [
      ...p,
      { ticker: "NEW", sector: "—", er: 8, vol: 20, beta: 1, w: 0, conf: "med", useView: false },
    ]);
  const removeAsset = (i) => setAssets((p) => p.filter((_, idx) => idx !== i));

  const weightSum = assets.reduce((s, a) => s + (Number(a.w) || 0), 0);

  const normalize = () => {
    if (weightSum <= 0) return;
    setAssets((p) => p.map((a) => ({ ...a, w: ((Number(a.w) || 0) / weightSum) * 100 })));
  };

  // Aplica los pesos óptimos calculados por el optimizer al portfolio actual.
  const applyWeights = (optW) =>
    setAssets((p) => p.map((a, i) => ({
      ...a,
      w: parseFloat((optW[i] * 100).toFixed(2)),
    })));

  /* ---- COMPUTO ----
     Usa deferredAssets (no assets) — el motor cuantitativo es pesado;
     los inputs se actualizan inmediatamente pero el optimizer corre
     con un frame de retraso si estás tipeando rápido. */
  const eng = useMemo(() => {
    const clean = deferredAssets.map((a) => ({
      ticker: String(a.ticker || "?"),
      sector: String(a.sector || "—"),
      er: Number(a.er) || 0,
      vol: Number(a.vol) || 0,
      beta: Number(a.beta) || 0,
      w: Number(a.w) || 0,
      conf: a.conf || "med",
      useView: !!a.useView,
    }));
    const n = clean.length;
    const rfDec = params.rf / 100;
    const marketVar = Math.pow(params.mktVol / 100, 2);
    const cov = buildCovariance(clean, marketVar);
    const wsum = clean.reduce((s, a) => s + a.w, 0) || 1;
    const wCur = clean.map((a) => a.w / wsum);

    // retornos esperados segun modo
    let expReturns;
    let impliedShown = null;
    if (blMode) {
      const delta =
        marketVar > 0
          ? (params.mktEr / 100 - rfDec) / marketVar
          : 2.5;
      const views = clean
        .map((a, i) => ({ idx: i, q: a.er / 100, confidence: CONF_MAP[a.conf], use: a.useView }))
        .filter((v) => v.use);
      try {
        expReturns = blackLitterman(cov, wCur, delta, rfDec, views);
      } catch (e) {
        expReturns = clean.map((a) => a.er / 100);
      }
      impliedShown = expReturns;
    } else {
      expReturns = clean.map((a) => a.er / 100);
    }

    const cap = params.applyCap ? posCap : null;

    // CASH y equivalentes nunca entran al optimizer (regla del mandato).
    // Los activos restantes se optimizan; CASH queda fijo en 0% en el output.
    const isCash = (a) =>
      String(a.ticker || "").toUpperCase() === "CASH" ||
      String(a.sector || "").toLowerCase() === "cash";
    const optIdx = clean.map((_, i) => i).filter((i) => !isCash(clean[i]));

    let opt;
    if (optIdx.length === clean.length || optIdx.length < 2) {
      // No hay cash (o quedaría < 2 activos): optimizar el universo completo
      opt = optimize(expReturns, cov, rfDec, cap);
    } else {
      // Hay cash: optimizar solo sobre el sub-universo, mapear de vuelta con cash = 0
      const subER = optIdx.map((i) => expReturns[i]);
      const subCov = optIdx.map((i) => optIdx.map((j) => cov[i][j]));
      const subOpt = optimize(subER, subCov, rfDec, cap);
      const expand = (subW) => {
        const w = new Array(clean.length).fill(0);
        optIdx.forEach((origIdx, k) => { w[origIdx] = subW[k]; });
        return w;
      };
      opt = {
        cloud: subOpt.cloud,
        frontier: subOpt.frontier,
        minVar: { ...subOpt.minVar, w: expand(subOpt.minVar.w) },
        maxSharpe: { ...subOpt.maxSharpe, w: expand(subOpt.maxSharpe.w) },
      };
    }

    const metricsOf = (w) => {
      const ret = portReturn(w, expReturns);
      const vol = Math.sqrt(portVariance(w, cov));
      return { w, ret, vol, sharpe: sharpe(ret, vol, rfDec), beta: portBeta(w, clean) };
    };

    return {
      clean, cov, wCur, expReturns, impliedShown,
      current: metricsOf(wCur),
      minVar: { ...opt.minVar, beta: portBeta(opt.minVar.w, clean) },
      maxSharpe: { ...opt.maxSharpe, beta: portBeta(opt.maxSharpe.w, clean) },
      cloud: opt.cloud,
      frontier: opt.frontier,
    };
  }, [deferredAssets, params, posCap, blMode]);

  const { clean, current, minVar, maxSharpe, cloud, frontier, wCur, impliedShown } = eng;

  /* ---- alertas de mandato ---- */
  const flags = [];
  if (Math.abs(weightSum - 100) > 0.5)
    flags.push({ lvl: "warn", msg: `Pesos suman ${weightSum.toFixed(1)}% — normalizá a 100%.` });
  clean.forEach((a, i) => {
    if (wCur[i] > posCap + 0.001)
      flags.push({ lvl: "bad", msg: `${a.ticker} pesa ${pct(wCur[i])} — excede cap ${pct(posCap)}.` });
  });
  const nPos = clean.filter((a, i) => a.sector !== "Cash" && wCur[i] > 0.005).length;
  if (nPos > maxPositions)
    flags.push({ lvl: "warn", msg: `${nPos} posiciones — mandato sugiere máx ${maxPositions}.` });
  if (params.applyCap && clean.length * posCap < 1) {
    const minN = Math.ceil(1 / posCap);
    flags.push({ lvl: "warn", msg: `Cap ${pct(posCap)} requiere mín. ${minN} activos (tenés ${clean.length}) — se optimizó sin restricción de cap.` });
  }

  /* ---- rebalanceo ---- */
  const rebal = clean.map((a, i) => {
    const cur = wCur[i], tgt = maxSharpe.w[i];
    return { ticker: a.ticker, cur, tgt, dPp: (tgt - cur) * 100, dUsd: (tgt - cur) * params.portSize };
  });

  const markCur = { vol: current.vol * 100, ret: current.ret * 100 };
  const markMV = { vol: minVar.vol * 100, ret: minVar.ret * 100 };
  const markMS = { vol: maxSharpe.vol * 100, ret: maxSharpe.ret * 100 };

  // Capital Market Line: pasa por (0, rf) y es tangente a la frontera en Max-Sharpe.
  // ret = rf + sharpe * vol (en unidades de %)
  const rfPct = Number(params.rf) || 0;
  const maxVolChart = Math.max(markMS.vol * 1.25, ...(frontier.map((p) => p.vol)));
  const cml = [
    { vol: 0, ret: rfPct },
    { vol: maxVolChart, ret: rfPct + maxSharpe.sharpe * maxVolChart },
  ];

  return (
    <div>
      {/* PARAMS */}
      <div style={{ ...panel, display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        {[
          ["Risk-free %", "rf", 0.1],
          ["Market E[R] %", "mktEr", 0.5],
          ["Market Vol %", "mktVol", 0.5],
          ["Portfolio $", "portSize", 500],
        ].map(([label, key, step]) => (
          <div key={key}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{label.toUpperCase()}</div>
            <input
              type="number" step={step} value={params[key]}
              onChange={(e) => setParam(key, e.target.value)}
              style={{ ...input, width: 92 }}
            />
          </div>
        ))}

        <div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>RETORNOS ESPERADOS</div>
          <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
            {[["direct", "DIRECTO"], ["bl", "BLACK-LITTERMAN"]].map(([k, lab]) => (
              <div key={k} className="dione-hover" onClick={() => setParam("returnMode", k)}
                style={{ padding: "5px 11px", fontSize: 11, cursor: "pointer", fontWeight: 600,
                  background: params.returnMode === k ? C.blue : "transparent",
                  color: params.returnMode === k ? C.bg : C.muted }}>
                {lab}
              </div>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={params.applyCap}
            onChange={(e) => setParam("applyCap", e.target.checked)}
            style={{ accentColor: C.accent }} />
          Cap mandato {pct(posCap)}
        </label>

        <div style={{ flex: 1 }} />

        <button
          className="dione-hover"
          onClick={() => { if (confirm("Restablecer portfolio a los valores por defecto?")) resetPortfolio(); }}
          style={{ ...btn, color: C.muted, fontSize: 10 }}
          title="Vuelve al portfolio default de ejemplo"
        >
          ↺ Restablecer
        </button>
      </div>

      {blMode && (
        <div style={{ ...panel, marginBottom: 16, padding: "10px 16px", fontSize: 11, color: C.muted, borderColor: C.blue }}>
          <b style={{ color: C.blue }}>Black-Litterman activo.</b> Parte del equilibrio implícito
          en tus pesos actuales (prior) y lo combina con tus views — solo los activos con
          "view ✓" aportan opinión, ponderados por confianza. La columna <b style={{ color: C.text }}>E[R] post.</b>
          {" "}muestra el retorno posterior resultante.
        </div>
      )}

      {/* TABLA DE ACTIVOS */}
      <Panel
        title={`INPUTS — ${blMode ? "VIEWS + SUPUESTOS" : "SUPUESTOS"} [Inferencia: revisar con Bloomberg]`}
        right={<span style={{ color: Math.abs(weightSum - 100) > 0.5 ? C.neg : C.pos }}>Σ = {weightSum.toFixed(1)}%</span>}
        style={{ marginBottom: 16 }}
      >
        <div style={{ overflowX: "auto", margin: -16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: blMode ? 760 : 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Ticker</th>
                <th style={{ ...th, textAlign: "left" }}>Sector</th>
                <th style={th}>{blMode ? "View E[R]%" : "E[R]%"}</th>
                <th style={th}>Vol %</th>
                <th style={th}>β</th>
                {blMode && <th style={th}>View</th>}
                {blMode && <th style={th}>Conf.</th>}
                {blMode && <th style={th}>E[R] post.</th>}
                <th style={th}>Peso %</th>
                <th style={{ ...th, width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 16, width: 86 }}>
                    <input value={a.ticker} onChange={(e) => upd(i, "ticker", e.target.value)}
                      style={{ ...input, textAlign: "left", color: C.accent, fontWeight: 600 }} />
                  </td>
                  <td style={{ ...td, textAlign: "left", width: 120 }}>
                    <input value={a.sector} onChange={(e) => upd(i, "sector", e.target.value)}
                      style={{ ...input, textAlign: "left" }} />
                  </td>
                  {["er", "vol", "beta"].map((f) => (
                    <td key={f} style={{ ...td, width: 74 }}>
                      <input type="number" step={f === "beta" ? 0.01 : 0.5} value={a[f]}
                        onChange={(e) => upd(i, f, e.target.value)} style={input} />
                    </td>
                  ))}
                  {blMode && (
                    <td style={{ ...td, width: 44 }}>
                      <input type="checkbox" checked={!!a.useView}
                        onChange={(e) => upd(i, "useView", e.target.checked)}
                        style={{ accentColor: C.blue }} />
                    </td>
                  )}
                  {blMode && (
                    <td style={{ ...td, width: 74 }}>
                      <select value={a.conf || "med"} onChange={(e) => upd(i, "conf", e.target.value)}
                        disabled={!a.useView}
                        style={{ ...input, opacity: a.useView ? 1 : 0.4 }}>
                        <option value="low">Baja</option>
                        <option value="med">Media</option>
                        <option value="high">Alta</option>
                      </select>
                    </td>
                  )}
                  {blMode && (
                    <td style={{ ...td, width: 74, color: C.blue }}>
                      {impliedShown ? (impliedShown[i] * 100).toFixed(1) : "—"}
                    </td>
                  )}
                  <td style={{ ...td, width: 74 }}>
                    <input type="number" step={0.5} value={a.w}
                      onChange={(e) => upd(i, "w", e.target.value)}
                      style={{
                        ...input,
                        borderColor: Number(a.w) > posCap * 100 + 0.01 ? C.neg : C.border,
                        color: Number(a.w) > posCap * 100 + 0.01 ? C.neg : C.text,
                      }} />
                  </td>
                  <td style={{ ...td, width: 30 }}>
                    <span className="dione-hover" onClick={() => removeAsset(i)}
                      style={{ color: C.neg, fontSize: 15, cursor: "pointer" }}>×</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="dione-hover" onClick={addAsset} style={btn}>+ Activo</button>
          <button className="dione-hover" onClick={normalize} style={{ ...btn, color: C.accent }}>
            Normalizar → 100%
          </button>
          <button className="dione-hover" onClick={() => applyWeights(maxSharpe.w)}
            style={{ ...btn, color: C.accent, borderColor: C.accent }}>
            ← Max-Sharpe
          </button>
          <button className="dione-hover" onClick={() => applyWeights(minVar.w)}
            style={{ ...btn, color: C.pos, borderColor: C.pos }}>
            ← Min-Var
          </button>
        </div>
      </Panel>

      {/* FRONTERA + PORTAFOLIOS */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 16, marginBottom: 16 }}>
        <Panel title="FRONTERA EFICIENTE — RIESGO vs RETORNO">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 14, bottom: 26, left: 2 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="2 4" />
              <XAxis type="number" dataKey="vol" name="Vol" unit="%" stroke={C.muted}
                tick={{ fontSize: 10, fill: C.muted }}
                label={{ value: "Volatilidad anual %", position: "bottom", fill: C.muted, fontSize: 10, offset: 8 }} />
              <YAxis type="number" dataKey="ret" name="Ret" unit="%" stroke={C.muted}
                tick={{ fontSize: 10, fill: C.muted }}
                label={{ value: "E[R] %", angle: -90, position: "insideLeft", fill: C.muted, fontSize: 10 }} />
              <ZAxis range={[10, 10]} />
              <Tooltip cursor={{ stroke: C.accent, strokeDasharray: "3 3" }}
                contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: mono, borderRadius: 4 }}
                formatter={(v) => v.toFixed(2) + "%"} />
              <Scatter name="Portafolios" data={cloud} fill={C.border} opacity={0.55} />
              <Scatter name="CML" data={cml} fill="transparent"
                line={{ stroke: C.accent, strokeWidth: 1, strokeDasharray: "4 4" }} shape={() => null} />
              <Scatter name="Frontera" data={frontier} fill={C.blue}
                line={{ stroke: C.blue, strokeWidth: 1.5 }} shape="circle" />
              <Scatter name="Current" data={[markCur]} fill={C.text} shape="diamond" />
              <Scatter name="Min-Var" data={[markMV]} fill={C.pos} shape="cross" />
              <Scatter name="Max-Sharpe" data={[markMS]} fill={C.accent} shape="star" />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, fontSize: 10, color: C.muted, justifyContent: "center", flexWrap: "wrap" }}>
            <span>◆ <span style={{ color: C.text }}>Current</span></span>
            <span style={{ color: C.pos }}>✛ Min-Var</span>
            <span style={{ color: C.accent }}>★ Max-Sharpe</span>
            <span style={{ color: C.blue }}>— Frontera</span>
            <span style={{ color: C.accent }}>--- CML (rf + Sharpe·σ)</span>
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["CURRENT", current, C.text],
            ["MIN-VARIANCE", minVar, C.pos],
            ["MAX-SHARPE (tangencia)", maxSharpe, C.accent],
          ].map(([name, m, col]) => {
            const tops = m.w ? topHoldings(m.w, clean, 4) : [];
            return (
              <div key={name} style={{ ...panel, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: col, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8 }}>
                  {name}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  <Stat label="E[R]" value={pct(m.ret)} color={m.ret >= 0 ? C.pos : C.neg} />
                  <Stat label="Vol" value={pct(m.vol)} />
                  <Stat label="Sharpe" value={m.sharpe.toFixed(2)}
                    color={m.sharpe >= 1 ? C.pos : m.sharpe >= 0.5 ? C.accent : C.neg} />
                  <Stat label="Beta" value={m.beta.toFixed(2)} />
                </div>
                {tops.length > 0 && (
                  <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${C.border}`,
                    display: "flex", flexWrap: "wrap", gap: 10, fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}>
                    {tops.map((t) => (
                      <span key={t.ticker}>
                        <span style={{ color: C.muted }}>{t.ticker}</span>
                        <span style={{ color: col, marginLeft: 4, fontWeight: 600 }}>{pct(t.w, 1)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* REBALANCEO */}
      <Panel title={`REBALANCEO SUGERIDO — ACTUAL → MAX-SHARPE · ${money(params.portSize)}`} style={{ marginBottom: 16 }}>
        <div style={{ overflowX: "auto", margin: -16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Activo</th>
                <th style={th}>Actual</th>
                <th style={th}>Target</th>
                <th style={th}>Δ pp</th>
                <th style={th}>Acción</th>
                <th style={{ ...th, paddingRight: 16 }}>Δ $</th>
              </tr>
            </thead>
            <tbody>
              {rebal.map((r, i) => {
                const act = Math.abs(r.dPp) < 0.5 ? "—" : r.dPp > 0 ? "COMPRAR" : "VENDER";
                const col = act === "COMPRAR" ? C.pos : act === "VENDER" ? C.neg : C.muted;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, textAlign: "left", paddingLeft: 16, color: C.accent, fontWeight: 600 }}>{r.ticker}</td>
                    <td style={td}>{pct(r.cur)}</td>
                    <td style={td}>{pct(r.tgt)}</td>
                    <td style={{ ...td, color: r.dPp > 0 ? C.pos : r.dPp < 0 ? C.neg : C.muted }}>
                      {r.dPp > 0 ? "+" : ""}{r.dPp.toFixed(1)}
                    </td>
                    <td style={{ ...td, color: col, fontWeight: 600 }}>{act}</td>
                    <td style={{ ...td, color: col, paddingRight: 16 }}>
                      {act === "—" ? "—" : (r.dUsd > 0 ? "+" : "") + money(r.dUsd)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ALERTAS */}
      <div style={{ ...panel, borderColor: flags.length ? C.neg : C.pos }}>
        {flags.length === 0 ? (
          <span style={{ fontSize: 12, color: C.pos }}>
            ✓ Portafolio dentro de las restricciones del mandato.
          </span>
        ) : (
          <>
            <div style={{ fontSize: 11, color: C.neg, letterSpacing: "0.08em", marginBottom: 8 }}>
              ⚠ ALERTAS DE MANDATO
            </div>
            {flags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: f.lvl === "bad" ? C.neg : C.accent, padding: "3px 0" }}>
                › {f.msg}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
