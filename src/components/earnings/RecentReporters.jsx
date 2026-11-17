import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C, mono } from "../../theme.js";
import { Panel } from "../Panel.jsx";

const TIMING = { ANTES_APERTURA: "antes de abrir", EN_SESION: "en sesión", DESPUES_CIERRE: "tras el cierre", DESCONOCIDO: "—" };
const signed = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const tone = (v) => (v == null ? C.muted : v >= 0 ? C.pos : C.neg);
const cap = (v) => (v == null ? "—" : v >= 1e12 ? `${(v / 1e12).toFixed(1)}T` : v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : `${(v / 1e6).toFixed(0)}M`);

// Empresas del universo del Scan que publicaron resultados en las últimas 5
// sesiones (8-K ítem 2.02), con la reacción del precio. Lo arma el cron diario.
export default function RecentReporters() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events?recent=1")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setState(j.success ? { data: j.data, meta: j.meta } : { error: j.error }); })
      .catch(() => { if (!cancelled) setState({ error: "El barrido de eventos solo está disponible en la web publicada." }); });
    return () => { cancelled = true; };
  }, []);

  const right = state.meta ? `desde ${state.meta.since} · ${state.meta.total} de ${state.meta.universe} empresas${state.meta.incomplete ? " · barrido incompleto" : ""}` : null;

  return (
    <Panel title="Reportaron en las últimas 5 sesiones" right={right}>
      {state.loading && <div style={{ fontFamily: mono, fontSize: 11.5, color: C.muted }}>leyendo el barrido de EDGAR…</div>}
      {state.error && <div style={{ fontSize: 12, color: C.muted }}>{state.error}</div>}
      {state.data && !state.data.length && <div style={{ fontSize: 12, color: C.muted }}>Ninguna empresa del universo reportó en la ventana.</div>}
      {state.data?.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640, display: "grid", gap: 3, fontFamily: mono, fontSize: 11.5 }}>
            {state.data.map((e) => (
              <div key={`${e.ticker}-${e.nyDate}`} style={{ display: "grid", gridTemplateColumns: "70px 1fr 150px 70px 80px 80px", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                <Link to={`/chart?t=${e.ticker}`} style={{ color: C.accent, fontWeight: 700 }}>{e.ticker}</Link>
                <span style={{ color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.gicsSector || ""}>{e.name || "—"}</span>
                <span style={{ color: C.muted }}>{e.nyDate} · {TIMING[e.timing]}</span>
                <span style={{ color: C.muted, textAlign: "right" }}>{cap(e.marketCap)}</span>
                <b style={{ color: tone(e.reaction), textAlign: "right" }}>{signed(e.reaction)}</b>
                <span style={{ color: tone(e.drift5), textAlign: "right" }} title="Deriva 5 sesiones después">{signed(e.drift5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
