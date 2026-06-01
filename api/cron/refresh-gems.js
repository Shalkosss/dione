// api/cron/refresh-gems.js — Precompute del universo Tier-3.
//
// Disparado por Vercel Cron 1x/día (Hobby permite solo diario). Como FMP free
// limita ~250 req/día, NO refresca todo el universo de una: procesa un CHUNK
// rotatorio (los más viejos primero) y completa la vuelta en pocos días. Con
// FMP pago + endpoints bulk podés subir CHUNK y refrescar todo en 1 corrida
// (ver README, sección "Plan pago").
//
// Cron triggers = GET. Protegido por CRON_SECRET (Vercel lo auto-provisiona y
// lo manda como `Authorization: Bearer <secret>`).

import { fetchUniverse, fetchFundamentals, fetchScore, mapLimit, sleep } from '../../lib/fmp.js';
import { qualityGate, preScore } from '../../lib/scoring.js';
import { readSnapshot, writeSnapshot } from '../../lib/store.js';

export const config = { maxDuration: 60 }; // 300 si tenés Fluid Compute activo

const CHUNK = Number(process.env.GEMS_CHUNK || 200);   // tickers por corrida
const CONCURRENCY = Number(process.env.GEMS_CONCURRENCY || 5);
const USE_SCORE = process.env.GEMS_USE_SCORE === '1';  // enriquecer con Altman/Piotroski

export default async function handler(req, res) {
  // --- auth: solo el cron de Vercel (o vos con el secret) puede dispararlo ---
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    // 1) universo (filtros duros server-side, 1-2 llamadas baratas)
    const universe = await fetchUniverse();
    if (!universe.length) {
      return res.status(502).json({ error: 'universe vacío — revisar FMP_API_KEY o límites' });
    }

    // 2) snapshot previo (para refresco rotatorio)
    const prev = (await readSnapshot()) || { gems: {}, meta: {} };
    const prevGems = prev.gems || {};

    // 3) elegir el chunk: los símbolos del universo con lastChecked más viejo
    const ranked = universe
      .map((u) => ({ u, last: prevGems[u.symbol]?.lastChecked || 0 }))
      .sort((a, b) => a.last - b.last)
      .slice(0, CHUNK)
      .map((x) => x.u);

    // 4) traer fundamentales del chunk con concurrencia limitada
    const now = Date.now();
    const results = await mapLimit(ranked, CONCURRENCY, async (u) => {
      const f = await fetchFundamentals(u.symbol);
      if (!f) return { symbol: u.symbol, __skip: true };
      if (USE_SCORE) {
        const sc = await fetchScore(u.symbol);
        if (sc) Object.assign(f, sc);
        await sleep(120); // respiro extra por la llamada adicional
      }
      const gate = qualityGate(f);
      return {
        ...u,
        ...f,
        gatePass: gate.pass,
        gateReasons: gate.reasons,
        preScore: gate.pass ? preScore(f) : null,
        lastChecked: now,
      };
    });

    // 5) merge en el snapshot (mantener lo no refrescado este run)
    const gems = { ...prevGems };
    let refreshed = 0, passing = 0;
    for (const r of results) {
      if (!r || r.__skip || r.__error) continue;
      gems[r.symbol] = r;
      refreshed++;
      if (r.gatePass) passing++;
    }

    const snapshot = {
      gems,
      meta: {
        updatedAt: new Date().toISOString(),
        universeCount: universe.length,
        totalTracked: Object.keys(gems).length,
        refreshedThisRun: refreshed,
        passingThisRun: passing,
        chunk: CHUNK,
        useScore: USE_SCORE,
        ms: Date.now() - t0,
      },
    };

    await writeSnapshot(snapshot);
    return res.status(200).json({ ok: true, ...snapshot.meta });
  } catch (e) {
    console.error('[refresh-gems]', e);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
}
