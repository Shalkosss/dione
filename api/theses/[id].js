// api/theses/[id].js — Detalle de una tesis y métricas agregadas.
//
// GET /api/theses/MU-2026-11-14  → { thesis, marks } (marcas diarias para el gráfico)
// GET /api/theses/stats          → métricas de eficiencia (THESIS_LOG.md sección 6)
//
// `stats` vive acá y no en un archivo propio para no gastar otra función
// serverless (el plan Hobby de Vercel admite 12 por deploy).

import { getThesis, getMarks, listTheses } from '../../lib/thesisStore.js';
import { computeThesisStats } from '../../lib/thesisStats.js';

export const config = { maxDuration: 10 };

const ID_RE = /^[A-Za-z0-9._-]{3,48}$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'método no permitido' });
  }
  const id = String(req.query.id || '');
  if (!ID_RE.test(id)) return res.status(400).json({ success: false, error: 'id inválido' });

  try {
    if (id === 'stats') {
      const theses = await listTheses();
      return res.status(200).json({ success: true, data: computeThesisStats(theses) });
    }
    const thesis = await getThesis(id);
    if (!thesis) return res.status(404).json({ success: false, error: `tesis ${id} no encontrada` });
    const marks = await getMarks(id);
    return res.status(200).json({ success: true, data: { thesis, marks } });
  } catch (e) {
    if (e.code === 'CONFIG') return res.status(503).json({ success: false, error: e.message });
    console.error('[theses/id]', e);
    return res.status(500).json({ success: false, error: 'Error interno al leer la tesis' });
  }
}
