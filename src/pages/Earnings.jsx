import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { C, mono, panel, input, btn } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { EmptyState } from "../components/ui.jsx";
import { useLedger } from "../store/LedgerContext.jsx";
import { accountState } from "../lib/ledger.js";
import { fetchMany } from "../lib/priceHistory.js";
import { fetchTheses } from "../lib/thesisApi.js";
import { earningsReaction, parseTickers } from "../../lib/earningsEvents.js";
import { sleeveOf } from "../lib/sectors.js";

const WATCH_KEY = "dione:earnings:watch";
const TIMING = { ANTES_APERTURA: "antes de abrir", EN_SESION: "en sesión", DESPUES_CIERRE: "tras el cierre", DESCONOCIDO: "hora desconocida" };
const signed = (v, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
const tone = (v) => (v == null ? C.muted : v >= 0 ? C.pos : C.neg);

function readWatch() {
  try { return parseTickers(localStorage.getItem(WATCH_KEY) || ""); } catch { return []; }
}

function heat(v) {
  if (v == null) return C.panel2;
  const strength = Math.min(1, Math.abs(v) / 0.12);
  return `color-mix(in srgb, ${v >= 0 ? C.pos : C.neg} ${Math.round(10 + strength * 40)}%, transparent)`;
}

// Próximo reporte estimado: el último más un trimestre (91 días). Es una estimación.
function estimateNext(lastDate) {
  const next = new Date(Date.parse(`${lastDate}T00:00:00Z`) + 91 * 86400000);
  return next.toISOString().slice(0, 10);
}

function Card({ item }) {
  const [latest, ...older] = item.events;
  return (
    <div className="dione-panel" style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `2px solid ${latest ? tone(latest.reaction) : C.borderStrong}`, padding: 12, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <Link to={`/chart?t=${item.ticker}`} style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: C.accent }}>{item.ticker}</Link>
        <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.08em", color: C.muted }}>{item.sources.join(" · ")}</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 8 }}>{item.name || "—"}</div>

      {!latest ? (
        <div style={{ fontSize: 11.5, color: C.amber }}>{item.note || "Sin publicaciones de resultados"}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: mono, fontSize: 26, fontWeight: 600, color: tone(latest.reaction), lineHeight: 1.1 }}>{signed(latest.reaction)}</span>
            <span style={{ fontSize: 11, color: C.muted }}>reacción el {latest.sessionDate || latest.nyDate}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, margin: "3px 0 9px" }}>
            publicado {latest.nyDate} · {TIMING[latest.timing]}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, fontFamily: mono, fontSize: 11, marginBottom: 9 }}>
            <span style={{ background: C.panel2, padding: "4px 7px" }}>+5 ses. <b style={{ color: tone(latest.drift5) }}>{signed(latest.drift5)}</b></span>
            <span style={{ background: C.panel2, padding: "4px 7px" }}>+20 ses. <b style={{ color: tone(latest.drift20) }}>{signed(latest.drift20)}</b></span>
          </div>
          <div style={{ display: "flex", gap: 3 }} title="Reacciones anteriores, de la más reciente a la más vieja">
            {older.slice(0, 7).map((e) => (
              <span key={e.nyDate} title={`${e.nyDate}: ${signed(e.reaction)}`} style={{ flex: 1, background: heat(e.reaction), fontFamily: mono, fontSize: 9.5, textAlign: "center", padding: "3px 0", color: C.text }}>
                {e.reaction == null ? "·" : `${e.reaction >= 0 ? "+" : ""}${(e.reaction * 100).toFixed(0)}`}
              </span>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted, marginTop: 8 }}>próximo estimado: {estimateNext(latest.nyDate)}</div>
        </>
      )}
    </div>
  );
}

