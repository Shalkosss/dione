// src/lib/perf.js — Métricas de desempeño contra benchmark.
//
// Funciones puras sobre series [{ date, value }] ordenadas por fecha.
// Convención: 252 sesiones por año; retornos simples diarios.

export const TRADING_DAYS = 252;

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const variance = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
};
const std = (xs) => Math.sqrt(variance(xs));

export function dailyReturns(series) {
  return series.slice(1).map((p, i) => (series[i].value > 0 ? p.value / series[i].value - 1 : 0));
}

// Deja las dos series con las mismas fechas (intersección).
export function alignSeries(a, b) {
  const inB = new Map(b.map((p) => [p.date, p.value]));
  const dates = a.filter((p) => inB.has(p.date));
  return [dates.map((p) => ({ date: p.date, value: p.value })), dates.map((p) => ({ date: p.date, value: inB.get(p.date) }))];
}

// Rebasa una serie a 100 en su primer punto.
export function rebase(series, base = 100) {
  const first = series[0]?.value;
  return first > 0 ? series.map((p) => ({ date: p.date, value: (p.value / first) * base })) : [];
}

export function totalReturn(series) {
  if (series.length < 2 || !(series[0].value > 0)) return null;
  return series[series.length - 1].value / series[0].value - 1;
}

// Retorno de las últimas `sessions` sesiones. Devuelve null si no hay historia suficiente.
export function trailingReturn(series, sessions) {
  if (series.length <= sessions) return null;
  const base = series[series.length - 1 - sessions].value;
  return base > 0 ? series[series.length - 1].value / base - 1 : null;
}

// Retorno desde el último cierre del año anterior.
export function ytdReturn(series) {
  if (series.length < 2) return null;
  const year = series[series.length - 1].date.slice(0, 4);
  const prior = series.filter((p) => p.date.slice(0, 4) < year);
  const base = prior.length ? prior[prior.length - 1].value : series[0].value;
  return base > 0 ? series[series.length - 1].value / base - 1 : null;
}

export function annualizedReturn(series) {
  const total = totalReturn(series);
  const n = series.length - 1;
  return total == null || n < 1 ? null : (1 + total) ** (TRADING_DAYS / n) - 1;
}

export function annualizedVol(returns) {
  return returns.length < 2 ? null : std(returns) * Math.sqrt(TRADING_DAYS);
}

export function sharpe(returns, rfAnnual = 0) {
  const sd = std(returns);
  return returns.length < 2 || sd === 0 ? null : ((mean(returns) - rfAnnual / TRADING_DAYS) / sd) * Math.sqrt(TRADING_DAYS);
}

// Como Sharpe, pero penaliza solo la volatilidad de los días negativos.
export function sortino(returns, rfAnnual = 0) {
  const rf = rfAnnual / TRADING_DAYS;
  const downside = Math.sqrt(mean(returns.map((r) => Math.min(0, r - rf) ** 2)));
  return returns.length < 2 || downside === 0 ? null : ((mean(returns) - rf) / downside) * Math.sqrt(TRADING_DAYS);
}

// Caída desde el máximo previo en cada fecha (valores ≤ 0).
export function drawdownSeries(series) {
  let peak = -Infinity;
  return series.map((p) => {
    peak = Math.max(peak, p.value);
    return { date: p.date, value: peak > 0 ? p.value / peak - 1 : 0 };
  });
}

export function maxDrawdown(series) {
  const dd = drawdownSeries(series);
  if (!dd.length) return { value: null, troughDate: null, peakDate: null };
  const trough = dd.reduce((worst, p) => (p.value < worst.value ? p : worst), dd[0]);
  const before = series.filter((p) => p.date <= trough.date);
  const peak = before.reduce((best, p) => (p.value >= best.value ? p : best), before[0]);
  return { value: trough.value, troughDate: trough.date, peakDate: peak.date };
}

