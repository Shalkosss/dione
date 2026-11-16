// api/theses.js — Registro de tesis (tracker, Fase 1).
//
// GET  /api/theses                 → todas las tesis
// GET  /api/theses?status=ARMADA,ABIERTA
// POST /api/theses                 → importa uno o varios bloques dione-thesis-v2
//
// El POST exige token (`Authorization: Bearer <THESES_TOKEN>` o header
// `x-dione-token`). Acepta un objeto, un array, { blocks: [...] } o el texto
// pegado del chat con los bloques adentro. Después de guardar, reconstruye el
// estado de las tesis importadas desde los precios (sirve para fechas pasadas).
//
// Respuesta: { success, data, error?, meta? }

import { tokenMatches } from '../lib/apiAuth.js';
import { extractBlocks, normalizeThesis, MAX_BLOCKS } from '../lib/thesisSchema.js';
import { STATUS } from '../lib/thesisTracker.js';
import { listTheses, upsertTheses } from '../lib/thesisStore.js';
import { refreshTheses } from '../lib/thesisRefresh.js';

export const config = { maxDuration: 60 };

const VALID_STATUSES = Object.values(STATUS);

function parseStatuses(param) {
  const asked = String(param || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const unknown = asked.filter((s) => !VALID_STATUSES.includes(s));
  return { asked, unknown };
}

async function handleGet(req, res) {
  const { asked, unknown } = parseStatuses(req.query.status);
  if (unknown.length) {
    return res.status(400).json({ success: false, error: `status inválido: ${unknown.join(', ')}. Válidos: ${VALID_STATUSES.join(', ')}` });
  }
  const data = await listTheses({ statuses: asked });
  return res.status(200).json({ success: true, data, meta: { total: data.length } });
}

async function handlePost(req, res) {
  if (!process.env.THESES_TOKEN) {
    return res.status(503).json({ success: false, error: 'THESES_TOKEN no configurado en el servidor' });
  }
  if (!tokenMatches(req, process.env.THESES_TOKEN)) {
    return res.status(401).json({ success: false, error: 'token inválido' });
  }

  const blocks = extractBlocks(req.body);
  if (!blocks.length) return res.status(400).json({ success: false, error: 'No se encontró ningún bloque JSON de tesis' });
  if (blocks.length > MAX_BLOCKS) {
    return res.status(400).json({ success: false, error: `Máximo ${MAX_BLOCKS} bloques por llamada` });
  }

  const checked = blocks.map((raw, index) => ({ index, ticker: raw?.ticker ?? null, ...normalizeThesis(raw) }));
  const rejected = checked.filter((c) => !c.ok).map(({ index, ticker, errors }) => ({ index, ticker, errors }));
  const rows = checked.filter((c) => c.ok).map((c) => c.row);
  if (!rows.length) return res.status(400).json({ success: false, error: 'Ningún bloque es válido', data: { rejected } });

  const imported = await upsertTheses(rows);

  // Reconstrucción inmediata. Si Yahoo falla, la tesis ya quedó guardada y el
  // cron la procesa en su próxima corrida.
  let refresh = null;
  try {
    refresh = await refreshTheses({ ids: rows.map((r) => r.id) });
  } catch (e) {
    console.error('[theses] refresh tras importar:', e);
    refresh = { error: 'no se pudo reconstruir ahora; lo hará el cron' };
  }

  return res.status(200).json({ success: true, data: { imported, rejected, refresh } });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'método no permitido' });
  } catch (e) {
    if (e.code === 'CONFIG') return res.status(503).json({ success: false, error: e.message });
    console.error('[theses]', e);
    return res.status(500).json({ success: false, error: 'Error interno al procesar tesis' });
  }
}