// Módulo 5: resultados trimestrales y cómo reaccionó el precio. Sigue los
// tickers de la cartera, de las tesis y los que agregues a mano. Las fechas
// salen de SEC EDGAR (gratis) y la reacción, de las velas de Yahoo.
export default function Earnings() {
  const { account } = useLedger();
  const [watch, setWatch] = useState(readWatch);
  const [draft, setDraft] = useState("");
  const [thesisTickers, setThesisTickers] = useState([]);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTheses().then((list) => setThesisTickers([...new Set(list.map((t) => t.ticker))])).catch(() => setThesisTickers([]));
  }, []);

  useEffect(() => {
    try { localStorage.setItem(WATCH_KEY, watch.join(",")); } catch { /* no se recuerda la lista */ }
  }, [watch]);

  const held = useMemo(() => Object.keys(accountState(account.initialCash, account.transactions).positions).filter((t) => sleeveOf(t) === "SATELITE"), [account]);

  const sources = useMemo(() => {
    const map = new Map();
    const add = (list, tag) => list.forEach((t) => map.set(t, [...(map.get(t) || []), tag]));
    add(held, "CARTERA"); add(thesisTickers, "TESIS"); add(watch, "LISTA");
    return map;
  }, [held, thesisTickers, watch]);

  const tickersKey = [...sources.keys()].sort().join(",");

  useEffect(() => {
    if (!tickersKey) { setItems([]); return undefined; }
    let cancelled = false;
    setItems(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/events?tickers=${encodeURIComponent(tickersKey)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "El servicio de eventos falló");
        const prices = await fetchMany(json.data.filter((d) => d.events.length).map((d) => d.ticker), 800);
        if (cancelled) return;
        setItems(json.data.map((d) => ({
          ...d,
          events: d.events.map((e) => ({ ...e, ...earningsReaction(e, prices[d.ticker] || []) })),
        })));
      } catch (e) {
        if (!cancelled) setError(`No se pudieron traer las fechas de resultados: ${e.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [tickersKey]);

  const cards = useMemo(() => (items || [])
    .map((d) => ({ ...d, sources: sources.get(d.ticker) || [] }))
    .sort((a, b) => ((b.events[0]?.nyDate || "") > (a.events[0]?.nyDate || "") ? 1 : -1)), [items, sources]);

  const reactions = cards.flatMap((c) => (c.events[0]?.reaction != null ? [c.events[0].reaction] : []));
  const avg = reactions.length ? reactions.reduce((s, r) => s + r, 0) / reactions.length : null;
  const positive = reactions.filter((r) => r > 0).length;

  function addTickers(e) {
    e.preventDefault();
    const added = parseTickers(draft);
    if (added.length) setWatch((w) => [...new Set([...w, ...added])]);
    setDraft("");
  }

  return (
    <div>
      <div style={{ ...panel, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <form onSubmit={addTickers} style={{ display: "flex", gap: 6 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="agregar: DUOL, MU, AMZN" spellCheck={false} style={{ ...input, textAlign: "left", width: 230, padding: "7px 9px", textTransform: "uppercase" }} />
          <button type="submit" disabled={!draft.trim()} style={btn}>SEGUIR</button>
        </form>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
          {watch.map((t) => (
            <button key={t} onClick={() => setWatch((w) => w.filter((x) => x !== t))} title="Quitar de la lista" style={{ ...btn, padding: "3px 8px", fontSize: 10.5 }}>{t} ×</button>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.muted }}>
          último reporte: <b style={{ color: tone(avg) }}>{signed(avg)}</b> promedio · {positive} de {reactions.length} al alza
        </div>
      </div>

      {error && <div style={{ ...panel, borderColor: C.neg, color: C.neg, marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {!tickersKey ? (
        <Panel title="Earnings">
          <EmptyState title="No hay tickers para seguir">
            Aparecen solos los de tu cartera y los de tus tesis. También podés agregar cualquiera arriba.
          </EmptyState>
        </Panel>
      ) : items == null && !error ? (
        <div style={{ ...panel, color: C.muted, fontFamily: mono, fontSize: 11.5 }}>consultando SEC EDGAR y precios…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
          {cards.map((item) => <Card key={item.ticker} item={item} />)}
        </div>
      )}

      <div style={{ fontSize: 11, color: C.muted, marginTop: 12, maxWidth: 900 }}>
        La fecha es la del 8-K con ítem 2.02 en SEC EDGAR. La reacción compara el cierre anterior con el cierre de la primera sesión posterior a la publicación.
        “+5” y “+20 sesiones” miden la deriva desde ese cierre. Los emisores extranjeros (como NU) presentan 6-K sin ítems y EDGAR no permite identificar su fecha.
        El próximo reporte es una estimación de 91 días, no una fecha confirmada.
      </div>
    </div>
  );
}
