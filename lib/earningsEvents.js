// lib/earningsEvents.js — Fechas de resultados y reacción de precio.
//
// Funciones puras, compartidas por el endpoint /api/events (servidor) y la
// página Earnings (navegador). La fecha sale de los 8-K con ítem 2.02
// ("Results of Operations") de SEC EDGAR. Los emisores extranjeros (6-K, como
// NU) no declaran ítems, así que para ellos no hay fecha confiable.

const NY_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

const OPEN_MINUTE = 9 * 60 + 30;
const CLOSE_MINUTE = 16 * 60;

// Momento de publicación respecto a la sesión de Nueva York.
export function filingTiming(acceptedAtIso) {
  const date = new Date(acceptedAtIso);
  if (Number.isNaN(date.getTime())) return { nyDate: null, timing: "DESCONOCIDO" };
  const p = Object.fromEntries(NY_CLOCK.formatToParts(date).map((x) => [x.type, x.value]));
  const minute = Number(p.hour) * 60 + Number(p.minute);
  const timing = minute < OPEN_MINUTE ? "ANTES_APERTURA" : minute >= CLOSE_MINUTE ? "DESPUES_CIERRE" : "EN_SESION";
  return { nyDate: `${p.year}-${p.month}-${p.day}`, timing };
}

// De `filings.recent` de EDGAR (arrays paralelos) a la lista de publicaciones
// de resultados, de la más nueva a la más vieja.
export function extractEarnings(recent, { limit = 8 } = {}) {
  const forms = recent?.form || [];
  return forms
    .map((form, i) => ({ form, items: String(recent.items?.[i] || ""), filingDate: recent.filingDate?.[i], acceptedAt: recent.acceptanceDateTime?.[i] }))
    .filter((f) => f.form === "8-K" && f.items.split(",").map((s) => s.trim()).includes("2.02"))
    .slice(0, limit)
    .map((f) => {
      const { nyDate, timing } = filingTiming(f.acceptedAt);
      return { filingDate: f.filingDate, acceptedAt: f.acceptedAt, nyDate: nyDate || f.filingDate, timing };
    });
}

const ret = (a, b) => (a > 0 && b > 0 ? b / a - 1 : null);

// Reacción del precio a una publicación. `candles`: [{ date, close }] ordenadas.
// La sesión de reacción es el mismo día si se publicó antes del cierre, o la
// siguiente si se publicó con el mercado ya cerrado.
export function earningsReaction(event, candles) {
  const afterClose = event.timing === "DESPUES_CIERRE";
  const idx = candles.findIndex((c) => (afterClose ? c.date > event.nyDate : c.date >= event.nyDate));
  if (idx < 1) return { sessionDate: null, reaction: null, drift5: null, drift20: null };
  const base = candles[idx - 1].close;
  const day = candles[idx].close;
  return {
    sessionDate: candles[idx].date,
    reaction: ret(base, day),
    // Deriva posterior: desde el cierre del día de reacción.
    drift5: candles[idx + 5] ? ret(day, candles[idx + 5].close) : null,
    drift20: candles[idx + 20] ? ret(day, candles[idx + 20].close) : null,
  };
}

const TICKER_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

// Limpia la lista de tickers pedida al endpoint.
export function parseTickers(param, max = 25) {
  const seen = new Set();
  return String(param || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((t) => TICKER_RE.test(t) && !seen.has(t) && seen.add(t))
    .slice(0, max);
}
