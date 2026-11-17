// lib/ledger.js — Libro de transacciones del portafolio ficticio.
//
// Funciones puras. De la lista de transacciones salen las posiciones, la caja
// y la curva de valor diaria. Costo promedio; solo posiciones largas.
//
// Transacción: { id, date: 'YYYY-MM-DD', side, ticker, qty, price, sector?, note? }
//   side BUY / SELL        → qty acciones a `price`
//   side DEPOSIT / WITHDRAW → `qty` es el monto en dólares (ticker y price no aplican)

export const SIDES = ["BUY", "SELL", "DEPOSIT", "WITHDRAW"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_RE = /^[A-Z^][A-Z0-9.^-]{0,9}$/;
const EPS = 1e-9;

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const isTrade = (t) => t.side === "BUY" || t.side === "SELL";

// Flujo de caja externo de una transacción (aportes y retiros). Las compras y
// ventas mueven caja dentro de la cuenta: no son flujo externo.
export function externalFlow(t) {
  if (t.side === "DEPOSIT") return t.qty;
  if (t.side === "WITHDRAW") return -t.qty;
  return 0;
}

// Estado de la cuenta después de aplicar las transacciones hasta `asOf` inclusive.
export function accountState(initialCash, transactions, asOf = null) {
  const sorted = [...transactions].filter((t) => !asOf || t.date <= asOf).sort(byDate);
  return sorted.reduce(
    (state, t) => {
      if (!isTrade(t)) return { ...state, cash: state.cash + externalFlow(t) };
      const prev = state.positions[t.ticker] || { qty: 0, cost: 0, sector: null, firstDate: t.date };
      if (t.side === "BUY") {
        const qty = prev.qty + t.qty;
        const cost = (prev.qty * prev.cost + t.qty * t.price) / qty;
        const next = { ...prev, qty, cost, sector: t.sector || prev.sector };
        return { ...state, cash: state.cash - t.qty * t.price, positions: { ...state.positions, [t.ticker]: next } };
      }
      const qty = prev.qty - t.qty;
      const realized = state.realized + t.qty * (t.price - prev.cost);
      const { [t.ticker]: _closed, ...rest } = state.positions;
      const positions = qty > EPS ? { ...state.positions, [t.ticker]: { ...prev, qty } } : rest;
      return { cash: state.cash + t.qty * t.price, positions, realized };
    },
    { cash: initialCash, positions: {}, realized: 0 },
  );
}

// Valida una orden contra el estado de la cuenta a esa fecha.
export function validateOrder(initialCash, transactions, order) {
  const errors = [];
  if (!SIDES.includes(order.side)) errors.push("Tipo de operación inválido");
  if (!DATE_RE.test(order.date || "")) errors.push("Fecha inválida (YYYY-MM-DD)");
  if (!(order.qty > 0)) errors.push(isTrade(order) ? "La cantidad debe ser mayor a cero" : "El monto debe ser mayor a cero");
  if (isTrade(order)) {
    if (!TICKER_RE.test(order.ticker || "")) errors.push("Ticker inválido");
    if (!(order.price > 0)) errors.push("El precio debe ser mayor a cero");
  }
  if (errors.length) return { ok: false, errors };

  const state = accountState(initialCash, transactions, order.date);
  if (order.side === "BUY" && order.qty * order.price > state.cash + EPS) {
    errors.push(`Caja insuficiente: la orden cuesta ${(order.qty * order.price).toFixed(2)} y hay ${state.cash.toFixed(2)}`);
  }
  if (order.side === "SELL") {
    const held = state.positions[order.ticker]?.qty || 0;
    if (order.qty > held + EPS) errors.push(`No se puede vender ${order.qty}: a esa fecha hay ${held} de ${order.ticker}`);
  }
  if (order.side === "WITHDRAW" && order.qty > state.cash + EPS) errors.push("No se puede retirar más que la caja disponible");
  return { ok: errors.length === 0, errors };
}

// Revisa que el libro completo sea coherente (por ejemplo, después de borrar
// una compra de la que dependía una venta). Devuelve los errores encontrados.
export function ledgerIssues(initialCash, transactions) {
  const sorted = [...transactions].sort(byDate);
  return sorted.flatMap((t, i) => {
    const check = validateOrder(initialCash, sorted.slice(0, i), t);
    return check.ok ? [] : [`${t.date} ${t.side} ${t.ticker || ""}: ${check.errors[0]}`.replace(/\s+/g, " ")];
  });
}

// Valida una orden nueva contra el libro COMPLETO, no solo contra el estado a
// su fecha: una orden con fecha pasada no puede dejar sin acciones o sin caja a
// un movimiento posterior. Es la validación que se usa antes de guardar.
export function validateInBook(initialCash, transactions, order) {
  const own = validateOrder(initialCash, transactions, order);
  if (!own.ok) return own;
  const errors = ledgerIssues(initialCash, [...transactions, order]).map((e) => `Rompe un movimiento posterior → ${e}`);
  return { ok: errors.length === 0, errors };
}

// Último cierre conocido en o antes de `date`. `series` viene ordenada por fecha.
export function closeOn(series, date) {
  if (!series?.length) return null;
  let lo = 0, hi = series.length - 1, found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) { found = series[mid].close; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

// Curva de valor diaria: [{ date, value, cash, flow }]. `prices` es
// { ticker: [{ date, close }] }. Si falta precio se usa el costo de la posición.
export function equityCurve(initialCash, transactions, prices, dates) {
  const sorted = [...transactions].sort(byDate);
  return dates.map((date, i) => {
    const state = accountState(initialCash, sorted, date);
    const invested = Object.entries(state.positions).reduce(
      (sum, [ticker, p]) => sum + p.qty * (closeOn(prices[ticker], date) ?? p.cost), 0,
    );
    // Un aporte fechado en fin de semana o feriado se imputa a la sesión siguiente.
    const inWindow = (t) => (i === 0 ? t.date === date : t.date > dates[i - 1] && t.date <= date);
    const flow = sorted.filter(inWindow).reduce((s, t) => s + externalFlow(t), 0);
    return { date, value: state.cash + invested, cash: state.cash, flow };
  });
}

// Índice de retorno ponderado por tiempo (base 100). Quita el efecto de aportes
// y retiros: r_t = (V_t − flujo_t) / V_{t−1} − 1.
export function twrIndex(curve) {
  return curve.reduce((acc, point, i) => {
    if (i === 0) return [{ date: point.date, value: 100 }];
    const prevValue = curve[i - 1].value;
    const r = prevValue > 0 ? (point.value - point.flow) / prevValue - 1 : 0;
    return [...acc, { date: point.date, value: acc[i - 1].value * (1 + r) }];
  }, []);
}

// Cartera modelo comprada y mantenida desde `startDate` (base 100).
// `weights` es { ticker: peso }; los pesos se normalizan y lo que falte es caja.
export function modelIndex(weights, prices, dates, startDate) {
  const active = dates.filter((d) => d >= startDate);
  if (!active.length) return [];
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const scale = total > 1 ? 1 / total : 1;
  const legs = Object.entries(weights)
    .map(([ticker, w]) => ({ ticker, w: w * scale, base: closeOn(prices[ticker], active[0]) }))
    .filter((l) => l.base > 0);
  const cashWeight = 1 - legs.reduce((s, l) => s + l.w, 0);
  return active.map((date) => ({
    date,
    value: 100 * (cashWeight + legs.reduce((s, l) => s + l.w * ((closeOn(prices[l.ticker], date) ?? l.base) / l.base), 0)),
  }));
}

// Posiciones valoradas a una fecha, con peso y ganancia no realizada.
export function valuedPositions(state, prices, date) {
  const rows = Object.entries(state.positions).map(([ticker, p]) => {
    const price = closeOn(prices[ticker], date) ?? p.cost;
    const value = p.qty * price;
    return { ticker, qty: p.qty, cost: p.cost, price, value, sector: p.sector, pnl: value - p.qty * p.cost, pnlPct: p.cost > 0 ? price / p.cost - 1 : 0 };
  });
  const total = state.cash + rows.reduce((s, r) => s + r.value, 0);
  return {
    total,
    cash: state.cash,
    rows: rows.map((r) => ({ ...r, weight: total > 0 ? r.value / total : 0 })).sort((a, b) => b.value - a.value),
  };
}

// Texto "NVDA 25" por línea (o separado por comas) → { NVDA: 0.25 }.
// Acepta "%" y coma decimal. Ignora líneas que no entiende y pesos fuera de
// (0%, 100%], que el servidor rechazaría.
export function parseWeights(text) {
  return String(text || "")
    .split(/[\n;]+/)
    .map((line) => line.trim().toUpperCase().match(/^([A-Z^][A-Z0-9.^-]{0,9})[\s,:=]+(\d+(?:[.,]\d+)?)\s*%?$/))
    .filter(Boolean)
    .map(([, ticker, raw]) => [ticker, Number(raw.replace(",", ".")) / 100])
    .filter(([, w]) => w > 0 && w <= 1)
    .reduce((acc, [ticker, w]) => ({ ...acc, [ticker]: w }), {});
}

export function formatWeights(weights) {
  return Object.entries(weights || {}).map(([t, w]) => `${t} ${+(w * 100).toFixed(2)}`).join("\n");
}
