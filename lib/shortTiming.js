// lib/shortTiming.js — Dónde y cuándo abrir un corto. Funciones puras.
//
// El score de lib/shortScan.js dice QUÉ empresa está débil. Esto decide si se
// puede shortear y a qué precio, con los niveles y el Wyckoff del módulo Chart
// (src/lib/levels.js, src/lib/wyckoff.js):
//
// 1. Nunca al precio actual: la entrada es la resistencia más cercana encima
//    (nivel con 2+ toques, directriz bajista o SMA50). Un corto se abre en el
//    rebote que falla (LPSY), no en el piso.
// 2. Si hay acumulación Wyckoff en curso (clímax de venta, rally automático,
//    Spring), no se shortea: es donde se barren los stops y el precio se dispara.
// 3. El objetivo es el primer soporte debajo (se cubre ahí, antes de un
//    posible Spring). Si el recorrido hasta ese soporte no paga 3 veces el
//    riesgo, no hay trade.

import { supportResistance, trendlines } from '../src/lib/levels.js';
import { detectWyckoffEvents, wyckoffPhase } from '../src/lib/wyckoff.js';
import { atr, sma } from '../src/lib/indicators.js';

export function toChartCandles(raw) {
  return (raw || [])
    .filter((k) => k && k.c != null)
    .map((k) => ({ date: new Date(k.t * 1000).toISOString().slice(0, 10), open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v ?? 0 }));
}

// Acumulación que bloquea un corto, leída sobre los eventos del Chart:
// - Spring activo: dentro de la ventana, no invalidado y con su mínimo intacto
//   (ningún low posterior por debajo). Romper el mínimo de un Spring es
//   debilidad (SOW), no acumulación.
// - Clímax de venta (SC) reciente con su mínimo intacto: fase A o B.
// - Un SOS posterior al Spring que ya perdió su nivel (SOS fallido) es
//   bajista: no bloquea.
export function accumulationState(candles, events, window = 60) {
  const last = candles.length - 1;
  const intact = (e) => candles.slice(e.idx + 1).every((c) => c.low >= e.price);
  const springs = events.filter((e) => e.type === 'Spring' && e.status !== 'invalidado' && last - e.idx <= window && intact(e));
  const scs = events.filter((e) => e.type === 'SC' && last - e.idx <= window && intact(e));
  const lastSpring = springs[springs.length - 1];
  const sos = lastSpring && events.filter((e) => e.type === 'SOS' && e.idx > lastSpring.idx).pop();
  if (sos && candles[last].close < sos.level) {
    return { blocking: false, label: `SOS fallido el ${sos.date}: volvió bajo ${round(sos.level)} (bajista)` };
  }
  if (lastSpring) return { blocking: true, label: `Spring activo el ${lastSpring.date} en ${round(lastSpring.price)} (${lastSpring.status}): riesgo de barrido y rebote` };
  if (scs.length) return { blocking: true, label: `clímax de venta el ${scs[scs.length - 1].date}: fase A/B de posible acumulación` };
  return { blocking: false, label: null };
}

const round = (v) => (v == null ? null : Math.round(v * 100) / 100);
const lastOf = (arr) => [...arr].reverse().find((v) => v != null) ?? null;

// Resistencia más cercana encima del precio entre las tres fuentes.
function nearestResistance(candles, price, a) {
  const { resistances, supports } = supportResistance(candles);
  const line = trendlines(candles).resistance;
  const sma50 = lastOf(sma(candles.map((c) => c.close), 50));
  const options = [
    ...resistances.map((r) => ({ price: r.price, source: `resistencia (${r.touches} toques)` })),
    ...(line && line.endPrice > price ? [{ price: line.endPrice, source: 'directriz bajista' }] : []),
    ...(sma50 && sma50 > price ? [{ price: sma50, source: 'SMA50' }] : []),
  ].filter((o) => o.price >= price - 0.5 * a);
  const best = options.sort((x, y) => x.price - y.price)[0] || null;
  const firstSupport = supports.map((s) => s.price).filter((p) => p < price).sort((x, y) => y - x)[0] ?? null;
  return { best, firstSupport };
}

export function shortTiming(candles, { stopAtr = 1.5, minRR = 3, maxEntryDist = 0.25, accumulationWindow = 60 } = {}) {
  if (!candles || candles.length < 80) return { status: 'SIN_DATOS', reasons: ['menos de 80 velas'] };
  const last = candles.length - 1;
  const price = candles[last].close;
  const a = lastOf(atr(candles, 14));

  const { events } = detectWyckoffEvents(candles);
  const acc = accumulationState(candles, events, accumulationWindow);
  const base = { price: round(price), atr: round(a), wyckoff: { ...acc, phase: wyckoffPhase(events, candles)?.phase ?? null } };
  if (acc.blocking) return { ...base, status: 'ACUMULACION', reasons: [acc.label] };

  const { best, firstSupport } = nearestResistance(candles, price, a);
  if (!best || best.price / price - 1 > maxEntryDist) {
    return { ...base, status: 'SIN_RESISTENCIA', firstSupport: round(firstSupport), reasons: ['sin resistencia a menos de 25% del precio'] };
  }

  const entry = Math.max(best.price, price);
  const stop = entry + stopAtr * a;
  const risk = stop - entry;
  const target = firstSupport != null && firstSupport < entry ? firstSupport : entry - minRR * risk;
  const rr = (entry - target) / risk;
  const plan = {
    ...base, entry: round(entry), stop: round(stop), target: round(target), rr: Math.round(rr * 10) / 10,
    entrySource: best.source, firstSupport: round(firstSupport),
  };
  if (rr < minRR) return { ...plan, status: 'POCO_RECORRIDO', reasons: [`hasta el soporte ${round(target)} hay ${plan.rr}R, mínimo ${minRR}R`] };
  const atResistance = price >= best.price - 0.5 * a;
  return { ...plan, status: atResistance ? 'EN_RESISTENCIA' : 'ORDEN_LIMITE', reasons: [] };
}

// Score (qué tan débil) más timing (dónde) → acción.
export function finalShortVerdict(score, timing) {
  if (score < 50) return 'EVITAR';
  if (score < 65) return 'VIGILAR';
  return {
    EN_RESISTENCIA: 'SHORT AHORA',
    ORDEN_LIMITE: 'ORDEN LÍMITE',
    ACUMULACION: 'NO: ACUMULACIÓN',
    POCO_RECORRIDO: 'NO: SOPORTE CERCA',
    SIN_RESISTENCIA: 'NO: SIN RESISTENCIA',
  }[timing?.status] || 'NO: SIN DATOS';
}
