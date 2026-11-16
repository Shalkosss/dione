import React, { useEffect, useState } from "react";
import { C, btn, input } from "../../theme.js";
import { Panel, Stat } from "../Panel.jsx";
import ThesisChart from "./ThesisChart.jsx";
import { StatusBadge, FLAG_LABEL, pctSigned, signColor, price } from "./ThesisTable.jsx";
import { fetchThesis, patchThesis, loadToken } from "../../lib/thesisApi.js";
import { LIVE_STATUSES, POST_MORTEM_STATUSES, closeTarget } from "../../lib/thesisView.js";

const field = { ...input, textAlign: "left", padding: "6px 8px" };
const today = () => new Date().toISOString().slice(0, 10);

function Horizon({ label, h }) {
  return <Stat label={label} value={pctSigned(h?.alpha_spy)} color={signColor(h?.alpha_spy)} />;
}

// Acciones que reenvían el bloque con un cambio: post-mortem, revisión, cierre manual.
function Actions({ thesis, onChanged }) {
  const [postMortem, setPostMortem] = useState(thesis.post_mortem || "");
  const [closePrice, setClosePrice] = useState("");
  const [reason, setReason] = useState("TESIS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const token = loadToken();
  const live = LIVE_STATUSES.includes(thesis.status);

  async function send(changes) {
    setBusy(true);
    setError(null);
    try {
      await patchThesis(thesis, changes, token);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (!token) {
    return <div style={{ fontSize: 11, color: C.muted }}>Para editar, cargá el token de escritura en "Importar JSON".</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {POST_MORTEM_STATUSES.includes(thesis.status) && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <textarea
            value={postMortem}
            onChange={(e) => setPostMortem(e.target.value)}
            placeholder="Post-mortem: qué supuesto falló, si era detectable al emitir, qué cambia en el sistema"
            style={{ ...field, height: 64, resize: "vertical" }}
          />
          <button className="dione-hover" disabled={busy || !postMortem.trim()} onClick={() => send({ post_mortem: postMortem.trim() })} style={btn}>
            Guardar
          </button>
        </div>
      )}
      {live && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="dione-hover" disabled={busy} onClick={() => send({ reviewed_at: today() })} style={btn}>
            Marcar revisada hoy
          </button>
          {thesis.status === "ABIERTA" && (
            <>
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>CIERRE MANUAL</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...field, width: 150 }}>
                <option value="TESIS">Tesis invalidada</option>
                <option value="TIEMPO">Salida por tiempo</option>
              </select>
              <input type="number" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} placeholder="Precio" style={{ ...field, width: 100 }} />
              <button
                className="dione-hover"
                disabled={busy || !(Number(closePrice) > 0)}
                onClick={() => send({ manual_close: { date: today(), price: Number(closePrice), reason } })}
                style={{ ...btn, color: C.neg, borderColor: C.neg }}
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: C.neg }}>{error}</div>}
    </div>
  );
}

// Detalle de una tesis: gráfico con niveles, alfa por horizonte, banderas y acciones.
export default function ThesisDetail({ id, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetchThesis(id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id]);

  if (error) return <Panel title={id} style={{ marginBottom: 16 }}><span style={{ fontSize: 11, color: C.neg }}>{error}</span></Panel>;
  if (!data) return <Panel title={id} style={{ marginBottom: 16 }}><span style={{ fontSize: 11, color: C.muted }}>Cargando…</span></Panel>;

  const { thesis, marks } = data;
  const perf = thesis.perf || {};
  return (
    <Panel
      title={`${thesis.id} · ${thesis.rating}${thesis.conviction ? ` · CONVICCIÓN ${thesis.conviction}` : ""}`}
      right={<StatusBadge status={thesis.status} />}
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12, marginBottom: 12 }}>
        <Stat label="REF. EMISIÓN" value={price(thesis.ref_price)} />
        <Stat label={thesis.order_type === "LIMIT" ? "LIMIT" : "ENTRADA"} value={price(thesis.entry)} color={C.accent} />
        <Stat label="STOP" value={price(thesis.stop)} color={C.neg} />
        <Stat label="OBJETIVO" value={price(closeTarget(thesis))} color={C.pos} />
        <Stat label="EJECUCIÓN" value={thesis.filled_at ? `${price(thesis.fill_price)}` : "—"} />
        <Stat label="RESULTADO" value={thesis.r_multiple == null ? "—" : `${thesis.r_multiple >= 0 ? "+" : ""}${Number(thesis.r_multiple).toFixed(2)}R`} color={signColor(thesis.r_multiple)} />
        <Horizon label="ALFA SPY 20S" h={perf.h20} />
        <Horizon label="ALFA SPY 60S" h={perf.h60} />
        <Horizon label="ALFA SPY 120S" h={perf.h120} />
      </div>

      <ThesisChart thesis={thesis} marks={marks} />

      <div style={{ fontSize: 11.5, lineHeight: 1.7, margin: "12px 0", color: C.muted }}>
        {thesis.thesis_text && <div><span style={{ color: C.text }}>Tesis: </span>{thesis.thesis_text}</div>}
        {thesis.invalidation && <div><span style={{ color: C.text }}>Invalidación: </span>{thesis.invalidation}</div>}
        {thesis.closed_at && <div><span style={{ color: C.text }}>Cierre: </span>{thesis.closed_at} a {price(thesis.close_price)} ({thesis.close_reason})</div>}
        {thesis.post_mortem && <div><span style={{ color: C.text }}>Post-mortem: </span>{thesis.post_mortem}</div>}
        {(thesis.flags || []).map((f) => (
          <div key={f.code} style={{ color: C.accent }}>
            ⚑ REVISAR · {FLAG_LABEL[f.code] || f.code} desde {f.since}: {f.detail}
          </div>
        ))}
      </div>

      <Actions key={thesis.id} thesis={thesis} onChanged={onChanged} />
    </Panel>
  );
}
