/* ============================================================
   DIONE · finance.js
   Motor cuantitativo. Single-index (market model) + Black-Litterman.
   Todo client-side. Sin dependencias externas.
   ============================================================ */

/* ---------- ALGEBRA LINEAL ---------- */

export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function matVec(M, v) {
  return M.map((row) => dot(row, v));
}

export function transpose(M) {
  return M[0].map((_, j) => M.map((row) => row[j]));
}

// Inversa por Gauss-Jordan con pivoteo parcial.
export function inverse(M) {
  const n = M.length;
  const A = M.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-13)
      throw new Error("matriz singular");
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}

/* ---------- COVARIANZA (modelo single-index) ----------
   Diagonal  = varianza total del activo
   Off-diag  = beta_i * beta_j * varianza_de_mercado
   Se aplica un piso de varianza para garantizar matriz invertible
   (necesario para Black-Litterman; ej. el activo CASH con vol 0).
*/
const MIN_VAR = Math.pow(0.003, 2); // ~0.3% vol minima

export function buildCovariance(assets, marketVar) {
  const n = assets.length;
  const cov = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const totVar = Math.pow(assets[i].vol / 100, 2);
    const sysVar = Math.pow(assets[i].beta, 2) * marketVar;
    const effVar = Math.max(totVar, sysVar, MIN_VAR);
    for (let j = 0; j < n; j++) {
      cov[i][j] =
        i === j ? effVar : assets[i].beta * assets[j].beta * marketVar;
    }
  }
  return cov;
}

/* ---------- METRICAS DE PORTAFOLIO ---------- */

export function portReturn(w, expReturns) {
  return dot(w, expReturns);
}

export function portVariance(w, cov) {
  let v = 0;
  for (let i = 0; i < w.length; i++)
    for (let j = 0; j < w.length; j++) v += w[i] * w[j] * cov[i][j];
  return Math.max(v, 0);
}

export function portBeta(w, assets) {
  let b = 0;
  for (let i = 0; i < w.length; i++) b += w[i] * assets[i].beta;
  return b;
}

export function sharpe(ret, vol, rf) {
  if (vol < 1e-9) return 0;
  return (ret - rf) / vol;
}

/* ---------- BLACK-LITTERMAN ----------
   delta : aversion al riesgo = (E[Rm] - rf) / var_mercado
   wMkt  : pesos de equilibrio (proxy: pesos actuales del portafolio)
   views : [{ idx, q, confidence }]  q = retorno TOTAL esperado (decimal)
   Devuelve el vector posterior de retornos TOTALES esperados.
*/
export function impliedReturns(cov, wMkt, delta) {
  return matVec(cov, wMkt).map((x) => x * delta);
}

export function blackLitterman(cov, wMkt, delta, rf, views, tau = 0.05) {
  const n = cov.length;
  const piExcess = impliedReturns(cov, wMkt, delta); // retornos en exceso
  if (!views || views.length === 0) {
    return piExcess.map((x) => x + rf);
  }
  const k = views.length;
  const P = views.map((v) => {
    const row = new Array(n).fill(0);
    row[v.idx] = 1;
    return row;
  });
  const Q = views.map((v) => v.q - rf); // views en exceso

  const tauSigma = cov.map((row) => row.map((x) => x * tau));
  // Omega diagonal: menor confianza -> mayor incertidumbre
  const Omega = views.map((v, i) => {
    const pi = P[i];
    const variance = dot(matVec(tauSigma, pi), pi);
    const c = Math.min(Math.max(v.confidence, 0.02), 0.98);
    return Math.max(variance * (1 / c - 1), 1e-9);
  });

  const tauSigmaInv = inverse(tauSigma);

  // P' Omega^-1 P  (n x n)
  const PtOiP = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      let s = 0;
      for (let i = 0; i < k; i++) s += P[i][a] * (1 / Omega[i]) * P[i][b];
      PtOiP[a][b] = s;
    }

  const Mmat = tauSigmaInv.map((row, i) =>
    row.map((x, j) => x + PtOiP[i][j])
  );
  const Minv = inverse(Mmat);

  const tsiPi = matVec(tauSigmaInv, piExcess);
  const PtOiQ = new Array(n).fill(0);
  for (let a = 0; a < n; a++) {
    let s = 0;
    for (let i = 0; i < k; i++) s += P[i][a] * (1 / Omega[i]) * Q[i];
    PtOiQ[a] = s;
  }
  const rhs = tsiPi.map((x, i) => x + PtOiQ[i]);
  const postExcess = matVec(Minv, rhs);
  return postExcess.map((x) => x + rf);
}

