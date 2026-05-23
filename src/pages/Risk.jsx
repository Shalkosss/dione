import React, { useMemo } from "react";
import { usePortfolio } from "../store/PortfolioContext.jsx";
import { C, panel, th, td } from "../theme.js";
import { Panel, Stat } from "../components/Panel.jsx";
import { pct, money } from "../lib/format.js";
import {
  buildCovariance, portVariance, portBeta,
  riskMetrics, riskDecomposition, stressTest,
  varianceSplit, concentration,
} from "../lib/finance.js";

export default function Risk() {
  const { assets, params } = usePortfolio();
  const posCap = 0.15;
  const sectorCap = 0.35;

  const eng = useMemo(() => {
    const clean = assets.map((a) => ({
      ticker: String(a.ticker || "?"),
      sector: String(a.sector || "—"),
      er: Number(a.er) || 0,
      vol: Number(a.vol) || 0,
      beta: Number(a.beta) || 0,
      w: Number(a.w) || 0,
    }));
    const marketVar = Math.pow(params.mktVol / 100, 2);
    const cov = buildCovariance(clean, marketVar);
    const wsum = clean.reduce((s, a) => s + a.w, 0) || 1;
    const w = clean.map((a) => a.w / wsum);

    const variance = portVariance(w, cov);
    const annualVol = Math.sqrt(variance);
    const beta = portBeta(w, clean);

    return {
      clean, w, annualVol, beta,
      risk: riskMetrics(annualVol, params.portSize),
      decomp: riskDecomposition(w, cov, clean),
      stress: stressTest(beta, params.portSize),
      vsplit: varianceSplit(w, cov, clean, marketVar),
      conc: concentration(w, clean),
    };
  }, [assets, params]);

  const { clean, w, annualVol, beta, risk, decomp, stress, vsplit, conc } = eng;

  // sector exposure
  const sectorMap = {};
  clean.forEach((a, i) => {
    sectorMap[a.sector] = (sectorMap[a.sector] || 0) + w[i];
  });
  const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);

  const sharpeRatio =
    annualVol > 1e-9
      ? (clean.reduce((s, a, i) => s + w[i] * (a.er / 100), 0) - params.rf / 100) / annualVol
      : 0;

  return (
    <div>
      {/* TOP METRICS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["VOL ANUAL", pct(annualVol), C.text],
          ["BETA vs MERCADO", beta.toFixed(2), beta > 1.2 ? C.neg : C.text],
          ["SHARPE (E[R] inputs)", sharpeRatio.toFixed(2), sharpeRatio >= 1 ? C.pos : C.accent],
          ["POSICIONES EFECTIVAS", conc.effectiveN.toFixed(2), conc.effectiveN < 3 ? C.neg : C.text],
        ].map(([l, v, c]) => (
          <div key={l} style={{ ...panel, padding: "12px 14px" }}>
            <Stat label={l} value={v} color={c} />
          </div>
        ))}
      </div>

      {/* VaR + STRESS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title={`VALUE-AT-RISK · EXPECTED SHORTFALL · ${money(params.portSize)}`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["VaR 95% — 1 día", risk.var95_1d],
                ["VaR 99% — 1 día", risk.var99_1d],
                ["VaR 95% — anual", risk.var95_annual],
                ["Expected Shortfall 95% — 1d", risk.es95_1d],
                ["Expected Shortfall 99% — 1d", risk.es99_1d],
              ].map(([l, v], i) => (
                <tr key={i} style={{ borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                  <td style={{ ...td, textAlign: "left", color: C.muted }}>{l}</td>
                  <td style={{ ...td, color: C.neg, fontSize: 13.5 }}>−{money(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
            VaR/ES paramétricos (distribución normal). El VaR 95% 1d es la pérdida que se
            supera ~1 día de cada 20. ES = pérdida media en la cola más allá del VaR.
          </div>
        </Panel>

        <Panel title="STRESS TESTS — ESCENARIOS HISTÓRICOS">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...th, textAlign: "left" }}>Escenario</th>
                <th style={th}>Impacto %</th>
                <th style={th}>Impacto $</th>
              </tr>
            </thead>
            <tbody>
              {stress.map((s, i) => (
                <tr key={i} style={{ borderBottom: i < stress.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <td style={{ ...td, textAlign: "left", color: C.text, fontSize: 11.5 }}>{s.name}</td>
                  <td style={{ ...td, color: C.neg }}>{(s.impactPct * 100).toFixed(1)}%</td>
                  <td style={{ ...td, color: C.neg }}>−{money(Math.abs(s.impactUsd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
            Aproximación por beta: impacto ≈ β × shock de mercado. No modela el riesgo
            idiosincrático — el golpe real puede ser mayor o menor según el activo.
          </div>
        </Panel>
      </div>

      {/* FACTOR SPLIT */}
      <Panel title="DESCOMPOSICIÓN DE VARIANZA — SISTEMÁTICA vs IDIOSINCRÁTICA" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, height: 26, display: "flex", borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div style={{ width: `${vsplit.systematicPct * 100}%`, background: C.blue }} />
            <div style={{ width: `${vsplit.idiosyncraticPct * 100}%`, background: C.accent }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 10, fontSize: 12 }}>
          <span style={{ color: C.blue }}>■ Sistemática (mercado): <b>{pct(vsplit.systematicPct)}</b></span>
          <span style={{ color: C.accent }}>■ Idiosincrática (diversificable): <b>{pct(vsplit.idiosyncraticPct)}</b></span>
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
          Idiosincrática alta = riesgo que podés reducir diversificando. Sistemática = riesgo de mercado, solo se reduce bajando beta.
        </div>
      </Panel>

      {/* RISK DECOMPOSITION */}
      <Panel title="CONTRIBUCIÓN MARGINAL AL RIESGO POR POSICIÓN" style={{ marginBottom: 16 }}>
        <div style={{ overflowX: "auto", margin: -16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Activo</th>
                <th style={th}>Peso</th>
                <th style={th}>MCR</th>
                <th style={th}>Contrib.</th>
                <th style={{ ...th, textAlign: "left", width: 180 }}>% del Riesgo Total</th>
              </tr>
            </thead>
            <tbody>
              {decomp.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 16, color: C.accent, fontWeight: 600 }}>{r.ticker}</td>
                  <td style={td}>{pct(r.weight)}</td>
                  <td style={td}>{(r.mcr * 100).toFixed(2)}</td>
                  <td style={td}>{pct(r.comp)}</td>
                  <td style={{ ...td, textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ height: 8, width: `${Math.max(0, Math.min(100, r.pctRisk * 100)) * 1.3}px`,
                        background: r.pctRisk > 0.4 ? C.neg : r.pctRisk > 0.25 ? C.accent : C.blue, borderRadius: 2 }} />
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct(r.pctRisk)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 14, fontSize: 11, color: C.muted, flexWrap: "wrap" }}>
          <span>Diversification Ratio: <b style={{ color: C.text }}>{(conc.weightedVol / Math.max(annualVol, 1e-9)).toFixed(2)}</b></span>
          <span>Concentración Top-3: <b style={{ color: conc.top3 > 0.6 ? C.neg : C.text }}>{pct(conc.top3)}</b></span>
          <span>Concentración Top-5: <b style={{ color: C.text }}>{pct(conc.top5)}</b></span>
        </div>
      </Panel>

      {/* SECTOR EXPOSURE */}
      <Panel title="EXPOSICIÓN SECTORIAL">
        {sectors.map(([s, weight], i) => {
          const over = s !== "Cash" && s !== "Gold" && weight > sectorCap;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
              <div style={{ width: 110, fontSize: 12, color: C.text }}>{s}</div>
              <div style={{ flex: 1, height: 10, background: C.panel2, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${weight * 100}%`, background: over ? C.neg : C.blue }} />
              </div>
              <div style={{ width: 54, textAlign: "right", fontSize: 12, color: over ? C.neg : C.text, fontVariantNumeric: "tabular-nums" }}>
                {pct(weight)}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>
          Cap de mandato: 35% por sector GICS. En rojo lo que excede.
        </div>
      </Panel>
    </div>
  );
}