// Regresión de los retornos de la cartera contra el benchmark.
// alpha anualizado (Jensen), beta y R².
export function alphaBeta(portReturns, benchReturns, rfAnnual = 0) {
  const n = Math.min(portReturns.length, benchReturns.length);
  if (n < 3) return { alpha: null, beta: null, r2: null };
  const rf = rfAnnual / TRADING_DAYS;
  const p = portReturns.slice(-n).map((r) => r - rf);
  const b = benchReturns.slice(-n).map((r) => r - rf);
  const mp = mean(p), mb = mean(b);
  const cov = p.reduce((s, x, i) => s + (x - mp) * (b[i] - mb), 0) / (n - 1);
  const vb = variance(b), vp = variance(p);
  if (vb === 0) return { alpha: null, beta: null, r2: null };
  const beta = cov / vb;
  return { alpha: (mp - beta * mb) * TRADING_DAYS, beta, r2: vp > 0 ? (cov * cov) / (vb * vp) : null };
}

const activeReturns = (p, b) => {
  const n = Math.min(p.length, b.length);
  return p.slice(-n).map((r, i) => r - b.slice(-n)[i]);
};

// Desvío anualizado del retorno activo (cartera menos benchmark).
export function trackingError(portReturns, benchReturns) {
  const active = activeReturns(portReturns, benchReturns);
  return active.length < 2 ? null : std(active) * Math.sqrt(TRADING_DAYS);
}

// Retorno activo anualizado por unidad de tracking error.
export function informationRatio(portReturns, benchReturns) {
  const active = activeReturns(portReturns, benchReturns);
  const sd = std(active);
  return active.length < 2 || sd === 0 ? null : (mean(active) / sd) * Math.sqrt(TRADING_DAYS);
}

// Proporción de sesiones en que la cartera le gana al benchmark.
export function hitRate(portReturns, benchReturns) {
  const active = activeReturns(portReturns, benchReturns);
  return active.length ? active.filter((r) => r > 0).length / active.length : null;
}

// Captura al alza y a la baja: cuánto del movimiento del benchmark se lleva la cartera.
export function capture(portReturns, benchReturns) {
  const n = Math.min(portReturns.length, benchReturns.length);
  const pairs = portReturns.slice(-n).map((r, i) => [r, benchReturns.slice(-n)[i]]);
  const ratio = (subset) => {
    const bm = mean(subset.map(([, b]) => b));
    return subset.length && bm !== 0 ? mean(subset.map(([p]) => p)) / bm : null;
  };
  return { up: ratio(pairs.filter(([, b]) => b > 0)), down: ratio(pairs.filter(([, b]) => b < 0)) };
}

// Retorno de cada mes calendario: [{ month: 'YYYY-MM', value }].
export function monthlyReturns(series) {
  const lastOfMonth = series.reduce((acc, p) => ({ ...acc, [p.date.slice(0, 7)]: p.value }), {});
  const months = Object.keys(lastOfMonth).sort();
  return months.map((month, i) => {
    const base = i === 0 ? series[0].value : lastOfMonth[months[i - 1]];
    return { month, value: base > 0 ? lastOfMonth[month] / base - 1 : 0 };
  });
}

// Exceso acumulado móvil de la cartera sobre el benchmark en `window` sesiones.
export function rollingExcess(port, bench, window = 21) {
  const [p, b] = alignSeries(port, bench);
  return p.slice(window).map((point, i) => ({
    date: point.date,
    value: point.value / p[i].value - b[i + window].value / b[i].value,
  }));
}

// Resumen completo contra un benchmark. `sessions` avisa cuánta historia hay.
export function summarize(port, bench, rfAnnual = 0) {
  const [p, b] = alignSeries(port, bench);
  const pr = dailyReturns(p), br = dailyReturns(b);
  const ab = alphaBeta(pr, br, rfAnnual);
  return {
    sessions: pr.length,
    totalReturn: totalReturn(p),
    benchReturn: totalReturn(b),
    annReturn: annualizedReturn(p),
    vol: annualizedVol(pr),
    sharpe: sharpe(pr, rfAnnual),
    sortino: sortino(pr, rfAnnual),
    maxDrawdown: maxDrawdown(p),
    alpha: ab.alpha,
    beta: ab.beta,
    r2: ab.r2,
    trackingError: trackingError(pr, br),
    informationRatio: informationRatio(pr, br),
    hitRate: hitRate(pr, br),
    capture: capture(pr, br),
  };
}