/* ---------- OPTIMIZACION (long-only) ----------
   Monte Carlo sobre el simplex + refinamiento por hill-climbing.
*/
export function randomSimplex(n, cap) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const e = -Math.log(Math.random() + 1e-12);
      x.push(e);
      s += e;
    }
    const w = x.map((v) => v / s);
    if (!cap || w.every((v) => v <= cap + 1e-9)) return w;
  }
  return new Array(n).fill(1 / n);
}

function refine(w0, objFn, cap, iters) {
  let best = w0.slice();
  let bestObj = objFn(best);
  const n = best.length;
  for (let k = 0; k < iters; k++) {
    const i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * n);
    if (i === j) j = (j + 1) % n;
    const stepMax = 0.12 * (1 - k / iters) + 0.005;
    const move = Math.min(Math.random() * stepMax, best[i]);
    const cand = best.slice();
    cand[i] -= move;
    cand[j] += move;
    if (cap && cand[j] > cap + 1e-9) continue;
    const o = objFn(cand);
    if (o < bestObj) {
      bestObj = o;
      best = cand;
    }
  }
  return best;
}

/* Devuelve { cloud, frontier, minVar, maxSharpe } con weights y metricas. */
export function optimize(expReturns, cov, rf, cap, opts = {}) {
  const n = expReturns.length;
  const N = opts.cloudN || 4000;
  const refineIters = opts.refineIters || 3000;
  // Con n activos y cap por posición, el simplex solo tiene soluciones
  // factibles si n * cap >= 1. Si no, ignoramos el cap en el muestreo.
  const effectiveCap = cap && n * cap >= 1 ? cap : null;

  const metrics = (w) => {
    const ret = portReturn(w, expReturns);
    const variance = portVariance(w, cov);
    const vol = Math.sqrt(variance);
    return { w, ret, vol, variance, sharpe: sharpe(ret, vol, rf) };
  };

  const cloud = [];
  let bestVarW = null, bestVar = Infinity;
  let bestShW = null, bestSh = -Infinity;

  const evaluate = (w, addToCloud) => {
    const m = metrics(w);
    if (addToCloud) cloud.push({ vol: m.vol * 100, ret: m.ret * 100 });
    if (m.variance < bestVar) { bestVar = m.variance; bestVarW = w.slice(); }
    if (m.sharpe > bestSh)   { bestSh  = m.sharpe;   bestShW  = w.slice(); }
  };

  // ── Seeding determinístico ──────────────────────────────────────────
  // Sin cap (o cap infactible): cubrir esquinas y pares del simplex asegura
  // que el hill-climber parta de una región óptima, no del centro del simplex.
  if (!effectiveCap) {
    // Esquinas: 100 % en cada activo (Min-Var verdadero → casi siempre esquina de baja vol)
    for (let k = 0; k < n; k++) {
      const w = new Array(n).fill(0); w[k] = 1;
      evaluate(w, true);
    }
    // Biaxiales: todos los pares con 4 ratios de split
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        for (const t of [0.75, 0.5, 0.25]) {
          const w = new Array(n).fill(0); w[a] = t; w[b] = 1 - t;
          evaluate(w, false);
        }
      }
    }
  }

  // ── Monte Carlo aleatorio ───────────────────────────────────────────
  for (let k = 0; k < N; k++) {
    const w = randomSimplex(n, effectiveCap);
    evaluate(w, k < 1300);
  }

  const minVarW = refine(
    bestVarW,
    (w) => portVariance(w, cov),
    effectiveCap,
    refineIters
  );
  const maxShW = refine(
    bestShW,
    (w) => -metrics(w).sharpe,
    effectiveCap,
    refineIters
  );

  // frontera: muestreo + envolvente (min vol por bin de retorno)
  const BINS = 28;
  const samples = [];
  for (let k = 0; k < 4000; k++) samples.push(metrics(randomSimplex(n, effectiveCap)));
  samples.push(metrics(minVarW), metrics(maxShW));
  const rets = samples.map((s) => s.ret);
  const rMin = Math.min(...rets),
    rMax = Math.max(...rets);
  const frontier = [];
  for (let b = 0; b < BINS; b++) {
    const lo = rMin + ((rMax - rMin) * b) / BINS;
    const hi = rMin + ((rMax - rMin) * (b + 1)) / BINS;
    let best = null;
    for (const s of samples)
      if (s.ret >= lo && s.ret <= hi && (!best || s.vol < best.vol))
        best = s;
    if (best) frontier.push({ vol: best.vol * 100, ret: best.ret * 100 });
  }
  frontier.sort((a, b) => a.vol - b.vol);

  return {
    cloud,
    frontier,
    minVar: metrics(minVarW),
    maxSharpe: metrics(maxShW),
  };
}

