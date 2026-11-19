/* positionStats.js — Seguimiento de cada posición abierta desde su compra.
   Funciones puras.

   positionPlan     del libro de órdenes: costo promedio, fecha de inicio del
                    tramo abierto, compras y ventas, stop y take profit.
   levelsFromThesis stop y objetivo de la tesis viva del ticker (respaldo).
   positionMetrics  rentabilidad contra el S&P 500, distancia al stop y al
                    objetivo, múltiplo R, Sharpe, volatilidad, máxima caída, beta.
   correlationMatrix correlación de retornos diarios entre las posiciones.
*/

import { TRADING_DAYS, sharpe, annualizedVol, maxDrawdown } from "./perf.js";
import { atr } from "./indicators.js";
import { closeTarget } from "./thesisView.js";

const EPS = 1e-9;
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

// Tramo abierto de un ticker. El stop y el take profit son los de la última
// compra del tramo que los traiga. null si no hay posición abierta.
export function positionPlan(transactions, ticker) {
  const trades = transactions.filter((t) => t.ticker === ticker && (t.side === "BUY" || t.side === "SELL")).sort(byDate);
  let open = null;
  for (const t of trades) {
    if (t.side === "BUY") {
      if (!open) open = { ticker, qty: 0, avgCost: 0, startDate: t.date, stop: null, target: null, levelsTxId: null, buys: [], sells: [] };
      const qty = open.qty + t.qty;
      open = {
        ...open,
        avgCost: (open.qty * open.avgCost + t.qty * t.price) / qty,
        qty,
        buys: [...open.buys, { id: t.id, date: t.date, price: t.price, qty: t.qty }],
        ...(positive(t.stop) || positive(t.target)
          ? { stop: positive(t.stop) ? Number(t.stop) : null, target: positive(t.target) ? Number(t.target) : null, levelsTxId: t.id }
          : {}),
      };
    } else if (open) {
      const qty = open.qty - t.qty;
      open = qty > EPS ? { ...open, qty, sells: [...open.sells, { id: t.id, date: t.date, price: t.price, qty: t.qty }] } : null;
    }
  }
  return open;
}

// La compra que guarda los niveles del tramo: la que ya los tiene o la última.
export function levelsTransactionId(plan) {
  if (!plan) return null;
  return plan.levelsTxId || plan.buys[plan.buys.length - 1]?.id || null;
}

const LIVE = ["ABIERTA", "ARMADA"];

// Stop y objetivo de la tesis viva más reciente del ticker, si existe.
export function levelsFromThesis(theses, ticker) {
  const live = (theses || []).filter((t) => t.ticker === ticker && LIVE.includes(t.status)).sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))[0];
  if (!live) return null;
  return { stop: live.stop ?? null, target: closeTarget(live), tp1: live.tp1 ?? null, thesisId: live.id, status: live.status };
}

// Niveles efectivos: los del libro mandan; si faltan, los de la tesis.
export function effectiveLevels(plan, thesisLevels) {
  const stop = plan?.stop ?? thesisLevels?.stop ?? null;
  const target = plan?.target ?? thesisLevels?.target ?? null;
  const source = plan?.stop != null || plan?.target != null ? "libro" : thesisLevels && (stop != null || target != null) ? "tesis" : null;
  return { stop, target, source };
}

function closeOnOrBefore(series, date) {
  let hit = null;
  for (const p of series) {
    if (p.date > date) break;
    hit = p;
  }
  return hit;
}

const returnsOf = (closes) => closes.slice(1).map((c, i) => (closes[i] > 0 ? c / closes[i] - 1 : 0));

