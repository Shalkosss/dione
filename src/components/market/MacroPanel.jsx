import React, { useEffect, useState } from "react";
import { C, btn, input, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { loadToken } from "../../lib/thesisApi.js";
import { putMacro } from "../../lib/ledgerApi.js";

// Vista de /macro: qué sectores sobrepondera el research. El tracker la usa
// para la bandera SECTOR (regla 3 de vigencia) en las tesis emitidas con el
// sector sobreponderado. Se guarda con el mismo token del libro de órdenes.

const SECTORS = [
  "Communication Services", "Consumer Discretionary", "Consumer Staples", "Energy", "Financials", "Health Care",
  "Industrials", "Information Technology", "Materials", "Real Estate", "Utilities",
];
const VIEWS = [
  { key: "OW", label: "Sobre", tone: () => C.pos },
  { key: "N", label: "Neutral", tone: () => C.muted },
  { key: "UW", label: "Bajo", tone: () => C.neg },
];
const today = () => new Date().toISOString().slice(0, 10);

function fromView(view) {
  return Object.fromEntries(SECTORS.map((s) => [s, view?.overweight?.includes(s) ? "OW" : view?.underweight?.includes(s) ? "UW" : "N"]));
}

export default function MacroPanel() {
  const [saved, setSaved] = useState(null);
  const [choice, setChoice] = useState(fromView(null));
  const [asOf, setAsOf] = useState(today());
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sectors")
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.macroView) return;
        setSaved(j.macroView);
        setChoice(fromView(j.macroView));
        setAsOf(j.macroView.asOf || today());
      })
      .catch(() => { /* en local /api/sectors no corre: se arranca vacío */ });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    const token = loadToken();
    if (!token) {
      setStatus({ tone: C.amber, text: "Falta el token: cargalo en la barra de sincronización del Portafolio." });
      return;
    }
    const view = {
      overweight: SECTORS.filter((s) => choice[s] === "OW"),
      underweight: SECTORS.filter((s) => choice[s] === "UW"),
      asOf,
    };
    setStatus({ tone: C.muted, text: "guardando…" });
    try {
      const data = await putMacro(view, token);
      setSaved(data.macro);
      setStatus({ tone: C.pos, text: "Guardada. El tracker la usa desde la corrida de las 22:00 UTC." });
    } catch (e) {
      setStatus({ tone: C.neg, text: e.details?.errors?.join(" · ") || e.message });
    }
  };

  return (
    <Panel title="Vista sectorial de /macro" right={saved ? `vigente desde ${saved.asOf}` : "sin cargar"} style={{ marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "6px 18px" }}>
        {SECTORS.map((s) => (
          <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.text }}>{s}</span>
            <span style={{ display: "inline-flex", gap: 2 }}>
              {VIEWS.map((v) => {
                const active = choice[s] === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setChoice({ ...choice, [s]: v.key })}
                    style={{ ...btn, padding: "2px 8px", fontSize: 10.5, fontFamily: mono, color: active ? v.tone() : C.muted, borderColor: active ? v.tone() : C.border }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>fecha de la vista</span>
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...input, width: 140 }} />
        <button className="dione-hover" onClick={save} style={{ ...btn, color: C.accent, borderColor: C.accent }}>Guardar vista</button>
        {status && <span style={{ fontSize: 11.5, color: status.tone }}>{status.text}</span>}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Una tesis emitida con su sector sobreponderado (sector_view "OW") se marca para revisar si el sector sale de esta
        lista. Una vista de más de 60 días deja de usarse.
      </div>
    </Panel>
  );
}
