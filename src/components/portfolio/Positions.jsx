import React from "react";
import { Link } from "react-router-dom";
import { C, mono, th, td, btn } from "../../theme.js";
import { Panel } from "../Panel.jsx";
import { EmptyState } from "../ui.jsx";
import { sleeveOf } from "../../lib/sectors.js";
import { money, moneySigned } from "../../lib/format.js";

const left = { textAlign: "left" };
const SLEEVE_TAG = { NUCLEO: ["NÚCLEO", C.blue], TACTICO: ["TÁCTICO", C.amber], SATELITE: ["SATÉLITE", C.accent], LIQUIDEZ: ["LIQUIDEZ", C.muted] };
const signed = (v) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

// Posiciones abiertas con peso, resultado y acceso directo a vender.
export function Positions({ valued, onSell }) {
  const cashWeight = valued.total > 0 ? valued.cash / valued.total : 1;
  return (
    <Panel title={`Posiciones · ${valued.rows.length}`} right={`caja ${money(valued.cash)} · ${(cashWeight * 100).toFixed(1)}%`} flush>
      {valued.rows.length === 0 ? (
        <EmptyState title="Sin posiciones">Registrá una compra en la boleta de orden, o escribí “buy voo 10” en la línea de comandos.</EmptyState>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[["Ticker", left], ["Tramo", left], ["Cant."], ["Costo"], ["Precio"], ["Valor"], ["Peso", left], ["Resultado"], [""]].map(([label, style], i) => (
                  <th key={label || i} style={{ ...th, ...style }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {valued.rows.map((r) => {
                const [tag, color] = SLEEVE_TAG[sleeveOf(r.ticker)];
                return (
                  <tr key={r.ticker} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, ...left, fontWeight: 700 }}><Link to={`/chart?t=${encodeURIComponent(r.ticker)}`} style={{ color: C.accent }}>{r.ticker}</Link></td>
                    <td style={{ ...td, ...left, fontSize: 9.5, letterSpacing: "0.08em", color }}>{tag}</td>
                    <td style={td}>{+r.qty.toFixed(3)}</td>
                    <td style={{ ...td, color: C.muted }}>{r.cost.toFixed(2)}</td>
                    <td style={td}>{r.price.toFixed(2)}</td>
                    <td style={td}>{money(r.value)}</td>
                    <td style={{ ...td, ...left, minWidth: 110 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ flex: 1, height: 5, background: C.panel2 }}><span style={{ display: "block", height: 5, width: `${Math.min(100, r.weight * 100 * 2.5)}%`, background: color }} /></span>
                        <span style={{ width: 40, textAlign: "right" }}>{(r.weight * 100).toFixed(1)}%</span>
                      </span>
                    </td>
                    <td style={{ ...td, color: r.pnl >= 0 ? C.pos : C.neg }}>{moneySigned(r.pnl)} <span style={{ opacity: 0.75 }}>{signed(r.pnlPct)}</span></td>
                    <td style={td}><button onClick={() => onSell(r)} style={{ ...btn, padding: "2px 8px", fontSize: 10, color: C.neg, background: "transparent" }}>VENDER</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const SIDE_LABEL = { BUY: ["COMPRA", C.pos], SELL: ["VENTA", C.neg], DEPOSIT: ["APORTE", C.blue], WITHDRAW: ["RETIRO", C.amber] };

// Libro de órdenes: cada movimiento registrado, del más nuevo al más viejo.
export function Blotter({ transactions, onRemove }) {
  const rows = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <Panel title={`Libro de órdenes · ${rows.length}`} flush>
      {rows.length === 0 ? (
        <EmptyState title="Sin movimientos">Cada compra o venta ficticia queda registrada acá con su fecha y precio.</EmptyState>
      ) : (
        <div style={{ maxHeight: 280, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {[["Fecha", left], ["Tipo", left], ["Ticker", left], ["Cant."], ["Precio"], ["Monto"], [""]].map(([label, style], i) => <th key={label || i} style={{ ...th, ...style, background: C.panel }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const [label, color] = SIDE_LABEL[t.side];
                const amount = t.ticker ? t.qty * t.price : t.qty;
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, ...left, color: C.muted }}>{t.date}</td>
                    <td style={{ ...td, ...left, fontSize: 10, letterSpacing: "0.08em", color }}>{label}</td>
                    <td style={{ ...td, ...left, fontWeight: 600 }}>{t.ticker || "—"}</td>
                    <td style={td}>{t.ticker ? +Number(t.qty).toFixed(3) : "—"}</td>
                    <td style={td}>{t.ticker ? Number(t.price).toFixed(2) : "—"}</td>
                    <td style={td}>{money(amount)}</td>
                    <td style={td}><button onClick={() => onRemove(t.id)} title="Borrar este movimiento" aria-label="Borrar movimiento" style={{ ...btn, padding: "0 6px", background: "transparent", color: C.muted, fontFamily: mono }}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
