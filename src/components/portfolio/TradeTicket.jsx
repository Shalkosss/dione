import React, { useEffect, useMemo, useRef, useState } from "react";
import { C, mono, input, btn } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { useLedger } from "../../store/LedgerContext.jsx";
import { accountState } from "../../lib/ledger.js";
import { GICS, SECTOR_ETFS, sleeveOf, SLEEVE_RANGES } from "../../lib/sectors.js";
import { fetchSeries, daysSince } from "../../lib/priceHistory.js";
import { UNIVERSE } from "../../lib/universe.js";
import { money } from "../../lib/format.js";

// Fecha local del usuario (no UTC): en Lima, de noche, toISOString ya da el día siguiente.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const field = { ...input, textAlign: "left", padding: "7px 9px", fontSize: 12.5 };
const labelStyle = { display: "block", fontFamily: mono, fontSize: 9.5, letterSpacing: "0.09em", color: C.muted, marginBottom: 3, textTransform: "uppercase" };
const RISK_BUDGET = 0.01; // 1% de la cuenta por posición (MANDATE.md)

const knownSector = (ticker) => SECTOR_ETFS[ticker] || UNIVERSE.find((u) => u.ticker === ticker && GICS.includes(u.sector))?.sector || "";

function Field({ label, children, span = 1 }) {
  return <label style={{ gridColumn: `span ${span}`, minWidth: 0 }}><span style={labelStyle}>{label}</span>{children}</label>;
}

