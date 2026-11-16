// tests/thesisView.test.js — helpers de presentación de la página Thesis
// y piezas puras del refresco (velas de Yahoo, régimen, plan de descarga).

import { describe, it, expect } from 'vitest';
import { toRow, buildChartSeries, chartDomains, exportMarkdown } from '../src/lib/thesisView.js';
import { toDailyCandles, buildRegimeByDate, planRefresh, replayAll } from '../lib/thesisRefresh.js';

const THESIS = {
  id: 'MU-2026-06-01', ticker: 'MU', entry_date: '2026-06-01', rating: 'BUY', conviction: 4,
  order_type: 'LIMIT', ref_price: 110, spy_ref: 500, entry: 100, stop: 90, tp1: 115, target_3m: 130,
  status: 'ARMADA', sessions_tracked: 3, flags: [{ code: 'LIMIT_LEJOS', since: '2026-06-04' }],
  perf: { last: { close: 120, alpha_spy: 0.05 }, h20: null, h60: null, h120: null },
  thesis_text: 'DRAM | ciclo', invalidation: 'cierre bajo 90',
};

describe('toRow', () => {
  it('calcula días y distancias del último precio a entrada, stop y objetivo', () => {
    const row = toRow(THESIS, new Date('2026-06-11T12:00:00Z'));
    expect(row.days).toBe(10);
    expect(row.toEntry).toBeCloseTo(100 / 120 - 1, 6);
    expect(row.toStop).toBeCloseTo(-0.25, 6);
    expect(row.toTarget).toBeCloseTo(130 / 120 - 1, 6);
    expect(row.flags).toEqual(['LIMIT_LEJOS']);
    expect(row.needsPostMortem).toBe(false);
  });

  it('marca el post-mortem pendiente en CERRADA_STOP sin texto', () => {
    expect(toRow({ ...THESIS, status: 'CERRADA_STOP' }).needsPostMortem).toBe(true);
    expect(toRow({ ...THESIS, status: 'CERRADA_STOP', post_mortem: 'x' }).needsPostMortem).toBe(false);
  });
});

describe('gráfico', () => {
  const marks = [
    { date: '2026-06-01', close: 110, spy_close: 500, sector_etf_close: 200, status: 'ARMADA' },
    { date: '2026-06-02', close: 121, spy_close: 510, sector_etf_close: 190, status: 'ARMADA' },
  ];

  it('rebasa SPY y ETF a 100 en la fecha de emisión', () => {
    const s = buildChartSeries(THESIS, marks);
    expect(s[0]).toMatchObject({ close: 110, spy100: 100, etf100: 100 });
    expect(s[1]).toMatchObject({ spy100: 102, etf100: 95 });
  });

  it('alinea el eje base 100 con ref_price e incluye los niveles en el eje de precio', () => {
    const { price, index } = chartDomains(THESIS, buildChartSeries(THESIS, marks));
    expect(price[0]).toBeLessThan(90);
    expect(price[1]).toBeGreaterThan(130);
    expect(index[0]).toBeCloseTo((price[0] / 110) * 100, 6);
  });
});

describe('exportMarkdown', () => {
  it('arma la tabla y el detalle, escapando las barras', () => {
    const md = exportMarkdown([THESIS], new Date('2026-06-11T00:00:00Z'));
    expect(md).toContain('## ENTRADAS');
    expect(md).toContain('| MU-2026-06-01 | BUY | 4 | Límite 100.00, stop 90.00, objetivo 130.00 | ARMADA |');
    expect(md).toContain('- Tesis: DRAM | ciclo');
    expect(md).toContain('LIMIT_LEJOS desde 2026-06-04');
  });
});

describe('piezas puras del refresco', () => {
  it('convierte velas de Yahoo (unix) a fecha y las ordena', () => {
    const t = (d) => Date.parse(`${d}T13:30:00Z`) / 1000;
    const out = toDailyCandles([{ t: t('2026-06-02'), o: 2, h: 3, l: 1, c: 2 }, { t: t('2026-06-01'), o: 1, h: 2, l: 0.5, c: 1 }]);
    expect(out.map((c) => c.date)).toEqual(['2026-06-01', '2026-06-02']);
    expect(toDailyCandles(null)).toEqual([]);
  });

  it('régimen por fecha con SMA de n sesiones', () => {
    const candles = [10, 10, 10, 12, 8].map((c, i) => ({ date: `2026-06-0${i + 1}`, c }));
    const regime = buildRegimeByDate(candles, 3);
    expect(regime['2026-06-02']).toBeUndefined();
    expect(regime['2026-06-04']).toBe('SPY>SMA200');
    expect(regime['2026-06-05']).toBe('SPY<SMA200');
  });

  it('planifica símbolos (con SPY y ETFs) y la ventana de descarga', () => {
    const plan = planRefresh(
      [{ ticker: 'MU', sector_etf: 'SMH', entry_date: '2026-06-01' }, { ticker: 'KO', sector_etf: null, entry_date: '2026-09-01' }],
      Date.parse('2026-11-16T00:00:00Z'));
    expect(plan.symbols.sort()).toEqual(['KO', 'MU', 'SMH', 'SPY']);
    expect(plan.days).toBe(168 + 320);
  });

  it('replayAll informa el error de un ticker sin velas y sigue con el resto', () => {
    const day = (date, c) => ({ date, o: c, h: c + 1, l: c - 1, c });
    const candles = { SPY: [day('2026-06-01', 500), day('2026-06-02', 505)], MU: [day('2026-06-01', 110), day('2026-06-02', 99)] };
    const out = replayAll([THESIS, { ...THESIS, id: 'X-1', ticker: 'XXXX' }], candles);
    expect(out[0].thesis.status).toBe('ABIERTA');
    expect(out[0].marks[1].spy_close).toBe(505);
    expect(out[1].error).toMatch(/XXXX/);
  });
});
