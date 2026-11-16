// tests/thesisSchema.test.js — parser y validación del bloque dione-thesis-v2.

import { describe, it, expect } from 'vitest';
import { extractBlocks, normalizeThesis } from '../lib/thesisSchema.js';

const BLOCK = {
  schema: 'dione-thesis-v2', id: 'MU-2026-11-14', ticker: 'mu', entry_date: '2026-11-14',
  account: 'paper', rating: 'BUY', conviction: 4, sector: 'Information Technology', sector_etf: 'SMH',
  ref_price: 778.31, spy_ref: 754.37, order_type: 'LIMIT', entry: 720, valid_until: '2026-12-29',
  stop: 655, tp1: 850, target_3m: 900, target_12m: 1050, status: 'ARMADA', regime: 'SPY>SMA200',
  invalidation: 'cierre semanal bajo 655', thesis_text: 'una frase',
};

describe('extractBlocks', () => {
  it('acepta un objeto, un array o { blocks: [...] }', () => {
    expect(extractBlocks(BLOCK)).toHaveLength(1);
    expect(extractBlocks([BLOCK, BLOCK])).toHaveLength(2);
    expect(extractBlocks({ blocks: [BLOCK] })).toHaveLength(1);
  });

  it('extrae varios bloques de un texto pegado del chat, con fences y prosa alrededor', () => {
    const text = `Acá va la tesis:\n\`\`\`json\n${JSON.stringify(BLOCK, null, 2)}\n\`\`\`\ny la otra\n${JSON.stringify({ ...BLOCK, id: 'X-1', thesis_text: 'con {llaves} y "comillas"' })}`;
    const blocks = extractBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[1].thesis_text).toBe('con {llaves} y "comillas"');
  });

  it('texto sin JSON devuelve lista vacía', () => {
    expect(extractBlocks('nada por aquí')).toEqual([]);
  });
});

describe('normalizeThesis', () => {
  it('normaliza un bloque v2 válido', () => {
    const { ok, row } = normalizeThesis(BLOCK);
    expect(ok).toBe(true);
    expect(row).toMatchObject({ id: 'MU-2026-11-14', ticker: 'MU', order_type: 'LIMIT', rating: 'BUY', conviction: 4, entry: 720 });
    expect(row.raw_json).toEqual(BLOCK);
    expect(row).not.toHaveProperty('status');
  });

  it('arma el id si falta y deduce la orden desde status o rating', () => {
    const { row } = normalizeThesis({ ...BLOCK, id: undefined, order_type: undefined, status: 'ABIERTA', entry: 778.31 });
    expect(row.id).toBe('MU-2026-11-14');
    expect(row.order_type).toBe('MARKET');
    expect(normalizeThesis({ ticker: 'KO', entry_date: '2026-11-10', rating: 'AVOID', ref_price: 60 }).row.order_type).toBe('SIN_ORDEN');
  });

  it('acepta strings numéricos, "BUY condicional" y convicción v1 (low/medium/high)', () => {
    const { ok, row } = normalizeThesis({ ...BLOCK, entry: '720.5', rating: 'buy condicional', conviction: 'high' });
    expect(ok).toBe(true);
    expect(row).toMatchObject({ entry: 720.5, rating: 'BUY', conviction: 4 });
  });

  it('rechaza ticker, fechas y niveles inválidos con mensajes claros', () => {
    expect(normalizeThesis({ ...BLOCK, ticker: 'DROP TABLE' }).ok).toBe(false);
    expect(normalizeThesis({ ...BLOCK, entry_date: '14/11/2026' }).errors.join()).toMatch(/entry_date/);
    expect(normalizeThesis({ ...BLOCK, stop: 800 }).errors.join()).toMatch(/stop/);
    expect(normalizeThesis({ ...BLOCK, target_3m: 700 }).errors.join()).toMatch(/target_3m/);
    expect(normalizeThesis({ ...BLOCK, entry: null }).errors.join()).toMatch(/entry/);
    expect(normalizeThesis({ ...BLOCK, rating: 'HOLD' }).errors.join()).toMatch(/rating/);
    expect(normalizeThesis('no soy un objeto').ok).toBe(false);
  });

  it('una tesis sin orden no exige entry ni stop, pero sí ref_price', () => {
    expect(normalizeThesis({ ticker: 'KO', entry_date: '2026-11-10', rating: 'WATCH', ref_price: 60 }).ok).toBe(true);
    expect(normalizeThesis({ ticker: 'KO', entry_date: '2026-11-10', rating: 'WATCH' }).errors.join()).toMatch(/ref_price/);
  });

  it('en MARKET completa ref_price con la entrada', () => {
    const { row } = normalizeThesis({ ...BLOCK, order_type: 'MARKET', ref_price: undefined, entry: 700 });
    expect(row.ref_price).toBe(700);
  });

  it('descarta campos desconocidos y recorta textos largos', () => {
    const { row } = normalizeThesis({ ...BLOCK, fill_price: 1, hack: 'x', thesis_text: 'a'.repeat(5000) });
    expect(row).not.toHaveProperty('hack');
    expect(row).not.toHaveProperty('fill_price');
    expect(row.thesis_text.length).toBe(2000);
  });

  it('valida el cierre manual', () => {
    const ok = normalizeThesis({ ...BLOCK, manual_close: { date: '2026-12-01', price: 700, reason: 'TESIS' } });
    expect(ok.row.manual_close).toEqual({ date: '2026-12-01', price: 700, reason: 'TESIS' });
    expect(normalizeThesis({ ...BLOCK, manual_close: { date: 'ayer' } }).ok).toBe(false);
  });
});