function betaCorr(series, spy, sessions = 120) {
  const spyBy = new Map(spy.map((p) => [p.date, p.close]));
  const common = series.filter((p) => spyBy.has(p.date)).slice(-(sessions + 1));
  if (common.length < 21) return { beta: null, corr: null };
  const a = returnsOf(common.map((p) => p.close));
  const b = returnsOf(common.map((p) => spyBy.get(p.date)));
  return { ...pearson(a, b), beta: covariance(a, b) / variance(b) || null };
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
function covariance(a, b) {
  const ma = mean(a), mb = mean(b);
  return a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0) / (a.length - 1);
}
const variance = (a) => covariance(a, a);
function pearson(a, b) {
  const va = variance(a), vb = variance(b);
  return { corr: va > 0 && vb > 0 ? covariance(a, b) / Math.sqrt(va * vb) : null };
}

/* Métricas de una posición. `series` y `spy`: [{ date, close, high?, low? }]
   ordenadas. `levels`: { stop, target }. */
export function positionMetrics(plan, series, spy, levels = {}) {
  if (!plan || !series?.length) return null;
  const held = series.filter((p) => p.date >= plan.startDate);
  const last = series[series.length - 1];
  const price = last.close;
  const { stop, target } = levels;
  const out = {
    price, asOf: last.date, sessions: held.length,
    ret: plan.avgCost > 0 ? price / plan.avgCost - 1 : null,
    pnl: plan.qty * (price - plan.avgCost),
    value: plan.qty * price,
  };

  const spyStart = spy?.length ? closeOnOrBefore(spy, plan.startDate) : null;
  const spyEnd = spy?.length ? spy[spy.length - 1] : null;
  out.spyRet = spyStart && spyEnd ? spyEnd.close / spyStart.close - 1 : null;
  out.excess = out.ret != null && out.spyRet != null ? out.ret - out.spyRet : null;

  const closes = held.map((p) => p.close);
  const rets = returnsOf(closes);
  out.volAnn = rets.length >= 10 ? annualizedVol(rets) : null;
  out.sharpe = rets.length >= 20 ? sharpe(rets) : null;
  out.maxDD = held.length >= 2 ? maxDrawdown(held.map((p) => ({ date: p.date, value: p.close }))).value : null;
  out.annualized = out.ret != null && held.length > 20 ? (1 + out.ret) ** (TRADING_DAYS / held.length) - 1 : null;

  const withHL = series.filter((p) => p.high != null && p.low != null);
  const atrArr = withHL.length > 15 ? atr(withHL, 14) : [];
  out.atr = atrArr.length ? atrArr[atrArr.length - 1] : null;

  if (positive(stop)) {
    out.toStop = (price - stop) / price; // cuánto tiene que caer para tocarlo
    out.toStopAtr = out.atr ? (price - stop) / out.atr : null;
    out.riskUsd = plan.qty * (price - stop);
    const risk = plan.avgCost - stop;
    out.r = risk > 0 ? (price - plan.avgCost) / risk : null;
    out.stopHit = held.some((p) => (p.low ?? p.close) <= stop);
  }
  if (positive(target)) {
    out.toTarget = (target - price) / price;
    out.targetHit = held.some((p) => (p.high ?? p.close) >= target);
  }
  if (positive(stop) && positive(target) && target > stop) {
    out.progress = Math.max(0, Math.min(1, (price - stop) / (target - stop)));
    out.rrPlanned = plan.avgCost > stop ? (target - plan.avgCost) / (plan.avgCost - stop) : null;
  }
  Object.assign(out, spy?.length ? betaCorr(series, spy) : { beta: null, corr: null });
  return out;
}

// Correlación de retornos diarios de las últimas `window` sesiones comunes.
export function correlationMatrix(seriesByTicker, tickers, window = 90) {
  const maps = tickers.map((t) => new Map((seriesByTicker[t] || []).map((p) => [p.date, p.close])));
  if (!maps.length) return { tickers, matrix: [], sessions: 0 };
  const dates = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort().slice(-(window + 1));
  const rets = maps.map((m) => returnsOf(dates.map((d) => m.get(d))));
  const matrix = tickers.map((_, i) => tickers.map((__, j) => (i === j ? 1 : rets[i].length >= 20 ? pearson(rets[i], rets[j]).corr : null)));
  return { tickers, matrix, sessions: Math.max(0, dates.length - 1) };
}
