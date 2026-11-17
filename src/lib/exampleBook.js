// src/lib/exampleBook.js — Cartera de ejemplo para ver la terminal con datos.
// Arma compras a precios reales de hace unos seis meses, según pesos objetivo.

import { fetchMany } from "./priceHistory.js";

const TARGETS = [
  ["VOO", 0.40, null], ["XLK", 0.08, "Technology"], ["XLF", 0.06, "Financials"],
  ["AMZN", 0.06, "Cons. Disc."], ["MU", 0.06, "Technology"], ["NU", 0.06, "Financials"],
  ["GOOGL", 0.05, "Communication"], ["DUOL", 0.05, "Technology"],
];
const SESSIONS_AGO = 126;

// Devuelve la lista de órdenes BUY lista para cargar. `wholeShares` redondea a
// acciones enteras (cuenta paper); si no, permite fracciones (cuenta chica).
export async function buildExampleOrders(initialCash, wholeShares) {
  const prices = await fetchMany(["SPY", ...TARGETS.map(([t]) => t)], 420);
  const spy = prices.SPY || [];
  if (spy.length < SESSIONS_AGO + 1) throw new Error("No se pudo bajar el historial de precios para armar el ejemplo");
  const date = spy[spy.length - 1 - SESSIONS_AGO].date;

  return TARGETS.flatMap(([ticker, weight, sector]) => {
    const candle = [...(prices[ticker] || [])].reverse().find((c) => c.date <= date);
    const price = candle?.rawClose ?? candle?.close;
    if (!(price > 0)) return [];
    const raw = (initialCash * weight) / price;
    const qty = wholeShares ? Math.floor(raw) : Math.floor(raw * 1000) / 1000;
    return qty > 0 ? [{ side: "BUY", ticker, date, qty, price: Number(price.toFixed(2)), sector, note: "ejemplo" }] : [];
  });
}