/* ---------- RIESGO ---------- */

// pdf normal estandar
function normPdf(z) {
  return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
}

const Z95 = 1.6449;
const Z99 = 2.3263;

/* VaR y Expected Shortfall parametricos (normal). value = $ del portafolio. */
export function riskMetrics(annualVol, value) {
  const dailyVol = annualVol / Math.sqrt(252);
  const esFactor = (z) => normPdf(z) / (1 - (z === Z95 ? 0.95 : 0.99));
  return {
    var95_1d: Z95 * dailyVol * value,
    var99_1d: Z99 * dailyVol * value,
    var95_annual: Z95 * annualVol * value,
    es95_1d: esFactor(Z95) * dailyVol * value,
    es99_1d: esFactor(Z99) * dailyVol * value,
  };
}

/* Descomposicion de riesgo: contribucion marginal por activo. */
export function riskDecomposition(w, cov, assets) {
  const n = w.length;
  const variance = portVariance(w, cov);
  const vol = Math.sqrt(variance);
  return assets.map((a, i) => {
    let mcrRaw = 0;
    for (let j = 0; j < n; j++) mcrRaw += w[j] * cov[i][j];
    const mcr = vol > 1e-9 ? mcrRaw / vol : 0;
    const comp = w[i] * mcr;
    const pctRisk = vol > 1e-9 ? comp / vol : 0;
    return { ticker: a.ticker, weight: w[i], mcr, comp, pctRisk };
  });
}

/* Stress tests por beta. Aproximacion: impacto = beta_p * shock * valor. */
export const STRESS_SCENARIOS = [
  { name: "Lehman 2008 (Sep–Nov)", shock: -0.42 },
  { name: "COVID crash (Feb–Mar 2020)", shock: -0.34 },
  { name: "2022 bear market", shock: -0.255 },
  { name: "Q4 2018 selloff", shock: -0.198 },
  { name: "Correccion -10%", shock: -0.1 },
];

export function stressTest(portBetaVal, value) {
  return STRESS_SCENARIOS.map((s) => ({
    name: s.name,
    shock: s.shock,
    impactPct: portBetaVal * s.shock,
    impactUsd: portBetaVal * s.shock * value,
  }));
}

/* Split varianza sistematica vs idiosincratica. */
export function varianceSplit(w, cov, assets, marketVar) {
  const totalVar = portVariance(w, cov);
  const beta = portBeta(w, assets);
  const sysVar = beta * beta * marketVar;
  const idioVar = Math.max(totalVar - sysVar, 0);
  return {
    totalVol: Math.sqrt(totalVar),
    systematicPct: totalVar > 0 ? sysVar / totalVar : 0,
    idiosyncraticPct: totalVar > 0 ? idioVar / totalVar : 0,
  };
}

/* Concentracion y diversificacion. */
export function concentration(w, assets) {
  const sorted = [...w].sort((a, b) => b - a);
  const herfindahl = w.reduce((s, x) => s + x * x, 0);
  const weightedVol = w.reduce(
    (s, x, i) => s + x * (assets[i].vol / 100),
    0
  );
  return {
    top3: sorted.slice(0, 3).reduce((s, x) => s + x, 0),
    top5: sorted.slice(0, 5).reduce((s, x) => s + x, 0),
    effectiveN: herfindahl > 0 ? 1 / herfindahl : 0,
    herfindahl,
    weightedVol,
  };
}
