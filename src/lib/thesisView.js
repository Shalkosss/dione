/* ============================================================
   DIONE · thesisView.js
   Cálculos de presentación de la página Thesis (funciones puras):
   filas de la tabla, serie del gráfico y exportación a markdown.
   La máquina de estados vive en lib/thesisTracker.js (servidor).
   ============================================================ */

const DAY_MS = 86_400_000;

export const LIVE_STATUSES = ["SIN_ORDEN", "ARMADA", "ABIERTA"];
export const POST_MORTEM_STATUSES = ["CERRADA_STOP", "CERRADA_TESIS"];

const dist = (level, price) => (level != null && price ? level / price - 1 : null);

// Objetivo que cierra la tesis: el base (3m) o, si no hay, TP1.
export const closeTarget = (t) => t.target_3m ?? t.tp1 ?? t.target_12m ?? null;

// Fila de la tabla: estado, días y distancia del último precio a cada nivel.
export function toRow(thesis, today = new Date()) {
  const price = thesis.perf?.last?.close ?? thesis.ref_price ?? null;
  const days = Math.max(0, Math.floor((today.getTime() - Date.parse(`${thesis.entry_date}T00:00:00Z`)) / DAY_MS));
  return {
    id: thesis.id,
    ticker: thesis.ticker,
    status: thesis.status,
    rating: thesis.rating,
    conviction: thesis.conviction,
    entryDate: thesis.entry_date,
    days,
    sessions: thesis.sessions_tracked ?? 0,
    price,
    toEntry: dist(thesis.entry, price),
    toStop: dist(thesis.stop, price),
    toTarget: dist(closeTarget(thesis), price),
    r: thesis.r_multiple ?? null,
    alphaSpy: thesis.perf?.last?.alpha_spy ?? null,
    flags: (thesis.flags || []).map((f) => f.code),
    needsPostMortem: POST_MORTEM_STATUSES.includes(thesis.status) && !thesis.post_mortem,
  };
}

// Serie del gráfico: precio y SPY / ETF sectorial rebasados a 100 en la emisión.
export function buildChartSeries(thesis, marks) {
  const first = marks.find((m) => m.date >= thesis.entry_date) || marks[0];
  const spyBase = thesis.spy_ref ?? first?.spy_close ?? null;
  const etfBase = first?.sector_etf_close ?? null;
  const rebase = (v, base) => (v != null && base ? Math.round((v / base) * 10000) / 100 : null);
  return marks.map((m) => ({
    date: m.date,
    close: m.close,
    spy100: rebase(m.spy_close, spyBase),
    etf100: rebase(m.sector_etf_close, etfBase),
    status: m.status,
  }));
}

// Dominio del eje de precio (incluye los niveles) y el del eje base 100
// alineado para que 100 quede a la altura de ref_price.
export function chartDomains(thesis, series) {
  const levels = [thesis.entry, thesis.stop, thesis.tp1, closeTarget(thesis)].filter((v) => v != null);
  const ref = thesis.ref_price;
  const indexAsPrice = series.flatMap((p) => [p.spy100, p.etf100]).filter((v) => v != null && ref).map((v) => (v / 100) * ref);
  const values = [...series.map((p) => p.close), ...levels, ...indexAsPrice].filter((v) => v != null);
  if (!values.length) return { price: [0, 1], index: [0, 1] };
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.06 || hi * 0.02;
  const price = [lo - pad, hi + pad];
  return { price, index: ref ? price.map((v) => (v / ref) * 100) : [0, 1] };
}

// ---- exportación a markdown (espejo legible para project-docs/THESIS_LOG.md) ----

const n2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const pctTxt = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const cell = (v) => String(v ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function orderText(t) {
  if (t.order_type === "SIN_ORDEN") return "Sin orden";
  const kind = t.order_type === "LIMIT" ? "Límite" : "Mercado";
  return `${kind} ${n2(t.entry)}, stop ${n2(t.stop)}, objetivo ${n2(closeTarget(t))}`;
}

function detailBlock(t) {
  const lines = [
    `### ${t.id} — ${t.rating}${t.conviction ? ` (convicción ${t.conviction})` : ""} — ${t.status}`,
    "",
    `- Orden: ${orderText(t)}`,
    t.filled_at ? `- Ejecutada: ${t.filled_at} a ${n2(t.fill_price)}` : null,
    t.closed_at ? `- Cierre: ${t.closed_at} a ${n2(t.close_price)} (${t.close_reason || "—"})${t.r_multiple != null ? `, ${t.r_multiple >= 0 ? "+" : ""}${Number(t.r_multiple).toFixed(2)}R` : ""}` : null,
    t.thesis_text ? `- Tesis: ${t.thesis_text}` : null,
    t.invalidation ? `- Invalidación: ${t.invalidation}` : null,
    (t.flags || []).length ? `- Banderas: ${t.flags.map((f) => `${f.code} desde ${f.since}`).join("; ")}` : null,
    t.post_mortem ? `- Post-mortem: ${t.post_mortem}` : null,
  ];
  return lines.filter((l) => l != null).join("\n");
}

export function exportMarkdown(theses, today = new Date()) {
  const stamp = today.toISOString().slice(0, 10);
  const sorted = [...theses].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
  const header = [
    "## ENTRADAS",
    "",
    `Exportado desde la web el ${stamp}. ${sorted.length} tesis. La web es la fuente; este bloque es el espejo legible.`,
    "",
    "| Id | Rating | Conv. | Orden | Estado | R | Alfa SPY 20d | Alfa SPY 60d | Alfa SPY 120d | Banderas |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  const rows = sorted.map((t) => `| ${[
    t.id, t.rating, t.conviction, orderText(t), t.status,
    t.r_multiple == null ? "—" : Number(t.r_multiple).toFixed(2),
    pctTxt(t.perf?.h20?.alpha_spy), pctTxt(t.perf?.h60?.alpha_spy), pctTxt(t.perf?.h120?.alpha_spy),
    (t.flags || []).map((f) => f.code).join(", "),
  ].map(cell).join(" | ")} |`);
  return [...header, ...rows, "", ...sorted.map(detailBlock)].join("\n") + "\n";
}
