import React, { useState } from "react";
import { C, mono, input, btn } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { useLedger } from "../../store/LedgerContext.jsx";
import { parseWeights, formatWeights } from "../../lib/ledger.js";

const field = { ...input, textAlign: "left", padding: "6px 8px", fontSize: 12 };
const COLORS = ["#d98a5f", "#b08cff", "#f472b6", "#facc15", "#34d399"];

function BenchmarkForm({ bench, onSave, onRemove }) {
  const [name, setName] = useState(bench.name);
  const [startDate, setStartDate] = useState(bench.startDate);
  const [text, setText] = useState(formatWeights(bench.weights));
  const [saved, setSaved] = useState(false);

  const weights = parseWeights(text);
  const total = Object.values(weights).reduce((s, w) => s + w, 0);

  function save() {
    onSave({ ...bench, name: name.trim() || bench.name, startDate, weights });
    setSaved(true);
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${bench.color}`, padding: 10, display: "grid", gap: 7, minWidth: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 132px", gap: 7 }}>
        <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} aria-label="Nombre de la cartera" style={{ ...field, fontWeight: 600 }} />
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSaved(false); }} aria-label="Fecha de inicio" style={field} />
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        placeholder={"Una posición por línea:\nNVDA 25\nMSFT 20\nAMZN 15"}
        spellCheck={false}
        style={{ ...field, height: 96, resize: "vertical", fontFamily: mono, lineHeight: 1.5 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 10.5, color: C.muted }}>
        <span>
          {Object.keys(weights).length} posiciones · <span style={{ color: total > 1.001 ? C.amber : C.muted }}>{(total * 100).toFixed(1)}%</span>
          {total > 1.001 ? " (se normaliza a 100%)" : total < 0.999 && total > 0 ? " (el resto es caja)" : ""}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onRemove(bench.id)} style={{ ...btn, padding: "3px 8px", background: "transparent", color: C.muted }}>QUITAR</button>
          <button onClick={save} style={{ ...btn, padding: "3px 10px", color: saved ? C.pos : C.accent, borderColor: saved ? C.pos : C.accent, background: "transparent" }}>{saved ? "GUARDADO" : "GUARDAR"}</button>
        </span>
      </div>
    </div>
  );
}

// Carteras de referencia (por ejemplo las que publican Claude o Grok). La web no
// tiene una fuente automática para ellas: se cargan a mano y acá se valoran
// como compra y mantener desde la fecha de inicio.
export default function BenchmarkEditor() {
  const { benchmarks, saveBenchmark, removeBenchmark } = useLedger();

  function add() {
    const id = `ref-${Date.now()}`;
    saveBenchmark({ id, name: "Nueva cartera", color: COLORS[benchmarks.length % COLORS.length], startDate: new Date().toISOString().slice(0, 10), weights: {} });
  }

  return (
    <Panel title="Carteras de referencia" right={<button onClick={add} style={{ ...btn, padding: "2px 9px", fontSize: 10 }}>+ AGREGAR</button>}>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
        Cargá las posiciones y pesos de cada cartera que quieras seguir. Se comparan contra la tuya desde la fecha de inicio, como compra y mantener.
        El S&P 500 ya viene incluido.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
        {benchmarks.map((b) => <BenchmarkForm key={b.id} bench={b} onSave={saveBenchmark} onRemove={removeBenchmark} />)}
      </div>
    </Panel>
  );
}