// Boleta de orden ficticia. Trae el cierre del día elegido como precio sugerido
// y calcula el tamaño según el presupuesto de riesgo del mandato.
export default function TradeTicket({ nav, prefill }) {
  const { account, placeOrder } = useLedger();
  const [side, setSide] = useState("BUY");
  const [ticker, setTicker] = useState("");
  const [date, setDate] = useState(today);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [sector, setSector] = useState("");
  const [stopPct, setStopPct] = useState("10");
  const [target, setTarget] = useState("");
  const [quote, setQuote] = useState(null); // { close, date } o { missing: true }
  const [message, setMessage] = useState(null);
  const symbolRef = useRef("");

  // Orden que llega desde la línea de comandos o desde el botón "vender" de una posición.
  useEffect(() => {
    if (!prefill) return;
    setSide(prefill.side || "BUY");
    setTicker(prefill.ticker || "");
    setQty(prefill.qty ? String(prefill.qty) : "");
    // Si el ticker es el mismo, la cotización no vuelve a pedirse: se conserva el precio.
    if ((prefill.ticker || "").toUpperCase() !== symbolRef.current) setPrice("");
    setMessage(null);
  }, [prefill]);

  const symbol = ticker.trim().toUpperCase();
  symbolRef.current = symbol;
  useEffect(() => setSector(knownSector(symbol)), [symbol]);

  // Cierre (sin ajustar) del día elegido, o el último disponible antes.
  useEffect(() => {
    setQuote(null);
    if (symbol.length < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchSeries(symbol, daysSince(date, 400)).then((series) => {
        if (cancelled) return;
        const hit = [...series].reverse().find((c) => c.date <= date);
        setQuote(hit ? { close: hit.rawClose ?? hit.close, date: hit.date } : { missing: true });
      });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [symbol, date]);

  useEffect(() => {
    if (quote?.close && !price) setPrice(quote.close.toFixed(2));
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = useMemo(() => accountState(account.initialCash, account.transactions), [account]);
  const held = state.positions[symbol]?.qty || 0;
  const q = Number(qty), p = Number(price);
  const amount = q > 0 && p > 0 ? q * p : 0;
  const weight = nav > 0 ? amount / nav : 0;
  const stop = Number(stopPct) / 100;
  const suggested = p > 0 && stop > 0 ? Math.floor(((nav * RISK_BUDGET) / stop / p) * 1000) / 1000 : null;
  const sleeve = symbol ? SLEEVE_RANGES[sleeveOf(symbol)]?.label : null;

  function submit(e) {
    e.preventDefault();
    // En compras se guardan el stop (precio) y el take profit para el seguimiento.
    const levels = side === "BUY"
      ? { ...(stop > 0 && p > 0 ? { stop: +(p * (1 - stop)).toFixed(4) } : {}), ...(Number(target) > p ? { target: Number(target) } : {}) }
      : {};
    if (side === "BUY" && target && !(Number(target) > p)) { setMessage({ ok: false, text: "El take profit tiene que quedar sobre el precio de compra" }); return; }
    const result = placeOrder({ side, ticker: symbol, date, qty: q, price: p, sector: sector || null, ...levels });
    if (!result.ok) { setMessage({ ok: false, text: result.errors.join(" · ") }); return; }
    setMessage({ ok: true, text: `${side === "BUY" ? "Compra" : "Venta"} registrada: ${q} ${symbol} a ${p.toFixed(2)}` });
    setQty("");
    setTarget("");
  }

  const isBuy = side === "BUY";
  return (
    <Panel title="Boleta de orden" right="ficticia · no envía nada a un bróker">
      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[["BUY", "COMPRAR", C.pos], ["SELL", "VENDER", C.neg]].map(([key, text, color]) => (
            <button key={key} type="button" onClick={() => setSide(key)} style={{ ...btn, padding: "8px 0", fontWeight: 700, letterSpacing: "0.1em", background: side === key ? color : C.panel2, color: side === key ? "#04120a" : C.muted, borderColor: side === key ? color : C.border }}>
              {text}
            </button>
          ))}
        </div>

        <Field label="Ticker">
          <input value={ticker} onChange={(e) => { setTicker(e.target.value); setPrice(""); }} placeholder="NVDA" spellCheck={false} style={{ ...field, textTransform: "uppercase", fontWeight: 600 }} />
        </Field>
        <Field label="Fecha de la operación">
          <input type="date" value={date} max={today()} onChange={(e) => { setDate(e.target.value); setPrice(""); }} style={field} />
        </Field>
        <Field label={`Cantidad${held ? ` · tenés ${held}` : ""}`}>
          <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" style={field} />
        </Field>
        <Field label="Precio">
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={quote?.missing ? "sin dato" : "…"} style={field} />
        </Field>

        <div style={{ gridColumn: "span 2", fontFamily: mono, fontSize: 10.5, color: C.muted, marginTop: -4 }}>
          {quote?.close && `Cierre de ${symbol} el ${quote.date}: ${quote.close.toFixed(2)}`}
          {quote?.missing && <span style={{ color: C.amber }}>Yahoo no devolvió precios para {symbol}. Podés escribir el precio a mano.</span>}
          {!quote && symbol && "buscando precio…"}
        </div>

        {isBuy && (
          <>
            <Field label="Sector">
              <select value={sector} onChange={(e) => setSector(e.target.value)} style={field}>
                <option value="">Sin clasificar</option>
                {GICS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Stop previsto (% bajo la entrada)">
              <input type="number" min="1" max="50" step="0.5" value={stopPct} onChange={(e) => setStopPct(e.target.value)} style={field} />
            </Field>
            <Field label={`Take profit (precio)${Number(target) > p && p > 0 ? ` · +${((Number(target) / p - 1) * 100).toFixed(1)}%` : ""}`}>
              <input type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="opcional" style={field} />
            </Field>
            <div style={{ gridColumn: "span 1", alignSelf: "end", fontFamily: mono, fontSize: 10.5, color: C.muted, paddingBottom: 8 }}>
              {p > 0 && stop > 0 ? `stop en ${(p * (1 - stop)).toFixed(2)}` : ""}
              {p > 0 && stop > 0 && Number(target) > p ? ` · R:R ${((Number(target) - p) / (p * stop)).toFixed(1)}` : ""}
            </div>
            <div style={{ gridColumn: "span 2", background: C.panel2, border: `1px solid ${C.border}`, padding: "8px 10px", fontSize: 11.5, color: C.muted }}>
              Tamaño por riesgo (1% de la cuenta ÷ stop):{" "}
              {suggested ? (
                <button type="button" onClick={() => setQty(String(suggested))} style={{ ...btn, padding: "2px 8px", color: C.accent, borderColor: C.accent, background: "transparent" }}>
                  {suggested} acc. · {money(suggested * p)}
                </button>
              ) : "indicá ticker y stop"}
              {sleeve && <span> · tramo: <b style={{ color: C.text }}>{sleeve}</b></span>}
            </div>
          </>
        )}

        <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontFamily: mono, fontSize: 11.5 }}>
          <span style={{ color: C.muted }}>
            Monto <b style={{ color: C.text }}>{money(amount)}</b> · {(weight * 100).toFixed(1)}% de la cuenta · caja {money(state.cash)}
          </span>
          <button type="submit" disabled={!symbol || !(q > 0) || !(p > 0)} style={{ ...btn, padding: "8px 16px", fontWeight: 700, background: isBuy ? C.pos : C.neg, borderColor: isBuy ? C.pos : C.neg, color: "#04120a" }}>
            {isBuy ? "COMPRAR" : "VENDER"} {symbol}
          </button>
        </div>

        {message && (
          <div style={{ gridColumn: "span 2", fontSize: 11.5, padding: "7px 10px", border: `1px solid ${message.ok ? C.pos : C.neg}`, background: message.ok ? C.posSoft : C.negSoft, color: message.ok ? C.pos : C.neg }}>
            {message.text}
          </div>
        )}
      </form>
    </Panel>
  );
}
