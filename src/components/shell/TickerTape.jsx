import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { C, mono } from "../../theme.js";
import { fetchMany } from "../../lib/priceHistory.js";

const TAPE = [
  ["SPY", "S&P 500"], ["QQQ", "Nasdaq 100"], ["IWM", "Russell 2000"], ["^VIX", "VIX"],
  ["XLK", "Tecnología"], ["XLF", "Financieras"], ["XLV", "Salud"], ["XLY", "Cons. discrecional"], ["XLC", "Comunicación"],
  ["XLI", "Industriales"], ["XLP", "Cons. básico"], ["XLE", "Energía"], ["XLU", "Utilities"], ["XLRE", "Inmobiliario"], ["XLB", "Materiales"],
];

function toQuote([ticker, name], series) {
  if (!series || series.length < 2) return null;
  // Para la cinta se usa el cierre sin ajustar: es el precio que se ve en pantalla.
  const last = series[series.length - 1].rawClose ?? series[series.length - 1].close;
  const prev = series[series.length - 2].rawClose ?? series[series.length - 2].close;
  return { ticker, name, last, change: prev > 0 ? last / prev - 1 : 0 };
}

// Cinta de precios: índices, VIX y los 11 sectores. Se detiene al pasar el mouse.
export default function TickerTape() {
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchMany(TAPE.map(([t]) => t), 20).then((data) => {
      if (!cancelled) setQuotes(TAPE.map((row) => toQuote(row, data[row[0]])).filter(Boolean));
    });
    return () => { cancelled = true; };
  }, []);

  if (!quotes.length) {
    return <div style={{ height: 26, borderBottom: `1px solid ${C.border}`, background: C.panel, padding: "5px 14px", fontFamily: mono, fontSize: 10.5, color: C.muted }}>cargando cinta…</div>;
  }

  const items = [...quotes, ...quotes]; // duplicado para que el desplazamiento sea continuo
  return (
    <div className="dione-tape" style={{ height: 26, overflow: "hidden", borderBottom: `1px solid ${C.border}`, background: C.panel, display: "flex", alignItems: "center" }}>
      <div className="dione-tape-track">
        {items.map((q, i) => (
          <Link key={`${q.ticker}-${i}`} to={`/chart?t=${encodeURIComponent(q.ticker)}`} title={q.name} style={{ fontFamily: mono, fontSize: 11, display: "inline-flex", gap: 7 }}>
            <span style={{ color: C.muted }}>{q.ticker.replace("^", "")}</span>
            <span style={{ color: C.text }}>{q.last.toFixed(2)}</span>
            <span style={{ color: q.change >= 0 ? C.pos : C.neg }}>{q.change >= 0 ? "▲" : "▼"}{Math.abs(q.change * 100).toFixed(2)}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
