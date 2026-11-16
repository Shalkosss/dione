// lib/apiAuth.js — Chequeo de token para endpoints que escriben.
//
// Acepta `Authorization: Bearer <token>` o `x-dione-token: <token>`.
// Comparación en tiempo constante. Si el secreto no está configurado en el
// entorno, rechaza siempre (falla cerrado).

import { timingSafeEqual } from 'node:crypto';

export function readToken(req) {
  const auth = String(req.headers?.authorization || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return String(req.headers?.['x-dione-token'] || '').trim();
}

export function tokenMatches(req, secret) {
  if (!secret) return false;
  const given = Buffer.from(readToken(req));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
