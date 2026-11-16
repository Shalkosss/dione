// scripts/thesis-backfill-check.mjs — Prueba de aceptación del tracker.
//
// Corre la máquina de estados sobre los 12 planes con niveles explícitos de
// project-docs/DEEPS_BACKFILL_2026-11.md (sección 4) usando velas reales de
// Yahoo, y compara contra el resultado calculado a mano en ese documento.
//
// Uso: node scripts/thesis-backfill-check.mjs
// No toca Supabase: solo baja precios y usa las funciones puras.

import { fetchCandlesBatch } from '../lib/yahoo.js';
import { normalizeThesis } from '../lib/thesisSchema.js';
import { toDailyCandles, replayAll, planRefresh, BENCHMARK } from '../lib/thesisRefresh.js';

// [ticker, emisión, orden, entrada, stop, objetivo, resultado esperado, R esperado]
const PLANS = [
  ['VST',   '2026-06-10', 'MARKET', 137.5,   131,   167,  'CERRADA_TP',   4.5],
  ['TILE',  '2026-06-18', 'MARKET', 32.56,   30.93, 37,   'CERRADA_TP',   2.7],
  ['ALLY',  '2026-06-02', 'LIMIT',  41,      39.5,  47,   'CERRADA_TP',   4.0],
  ['NOW',   '2026-06-03', 'LIMIT',  108,     89,    130,  'CERRADA_TP',   1.2],
  ['NUTX',  '2026-06-30', 'LIMIT',  148,     124,   175,  'CERRADA_TP',   1.1],
  ['NU',    '2026-10-26', 'LIMIT',  11.45,   10.85, 12.15, 'CERRADA_TP',  1.2],
  ['GOOGL', '2026-06-08', 'MARKET', 363,     345,   385,  'CERRADA_STOP', -1],
  ['FSLR',  '2026-06-30', 'MARKET', 232,     214,   260,  'CERRADA_STOP', -1],
  ['MU',    '2026-06-25', 'MARKET', 1240.38, 1020,  1350, 'CERRADA_STOP', -1],
  ['HLIT',  '2026-06-25', 'LIMIT',  13.3,    12.5,  17.1, 'CERRADA_STOP', -1],
  ['UBER',  '2026-06-30', 'LIMIT',  71,      66,    82,   'CERRADA_STOP', -1],
  ['KTOS',  '2026-08-05', 'LIMIT',  49,      43.5,  65,   'CERRADA_STOP', -1],
];

const out = (line) => process.stdout.write(`${line}\n`);
const pad = (v, n) => String(v ?? '—').padEnd(n);

async function main() {
  const drafts = PLANS.map(([ticker, entry_date, order_type, entry, stop, tp1]) => (
    { ticker, entry_date, rating: 'BUY', order_type, entry, stop, tp1 }
  ));
  const { symbols, days } = planRefresh(drafts);
  const rawMap = await fetchCandlesBatch(symbols, { days, concurrency: 4, throttleMs: 200 });
  const candles = Object.fromEntries(symbols.map((s) => [s, toDailyCandles(rawMap.get(s))]));
  if (!candles[BENCHMARK].length) throw new Error('Yahoo no devolvió velas de SPY');

  // ref_price = cierre del día de emisión (en MARKET, el precio del plan).
  const theses = drafts.map((d) => {
    const emission = (candles[d.ticker] || []).filter((c) => c.date <= d.entry_date).pop();
    const ref_price = d.order_type === 'MARKET' ? d.entry : emission?.c ?? d.entry;
    const { ok, row, errors } = normalizeThesis({ ...d, ref_price });
    if (!ok) throw new Error(`${d.ticker}: ${errors.join(' · ')}`);
    return row;
  });

  const results = replayAll(theses, candles);
  let matches = 0;
  out(`${pad('Ticker', 7)}${pad('Esperado', 14)}${pad('Tracker', 14)}${pad('R esp.', 8)}${pad('R', 8)}${pad('Fill', 12)}${pad('Cierre', 12)}OK`);
  results.forEach((r, i) => {
    const [ticker, , , , , , expStatus, expR] = PLANS[i];
    if (r.error) { out(`${pad(ticker, 7)}${pad(expStatus, 14)}ERROR: ${r.error}`); return; }
    const t = r.thesis;
    const ok = t.status === expStatus;
    if (ok) matches += 1;
    out(`${pad(ticker, 7)}${pad(expStatus, 14)}${pad(t.status, 14)}${pad(expR, 8)}${pad(t.r_multiple?.toFixed(2), 8)}${pad(t.filled_at, 12)}${pad(t.closed_at, 12)}${ok ? 'sí' : 'NO'}`);
  });
  out(`\nCoinciden ${matches} de ${PLANS.length} con el cálculo manual.`);
  process.exit(matches === PLANS.length ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`Falló: ${e.message}\n`);
  process.exit(2);
});
