// tests/thesisImport.test.js — import de tesis desde la línea de comandos.

import { describe, it, expect } from 'vitest';
import { parseEnvFile, prepareImport, previewLines, responseLines, parseArgs } from '../lib/thesisImport.js';

const BLOCK = {
  schema: 'dione-thesis-v2', id: 'MU-2026-11-14', ticker: 'MU', entry_date: '2026-11-14',
  rating: 'BUY', ref_price: 778.31, order_type: 'LIMIT', entry: 720, stop: 655, target_3m: 900,
};

describe('parseEnvFile', () => {
  it('lee pares clave=valor, ignora comentarios y quita comillas', () => {
    const env = parseEnvFile('# comentario\nTHESES_TOKEN="abc 123"\n\nDIONE_API_URL=https://x.app\nVACIA=\nexport OTRA=\'z\'');
    expect(env).toEqual({ THESES_TOKEN: 'abc 123', DIONE_API_URL: 'https://x.app', VACIA: '', OTRA: 'z' });
  });
});

describe('prepareImport', () => {
  it('separa válidas y rechazadas del texto de un /deep', () => {
    const bad = { ...BLOCK, id: 'MU-bad', stop: 800 };
    const text = `Informe...\n\`\`\`json\n${JSON.stringify(BLOCK)}\n\`\`\`\n${JSON.stringify(bad)}`;
    const p = prepareImport(text);
    expect(p.valid.map((v) => v.id)).toEqual(['MU-2026-11-14']);
    expect(p.rejected).toHaveLength(1);
    expect(p.rejected[0].errors.join(' ')).toMatch(/stop/);
    expect(p.blocks).toHaveLength(2);
  });

  it('ignora JSON que no es una tesis (otros bloques del informe)', () => {
    const p = prepareImport(`${JSON.stringify({ scores: { a: 1 } })}\n${JSON.stringify(BLOCK)}`);
    expect(p.ignored).toBe(1);
    expect(p.valid).toHaveLength(1);
    expect(p.blocks).toHaveLength(1);
  });

  it('marca ids repetidos dentro del mismo lote', () => {
    const p = prepareImport([BLOCK, { ...BLOCK, entry: 710 }]);
    expect(p.duplicateIds).toEqual(['MU-2026-11-14']);
  });

  it('sin bloques devuelve todo vacío', () => {
    const p = prepareImport('nada');
    expect(p).toMatchObject({ valid: [], rejected: [], duplicateIds: [], ignored: 0 });
  });

  it('no muta el bloque original', () => {
    const copy = structuredClone(BLOCK);
    prepareImport([BLOCK]);
    expect(BLOCK).toEqual(copy);
  });
});

describe('previewLines', () => {
  it('muestra niveles, R:R y errores', () => {
    const p = prepareImport([BLOCK, { ...BLOCK, id: 'X-2026', ticker: 'X', stop: 900 }]);
    const text = previewLines(p).join('\n');
    expect(text).toMatch(/MU-2026-11-14/);
    expect(text).toMatch(/LIMIT/);
    expect(text).toMatch(/2\.8R/); // (900 - 720) / (720 - 655)
    expect(text).toMatch(/X-2026/);
    expect(text).toMatch(/stop/);
  });
});

describe('responseLines', () => {
  it('resume importadas, rechazadas y estado del tracker', () => {
    const json = {
      success: true,
      data: { imported: [{ id: 'MU-2026-11-14' }], rejected: [], refresh: { updated: 1 } },
    };
    const text = responseLines(json).join('\n');
    expect(text).toMatch(/1 tesis importada/);
    expect(text).toMatch(/MU-2026-11-14/);
  });

  it('muestra el error del servidor', () => {
    expect(responseLines({ success: false, error: 'token inválido' }).join('\n')).toMatch(/token inválido/);
  });
});

describe('parseArgs', () => {
  it('lee archivos y banderas', () => {
    expect(parseArgs(['a.md', '--check', '--url', 'http://localhost:5173', 'b.md'])).toEqual({
      files: ['a.md', 'b.md'], check: true, url: 'http://localhost:5173', help: false,
    });
  });

  it('acepta --url=valor y -h', () => {
    expect(parseArgs(['--url=https://x.app', '-h'])).toMatchObject({ url: 'https://x.app', help: true, files: [] });
  });
});
