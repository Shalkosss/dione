// scripts/scan-short.mjs — /scan-short desde la línea de comandos.
//
// Llama a /api/screener?mode=short (snapshot + universo), le suma insiders y
// analistas de /api/smart-money y, con --account, calcula cuánto corto hace
// falta para bajar la beta de la cartera al objetivo.
//
// Uso:
//   npm run scan:short
//   npm run scan:short -- --limit 15 --min 65
//   npm run scan:short -- --account paper --net 0.5
//   npm run scan:short -- --json
//
// --account lee el libro con THESES_TOKEN (entorno o .env.local).

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseEnvFile } from '../lib/thesisImport.js';
import { betaFromCloses, hedgeNeeded, scoreShort, trendInputsFromCandles, withCandleInputs } from '../lib/shortScan.js';
import { shortTiming, toChartCandles, finalShortVerdict } from '../lib/shortTiming.js';
import { accountState } from '../lib/ledger.js';
import { fetchCandlesBatch } from '../lib/yahoo.js';
import { toDailyCandles } from '../lib/thesisRefresh.js';

const DEFAULT_URL = 'https://dionee.vercel.app';
const out = (line = '') => process.stdout.write(`${line}\n`);
const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const usd = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`);

function parseArgs(argv) {
  const o = { limit: 20, min: 50, perSector: 3, account: null, net: 0.5, json: false, url: null };
  for (let i = 0; i < argv.length; i++) {
    const [k, inline] = argv[i].replace(/^--/, '').split('=');
    const val = () => (inline !== undefined ? inline : argv[++i]);
    if (k === 'json') o.json = true;
    else if (k === 'limit') o.limit = Number(val());
    else if (k === 'min') o.min = Number(val());
    else if (k === 'per-sector') o.perSector = Number(val());
    else if (k === 'account') o.account = val();
    else if (k === 'net') o.net = Number(val());
    else if (k === 'url') o.url = val();
  }
  return o;
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Error(`${url} → HTTP ${res.status}${json?.error ? `: ${json.error}` : ''}`);
  return json;
}

async function loadEnv() {
  const local = existsSync('.env.local') ? parseEnvFile(await readFile('.env.local', 'utf8')) : {};
  return { ...local, ...process.env };
}

async function smartMoneyMap(base) {
  try {
    const sm = await getJson(`${base}/api/smart-money?limit=100`);
    return Object.fromEntries((sm.results || []).map((r) => [r.symbol, r]));
  } catch {
    return {};
  }
}

async function portfolioHedge(base, token, accountId, targetNet) {
  const ledger = await getJson(`${base}/api/theses/ledger`, token);
  const acc = ledger.data?.accounts?.[accountId];
  if (!acc) throw new Error(`la cuenta ${accountId} no existe`);
  const state = accountState(acc.initialCash, acc.transactions);
  const tickers = Object.keys(state.positions);
  const raw = await fetchCandlesBatch([...tickers, 'SPY'], { days: 400, concurrency: 4 });
  const series = (s) => toDailyCandles(raw.get(s)).map((c) => ({ date: c.date, close: c.c }));
  const spy = series('SPY').slice(-253);
  const positions = tickers.map((t) => {
    const s = series(t).slice(-253);
    const last = s.at(-1)?.close ?? state.positions[t].cost;
    return { ticker: t, value: state.positions[t].qty * last, beta: betaFromCloses(s, spy) ?? 1 };
  });
  const totalValue = state.cash + positions.reduce((a, p) => a + p.value, 0);
  return { positions, cash: state.cash, totalValue, ...hedgeNeeded(positions, { totalValue, targetNet }) };
}

// Velas de Yahoo para los candidatos (y los ETFs de su sector): ATR, RSI,
// medias y fuerza relativa que el universo no trae. Re-puntúa con todo.
async function enrich(scan, sm) {
  const sectors = scan.meta?.sectors || [];
  const etfs = [...new Set(scan.candidates.map((c) => c.sectorEtf).filter(Boolean))];
  const longs = scan.pairs.map((p) => p.long).filter(Boolean);
  const symbols = [...new Set([...scan.candidates.map((c) => c.symbol), ...etfs, ...longs])];
  const raw = await fetchCandlesBatch(symbols, { days: 420, concurrency: 5, throttleMs: 150 });
  const candles = (s) => toDailyCandles(raw.get(s));
  enrich.atrPct = Object.fromEntries(symbols.map((s) => {
    const t = trendInputsFromCandles(candles(s));
    const last = candles(s).at(-1)?.c;
    return [s, t.atr14 && last ? t.atr14 / last : null];
  }));
  return scan.candidates.map((c) => {
    const row = withCandleInputs(c.row, trendInputsFromCandles(candles(c.symbol), c.sectorEtf ? candles(c.sectorEtf) : []));
    const s = scoreShort(row, { sectors, smartMoney: sm });
    if (s.excluded) return { ...c, score: 0 };
    const timing = shortTiming(toChartCandles(raw.get(c.symbol)));
    return { ...c, row, score: s.score, breakdown: s.breakdown, flags: s.flags, timing, verdict: finalShortVerdict(s.score, timing) };
  });
}

function withVolRatio(pair, enriched) {
  const vs = enrich.atrPct?.[pair.short];
  const vl = pair.long ? enrich.atrPct?.[pair.long] : enrich.atrPct?.[pair.hedgeEtf];
  return vs && vl ? { ...pair, longPerShort: Math.round((vs / vl) * 100) / 100 } : pair;
}

function printScan(scan, opts) {
  const r = scan.meta?.regime;
  out(`Régimen: ${r?.label ?? '—'} · VIX ${r?.vix?.toFixed?.(1) ?? '—'} · SPY ${pct(r?.spyDist, 1)} de la SMA200 · amplitud ${pct(r?.breadth)}`);
  out(`Escaneadas ${scan.scanned} · excluidas ${JSON.stringify(scan.excluded)} · mínimo ${opts.min}`);
  out(`Faltan (verificar en el broker): ${(scan.meta?.missing || []).join(', ')}\n`);
  out('Ticker  Score  Acción               Precio  Entrada (dónde)                    Stop  Cubrir en  R:R  Motivo');
  for (const c of scan.candidates) {
    const t = c.timing || {};
    const where = t.entry != null ? `${t.entry} (${t.entrySource})` : '—';
    const why = [...(t.reasons || []), t.wyckoff?.label && t.status !== 'ACUMULACION' ? `Wyckoff: ${t.wyckoff.label}` : null].filter(Boolean).join('; ');
    out([
      c.symbol.padEnd(7), String(c.score).padStart(5), ' ', c.verdict.padEnd(19), String(t.price ?? c.price ?? '—').padStart(7), ' ',
      where.padEnd(33), String(t.stop ?? '—').padStart(7), String(t.target ?? '—').padStart(10), String(t.rr ?? '—').padStart(5), ' ', why,
    ].join(' '));
  }
  out('\nAcción: SHORT AHORA = el precio ya está en la resistencia · ORDEN LÍMITE = vender en corto recién si sube a la entrada ·');
  out('NO = acumulación Wyckoff (riesgo de barrido y rebote), soporte demasiado cerca o sin resistencia clara.');
  out('\nPares neutrales (corto / largo del mismo sector, montos por volatilidad):');
  const actionable = new Set(scan.candidates.filter((c) => /SHORT|ORDEN/.test(c.verdict)).map((c) => c.symbol));
  for (const p of scan.pairs.filter((x) => actionable.has(x.short))) {
    out(`  ${p.short.padEnd(6)} contra ${(p.long || p.hedgeEtf || '—').padEnd(6)} · por cada $1 en corto, $${p.longPerShort} en largo${p.long ? '' : ' (sin largo de calidad: cubrir con el ETF)'}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const env = await loadEnv();
  const base = (opts.url || env.DIONE_API_URL || DEFAULT_URL).replace(/\/$/, '');
  const [scan, sm] = await Promise.all([
    getJson(`${base}/api/screener?mode=short&minScore=0&perSector=${opts.perSector}&limit=100`),
    smartMoneyMap(base),
  ]);
  const enriched = await enrich(scan, sm);
  const candidates = enriched
    .filter((c) => c.score >= opts.min)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit);
  const keep = new Set(candidates.map((c) => c.symbol));
  const result = { ...scan, candidates, pairs: scan.pairs.filter((p) => keep.has(p.short)).map((p) => withVolRatio(p, enriched)) };

  let hedge = null;
  if (opts.account) {
    if (!env.THESES_TOKEN) throw new Error('falta THESES_TOKEN para leer la cartera');
    hedge = await portfolioHedge(base, env.THESES_TOKEN, opts.account, opts.net);
  }
  if (opts.json) { out(JSON.stringify({ ...result, hedge }, null, 2)); return 0; }

  printScan(result, opts);
  if (hedge) {
    out(`\nCartera ${opts.account}: valor ${usd(hedge.totalValue)} · caja ${usd(hedge.cash)} · beta neta ${hedge.netBeta.toFixed(2)}`);
    hedge.positions.forEach((p) => out(`  ${p.ticker.padEnd(6)} ${usd(p.value).padStart(12)} · beta ${p.beta.toFixed(2)}`));
    out(`  Para bajar la beta neta a ${opts.net}: corto equivalente a ${usd(hedge.shortBetaDollars)} de beta 1 (dividir por la beta del corto elegido).`);
  }
  return 0;
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { process.stderr.write(`Error en scan short: ${e.message}\n`); process.exitCode = 1; });
