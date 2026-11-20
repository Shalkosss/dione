// tests/ledgerOrder.test.js — registrar una orden desde la línea de comandos.

import { describe, it, expect } from 'vitest';
import { parseOrderArgs, planOrder, orderLines } from '../lib/ledgerOrder.js';

const TODAY = '2026-11-20';
const ACCOUNT = {
  initialCash: 5000, version: 7,
  transactions: [{ id: 'abc123-0', date: '2026-11-10', side: 'BUY', ticker: 'NU', qty: 100, price: 11 }],
};

describe('parseOrderArgs', () => {
  it('lee compra con precio, cuenta, stop y objetivo', () => {
    const r = parseOrderArgs(['buy', 'jmke', '10', '--price', '100', '--account', 'real', '--stop', '92', '--target', '120'], TODAY);
    expect(r.errors).toEqual([]);
    expect(r.account).toBe('real');
    expect(r.order).toEqual({ side: 'BUY', ticker: 'JMKE', qty: 10, price: 100, date: TODAY, stop: 92, target: 120 });
  });

  it('acepta palabras en español, --x=valor, fecha y nota', () => {
    const r = parseOrderArgs(['vender', 'NU', '50', '--price=12.5', '--date=2026-11-19', '--note', 'toma de ganancia'], TODAY);
    expect(r.order).toMatchObject({ side: 'SELL', ticker: 'NU', qty: 50, price: 12.5, date: '2026-11-19', note: 'toma de ganancia' });
    expect(r.account).toBe('paper');
  });

  it('exige precio y cantidad, y cuenta conocida', () => {
    const r = parseOrderArgs(['buy', 'JMKE', '--account', 'otra'], TODAY);
    expect(r.errors.join(' ')).toMatch(/cantidad/);
    expect(r.errors.join(' ')).toMatch(/precio/);
    expect(r.errors.join(' ')).toMatch(/cuenta/);
  });

  it('--check y --url', () => {
    const r = parseOrderArgs(['b', 'NU', '1', '--price', '10', '--check', '--url', 'http://localhost:5173'], TODAY);
    expect(r).toMatchObject({ check: true, url: 'http://localhost:5173' });
  });
});

describe('planOrder', () => {
  it('agrega la orden al libro con la versión que vio', () => {
    const order = { side: 'BUY', ticker: 'JMKE', qty: 10, price: 100, date: TODAY };
    const p = planOrder(ACCOUNT, order, 'zz9999');
    expect(p.ok).toBe(true);
    expect(p.body.baseVersion).toBe(7);
    expect(p.body.transactions).toHaveLength(2);
    expect(p.tx).toMatchObject({ id: 'zz9999', ticker: 'JMKE', qty: 10, price: 100 });
    expect(p.after.cash).toBeCloseTo(5000 - 1100 - 1000);
  });

  it('rechaza una compra sin caja', () => {
    const p = planOrder(ACCOUNT, { side: 'BUY', ticker: 'JMKE', qty: 100, price: 100, date: TODAY }, 'zz9999');
    expect(p.ok).toBe(false);
    expect(p.errors[0]).toMatch(/Caja insuficiente/);
  });

  it('rechaza vender más de lo que hay', () => {
    const p = planOrder(ACCOUNT, { side: 'SELL', ticker: 'NU', qty: 200, price: 12, date: TODAY }, 'zz9999');
    expect(p.ok).toBe(false);
  });

  it('rechaza stop sobre el objetivo', () => {
    const p = planOrder(ACCOUNT, { side: 'BUY', ticker: 'JMKE', qty: 1, price: 100, date: TODAY, stop: 130, target: 120 }, 'zz9999');
    expect(p.ok).toBe(false);
  });

  it('no muta el libro recibido', () => {
    const copy = structuredClone(ACCOUNT);
    planOrder(ACCOUNT, { side: 'BUY', ticker: 'JMKE', qty: 1, price: 100, date: TODAY }, 'zz9999');
    expect(ACCOUNT).toEqual(copy);
  });
});

describe('orderLines', () => {
  it('resume la orden y la caja que queda', () => {
    const p = planOrder(ACCOUNT, { side: 'BUY', ticker: 'JMKE', qty: 10, price: 100, date: TODAY, stop: 92 }, 'zz9999');
    const text = orderLines('real', p).join('\n');
    expect(text).toMatch(/COMPRA 10 JMKE a 100/);
    expect(text).toMatch(/1,000\.00|1000\.00/);
    expect(text).toMatch(/stop 92/);
    expect(text).toMatch(/caja/i);
  });
});
