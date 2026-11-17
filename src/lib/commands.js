// src/lib/commands.js — Lógica de la paleta de comandos (Ctrl+K).
// Funciones puras: arman y filtran la lista; la UI vive en components/shell/CommandLine.jsx.

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

// Minúsculas y sin tildes, para comparar texto escrito a mano.
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function parseTicker(text) {
  const candidate = String(text || "").trim().toUpperCase();
  return TICKER_RE.test(candidate) ? candidate : null;
}

const ORDER_WORDS = { B: "BUY", BUY: "BUY", C: "BUY", COMPRAR: "BUY", S: "SELL", SELL: "SELL", V: "SELL", VENDER: "SELL" };

// Orden rápida escrita en la línea de comandos: "buy nu 100", "v mu 5", "c voo".
export function parseOrder(text) {
  const [word, rawTicker, rawQty, ...rest] = String(text || "").trim().toUpperCase().split(/\s+/);
  const side = ORDER_WORDS[word];
  const ticker = parseTicker(rawTicker);
  if (!side || !ticker || rest.length) return null;
  const qty = rawQty == null ? null : Number(rawQty);
  if (rawQty != null && !(qty > 0)) return null;
  return { side, ticker, qty };
}

// Páginas de la app más los atajos que el texto habilite: una orden rápida
// ("buy nu 100") o el gráfico de un ticker ("nvda").
export function buildCommands(pages, query) {
  const base = pages.map((p) => ({ ...p, kind: "page" }));
  const order = parseOrder(query);
  if (order) {
    const qs = new URLSearchParams({ side: order.side, t: order.ticker, ...(order.qty ? { q: String(order.qty) } : {}) });
    const verb = order.side === "BUY" ? "Comprar" : "Vender";
    return [...base, { to: `/?${qs}`, label: `${verb} ${order.qty ?? ""} ${order.ticker}`.replace(/\s+/g, " "), hint: "Abre la boleta de orden", kind: "order" }];
  }
  const ticker = parseTicker(query);
  if (!ticker) return base;
  return [
    ...base,
    { to: `/chart?t=${encodeURIComponent(ticker)}`, label: `Ver gráfico de ${ticker}`, hint: "Chart", kind: "ticker" },
    { to: `/?side=BUY&t=${encodeURIComponent(ticker)}`, label: `Comprar ${ticker}`, hint: "Abre la boleta de orden", kind: "order" },
  ];
}

export function filterCommands(query, commands) {
  const q = fold(query).trim();
  if (!q) return commands.filter((c) => c.kind === "page");
  return commands.filter((c) => c.kind !== "page" || fold(`${c.label} ${c.hint}`).includes(q));
}
