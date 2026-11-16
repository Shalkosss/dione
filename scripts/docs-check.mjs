// scripts/docs-check.mjs — Compara project-docs/ contra su INDEX.md.
//
// Uso: npm run docs:check
// Lista: (1) documentos del índice que faltan, (2) obsoletos que siguen en la
// carpeta, (3) archivos que están en la carpeta pero no figuran en el índice.
// Sale con código 1 si hay faltantes u obsoletos, para poder usarlo en CI.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'project-docs');
const INDEX_FILE = 'INDEX.md';
const OBSOLETE_HEADING = /^##\s+Para borrar/i;

// Figuran en el índice pero no viven en el repo a propósito:
// KEYS.md está en .gitignore y TANDEM solo existe en el proyecto de Claude.
const NOT_IN_REPO = new Set(['KEYS.md', 'TANDEM_2026_LECCIONES.md']);

const mdNames = (text) => [...text.matchAll(/`([A-Za-z0-9_.-]+\.md)`/g)].map((m) => m[1]);

// Devuelve { expected, obsolete } leyendo las secciones del índice.
export function parseIndex(indexText) {
  const lines = indexText.split(/\r?\n/);
  const cut = lines.findIndex((l) => OBSOLETE_HEADING.test(l));
  const head = cut === -1 ? lines : lines.slice(0, cut);
  const tail = cut === -1 ? [] : lines.slice(cut);
  // Solo cuenta la primera columna de cada fila de tabla: el resto son notas.
  const expected = head
    .filter((l) => l.trim().startsWith('|'))
    .flatMap((l) => mdNames(l.split('|').slice(1, 3).join('|')));
  return {
    expected: [...new Set([INDEX_FILE, ...expected])].filter((f) => !NOT_IN_REPO.has(f)),
    obsolete: [...new Set(mdNames(tail.join('\n')))],
  };
}

export function compareDocs({ expected, obsolete }, present) {
  const have = new Set(present);
  const known = new Set([...expected, ...obsolete, ...NOT_IN_REPO]);
  return {
    missing: expected.filter((f) => !have.has(f)),
    obsoletePresent: obsolete.filter((f) => have.has(f)),
    unlisted: present.filter((f) => !known.has(f)),
  };
}

function main() {
  const index = parseIndex(readFileSync(join(DOCS_DIR, INDEX_FILE), 'utf8'));
  const present = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
  const diff = compareDocs(index, present);

  const print = (title, items) => {
    process.stdout.write(`${title}: ${items.length ? '\n  - ' + items.join('\n  - ') : 'ninguno'}\n`);
  };
  process.stdout.write(`project-docs: ${present.length} archivos, ${index.expected.length} esperados por INDEX.md\n`);
  print('Faltan (están en el índice, no en la carpeta)', diff.missing);
  print('Obsoletos que siguen en la carpeta', diff.obsoletePresent);
  print('Fuera del índice (agregar a INDEX.md o borrar)', diff.unlisted);

  process.exit(diff.missing.length || diff.obsoletePresent.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
