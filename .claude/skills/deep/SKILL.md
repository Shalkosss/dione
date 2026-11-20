---
name: deep
description: /deep TICKER del método DIONE v4.1 corrido en Claude Code con datos en vivo. Termina registrando la tesis en el tracker sin copiar y pegar. Usar cuando el usuario escribe "/deep NVDA", "deep de MU" o pide el análisis completo de un ticker.
---

# /deep TICKER

1. Leer el procedimiento antes de escribir: `project-docs/INSTRUCTIONS.md` (formato de `/deep`),
   `project-docs/COMMANDS.md`, `project-docs/MANDATE.md`, `project-docs/TECHNICAL_VALIDATED.md`,
   `project-docs/THESIS_LOG.md` (bloque `dione-thesis-v2`) y `project-docs/DIONE_MEMORY.md`.
   Si el ticker es de salud, megacap o financiera, también `project-docs/SECTOR_PLAYBOOK.md`.
2. Datos en vivo, sin inventar números: precios y velas de Yahoo (`lib/yahoo.js`, o
   `https://query1.finance.yahoo.com/v8/finance/chart/TICKER`), fundamentales de SEC EDGAR
   (`lib/edgar.js`, `lib/companyFacts.js`), snapshot del screener y smart money en
   `https://dionee.vercel.app/api/screener` y `/api/smart-money?ticker=`. Decir la fuente y la hora de cada dato.
3. Escribir el informe completo en el formato de `INSTRUCTIONS.md`, terminando en la ORDEN con stop.
4. Registrar la tesis, sin que el usuario lo pida:
   - Guardar el bloque `dione-thesis-v2` en `research/theses/AAAA-MM-DD-TICKER.json`.
   - `npm run thesis:import -- research/theses/AAAA-MM-DD-TICKER.json --check`. Si marca errores, corregir el bloque.
   - `npm run thesis:import -- research/theses/AAAA-MM-DD-TICKER.json` para subirla.
   - Decir en una línea el id importado y que ya se ve en `/thesis`.
5. Si el rating es BUY y el usuario confirma que ejecutó la compra, registrarla con el skill `orden`.
