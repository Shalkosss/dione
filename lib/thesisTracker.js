// lib/thesisTracker.js — Máquina de estados del tracker de tesis (función pura).
//
// Spec: project-docs/THESIS_LOG.md secciones 2 (estados) y 3 (banderas).
//
// replayThesis(thesis, candles, ctx) reproduce la tesis desde su emisión con
// velas diarias y devuelve { thesis, marks }. Siempre parte del estado inicial
// que se deduce de la orden, así que correrla dos veces da lo mismo
// (idempotente) y el cron puede reconstruir tesis con fechas pasadas.
//
// Supuestos, todos del lado conservador:
//   · Solo posiciones largas (stop < entrada < objetivo).
//   · MARKET se ejecuta al cierre del día de emisión (ref_price).
//   · LIMIT queda activa desde la sesión siguiente a la emisión.
//   · Si el mismo día el rango toca stop y objetivo, se asume stop.
//   · El día en que se ejecuta un LIMIT, el máximo no cuenta como objetivo
//     (pudo ocurrir antes del fill), salvo que haya abierto ya bajo el limit.
//   · Con gap, la salida es al precio de apertura y no al nivel teórico.
//   · TP1 solo se registra. La tesis cierra en el objetivo base (target_3m);
//     si no hay objetivo base, cierra en TP1. No se modela la venta parcial.

export const STATUS = Object.freeze({
  SIN_ORDEN: 'SIN_ORDEN',
  ARMADA: 'ARMADA',
  ABIERTA: 'ABIERTA',
  CERRADA_TP: 'CERRADA_TP',
  CERRADA_STOP: 'CERRADA_STOP',
  CERRADA_TIEMPO: 'CERRADA_TIEMPO',
  CERRADA_TESIS: 'CERRADA_TESIS',
  EXPIRADA: 'EXPIRADA',
  INVALIDADA: 'INVALIDADA',
});

export const FINAL_STATUSES = Object.freeze([
  STATUS.CERRADA_TP, STATUS.CERRADA_STOP, STATUS.CERRADA_TIEMPO,
  STATUS.CERRADA_TESIS, STATUS.EXPIRADA, STATUS.INVALIDADA,
]);

export const LIMIT_VALID_SESSIONS = 30;   // vigencia de un LIMIT sin valid_until
export const MEASURE_SESSIONS = 120;      // ventana de medición de alfa
export const TIME_FLAG_SESSIONS = 60;     // bandera: abierta sin llegar a +1R
export const REVIEW_MAX_DAYS = 90;        // bandera: días calendario sin revisión
export const LIMIT_FAR_PCT = 0.15;        // bandera: precio lejos del limit
export const HORIZONS = Object.freeze([20, 60, 120]);

const isFinal = (status) => FINAL_STATUSES.includes(status);
const round6 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// Estado con el que nace una tesis según su orden.
export function initialState(thesis) {
  const base = {
    status: STATUS.SIN_ORDEN, filled_at: null, fill_price: null,
    closed_at: null, close_price: null, close_reason: null,
    r_multiple: null, tp1_hit_at: null, sessions_to_fill: null, maxHigh: null,
  };
  if (thesis.order_type === 'LIMIT') return { ...base, status: STATUS.ARMADA };
  if (thesis.order_type === 'MARKET') {
    const fill = thesis.ref_price ?? thesis.entry;
    return { ...base, status: STATUS.ABIERTA, filled_at: thesis.entry_date, fill_price: fill, sessions_to_fill: 0, maxHigh: fill };
  }
  return base;
}

const closeTarget = (t) => t.target_3m ?? t.tp1 ?? t.target_12m ?? null;

function closeAt(state, thesis, status, date, price, reason) {
  const risk = state.fill_price != null && thesis.stop != null ? state.fill_price - thesis.stop : null;
  const r = risk && risk > 0 && state.fill_price != null ? (price - state.fill_price) / risk : null;
  return { ...state, status, closed_at: date, close_price: price, close_reason: reason, r_multiple: round6(r) };
}

