// api/cron/refresh-theses.js — Actualiza el estado de las tesis todos los días.
//
// Vercel Cron: 22:00 UTC (después del cierre de NY), protegido por CRON_SECRET.
// Solo lógica de precios: baja velas de Yahoo, corre la máquina de estados
// (lib/thesisTracker.js) y guarda estado, banderas y marcas. Sin LLM.
//
// Se puede disparar a mano con el mismo header para reconstruir tesis
// importadas con fecha pasada.

import { refreshTheses } from '../../lib/thesisRefresh.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const t0 = Date.now();
  try {
    const summary = await refreshTheses();
    return res.status(200).json({ ok: true, ...summary, ms: Date.now() - t0 });
  } catch (e) {
    console.error('[refresh-theses]', e);
    return res.status(500).json({ error: 'refresh-theses falló', ms: Date.now() - t0 });
  }
}