// Un día de una posición ABIERTA. `countHigh` = false ignora el máximo del día.
function stepOpen(state, thesis, candle, countHigh = true) {
  const { stop, tp1, time_stop: timeStop } = thesis;
  const target = closeTarget(thesis);

  if (stop != null && candle.o <= stop) return closeAt(state, thesis, STATUS.CERRADA_STOP, candle.date, candle.o, 'STOP_GAP');
  if (stop != null && candle.l <= stop) return closeAt(state, thesis, STATUS.CERRADA_STOP, candle.date, stop, 'STOP');

  let next = state;
  if (countHigh) {
    if (target != null && candle.h >= target) {
      const hitTp1 = tp1 != null && !state.tp1_hit_at ? { tp1_hit_at: candle.date } : {};
      return closeAt({ ...state, ...hitTp1 }, thesis, STATUS.CERRADA_TP, candle.date, Math.max(target, candle.o), 'OBJETIVO');
    }
    next = {
      ...state,
      maxHigh: Math.max(state.maxHigh ?? candle.h, candle.h),
      tp1_hit_at: state.tp1_hit_at ?? (tp1 != null && candle.h >= tp1 ? candle.date : null),
    };
  }

  const oneR = stop != null ? next.fill_price + (next.fill_price - stop) : null;
  const reached1R = oneR != null && next.maxHigh != null && next.maxHigh >= oneR;
  if (timeStop && candle.date >= timeStop && !reached1R) {
    return closeAt(next, thesis, STATUS.CERRADA_TIEMPO, candle.date, candle.c, 'TIEMPO');
  }
  return next;
}

// Un día de una orden ARMADA. `n` = sesiones transcurridas desde la emisión.
function stepArmed(state, thesis, candle, n) {
  const { entry, stop, valid_until: validUntil } = thesis;
  const expired = validUntil ? candle.date > validUntil : n > LIMIT_VALID_SESSIONS;
  if (expired) {
    return { ...state, status: STATUS.EXPIRADA, closed_at: candle.date, close_price: candle.c, close_reason: 'LIMIT_VENCIDO' };
  }
  if (stop != null && candle.o <= stop) {
    return { ...state, status: STATUS.INVALIDADA, closed_at: candle.date, close_price: candle.o, close_reason: 'STOP_ANTES_DE_EJECUTAR' };
  }
  if (entry == null || candle.l > entry) return state;

  const gapFill = candle.o <= entry;
  const fill = gapFill ? candle.o : entry;
  const filled = {
    ...state, status: STATUS.ABIERTA, filled_at: candle.date,
    fill_price: fill, sessions_to_fill: n, maxHigh: fill,
  };
  // Mismo día: el stop sí puede saltar; el máximo solo cuenta si abrió ya ejecutada.
  return stepOpen(filled, thesis, candle, gapFill);
}

function applyManualClose(state, thesis, candle) {
  const mc = thesis.manual_close;
  if (!mc?.date || candle.date < mc.date || isFinal(state.status)) return state;
  const status = mc.reason === 'TIEMPO' ? STATUS.CERRADA_TIEMPO : STATUS.CERRADA_TESIS;
  return closeAt(state, thesis, status, candle.date, mc.price ?? candle.c, `MANUAL_${mc.reason || 'TESIS'}`);
}

function stepDay(state, thesis, candle, n) {
  if (isFinal(state.status)) return state;
  const afterManual = applyManualClose(state, thesis, candle);
  if (afterManual !== state) return afterManual;
  if (state.status === STATUS.ARMADA) return stepArmed(state, thesis, candle, n);
  if (state.status === STATUS.ABIERTA) return stepOpen(state, thesis, candle);
  return state;
}

function horizonPerf(thesis, candle, refs, ctx) {
  const ret = thesis.ref_price ? candle.c / thesis.ref_price - 1 : null;
  const spyNow = ctx.spy?.[candle.date];
  const etfNow = ctx.etf?.[candle.date];
  const spy = refs.spy && spyNow != null ? spyNow / refs.spy - 1 : null;
  const etf = refs.etf && etfNow != null ? etfNow / refs.etf - 1 : null;
  return {
    date: candle.date,
    ret: round6(ret), spy: round6(spy), etf: round6(etf),
    alpha_spy: ret != null && spy != null ? round6(ret - spy) : null,
    alpha_etf: ret != null && etf != null ? round6(ret - etf) : null,
  };
}

// Fecha desde la que el régimen actual difiere del registrado (o null).
function regimeFlagSince(recorded, dates, regimeByDate) {
  if (!recorded || !regimeByDate || !dates.length) return null;
  const norm = (s) => (s || '').replace(/\s+/g, '');
  const current = regimeByDate[dates[dates.length - 1]];
  if (!current || norm(current) === norm(recorded)) return null;
  let since = dates[dates.length - 1];
  for (let i = dates.length - 1; i >= 0; i--) {
    const r = regimeByDate[dates[i]];
    if (!r || norm(r) === norm(recorded)) break;
    since = dates[i];
  }
  return since;
}

function computeFlags(thesis, state, track, ctx) {
  const { last, dates, n } = track;
  const flags = [];
  const add = (code, since, detail) => flags.push({ code, since, detail });

  const earn = thesis.next_earnings;
  if (earn && earn > thesis.entry_date && last.date >= earn) {
    add('EARNINGS', earn, 'Reportó earnings después de la emisión');
  }
  const regimeSince = regimeFlagSince(thesis.regime, dates, ctx.regimeByDate);
  if (regimeSince) add('REGIMEN', regimeSince, `Régimen registrado ${thesis.regime}, actual ${ctx.regimeByDate[last.date]}`);

  // Regla 3: solo para tesis emitidas con el sector sobreponderado (sector_view
  // OW). Una tesis en un sector neutral no "deja de estar" sobreponderada.
  const wasOverweight = String(thesis.sector_view || '').trim().toUpperCase() === 'OW';
  if (wasOverweight && Array.isArray(ctx.overweightSectors) && thesis.sector && !ctx.overweightSectors.includes(thesis.sector)) {
    add('SECTOR', last.date, `${thesis.sector} ya no está sobreponderado`);
  }
  if (state.status === STATUS.ARMADA && thesis.entry) {
    const dist = last.c / thesis.entry - 1;
    if (Math.abs(dist) > LIMIT_FAR_PCT) add('LIMIT_LEJOS', last.date, `Precio a ${(dist * 100).toFixed(1)}% del limit`);
  }
  if (state.status === STATUS.ABIERTA && thesis.stop != null) {
    const held = n - (state.sessions_to_fill ?? 0);
    const oneR = state.fill_price + (state.fill_price - thesis.stop);
    if (held > TIME_FLAG_SESSIONS && (state.maxHigh ?? 0) < oneR) {
      add('SIN_1R_60', last.date, `${held} sesiones abierta sin llegar a +1R`);
    }
  }
  const reviewed = thesis.reviewed_at || thesis.entry_date;
  const age = daysBetween(reviewed, last.date);
  if (age > REVIEW_MAX_DAYS) add('SIN_REVISION_90D', last.date, `${age} días sin revisión`);

  return flags;
}

/**
 * Reproduce una tesis desde su emisión.
 * @param thesis  bloque dione-thesis-v2 normalizado (ver lib/thesisSchema.js)
 * @param candles velas diarias ascendentes [{ date:'YYYY-MM-DD', o, h, l, c }]
 * @param ctx     { spy, etf: {date→cierre}, regimeByDate: {date→'SPY>SMA200'}, overweightSectors: string[] }
 * @returns {{ thesis: object, marks: object[] }}
 */
export function replayThesis(thesis, candles, ctx = {}) {
  const days = (candles || []).filter((c) => c.date >= thesis.entry_date);
  let state = initialState(thesis);
  const marks = [];
  const horizons = { h20: null, h60: null, h120: null };
  const refs = {
    spy: thesis.spy_ref ?? ctx.spy?.[thesis.entry_date] ?? null,
    etf: ctx.etf?.[thesis.entry_date] ?? null,
  };
  let n = 0;
  let last = null;

  for (const candle of days) {
    if (candle.date > thesis.entry_date) {
      n += 1;
      state = stepDay(state, thesis, candle, n);
    }
    const live = state.status === STATUS.ARMADA || state.status === STATUS.ABIERTA;
    if (n > MEASURE_SESSIONS && !live) break;
    marks.push({
      thesis_id: thesis.id, date: candle.date,
      close: candle.c, high: candle.h, low: candle.l,
      spy_close: ctx.spy?.[candle.date] ?? null,
      sector_etf_close: ctx.etf?.[candle.date] ?? null,
      status: state.status,
    });
    if (HORIZONS.includes(n)) horizons[`h${n}`] = horizonPerf(thesis, candle, refs, ctx);
    last = { ...candle, n };
  }

  const { maxHigh, ...persisted } = state;
  const trackingDone = !!last && last.n >= MEASURE_SESSIONS
    && (isFinal(state.status) || state.status === STATUS.SIN_ORDEN);
  const flagsApply = !!last && !trackingDone && !isFinal(state.status);
  const track = last ? { last, dates: marks.map((m) => m.date), n: last.n } : null;

  return {
    thesis: {
      ...thesis,
      ...persisted,
      flags: flagsApply ? computeFlags(thesis, state, track, ctx) : [],
      perf: {
        spy_ref: refs.spy, etf_ref: refs.etf, ...horizons,
        last: last ? { ...horizonPerf(thesis, last, refs, ctx), close: last.c, sessions: last.n } : null,
      },
      sessions_tracked: last ? last.n : 0,
      tracking_done: trackingDone,
      last_checked: last ? last.date : thesis.last_checked ?? null,
    },
    marks,
  };
}
