# INDEX

Inventario de los 20 archivos del Project knowledge de DIONE v3.
Reemplaza la sección "Files Inventory" del SETUP_GUIDE.

| # | Archivo | Descripción |
|---|---|---|
| 1 | [MANDATE.md](MANDATE.md) | Perímetro de decisión: capital, horizontes, activos permitidos, restricciones de riesgo, sesgos a evitar |
| 2 | [UNIVERSE.md](UNIVERSE.md) | Universo funcional sobre EDGAR (~6k filers). Filtros duros + quality gate cap-independiente |
| 3 | [WYCKOFF_FRAMEWORK.md](WYCKOFF_FRAMEWORK.md) | 3 leyes + 5 fases cuantificadas. Detección programática de Spring, SOS, UTAD |
| 4 | [TECHNICAL_VALIDATED.md](TECHNICAL_VALIDATED.md) | Indicadores con evidencia académica. Descarta Fibonacci aislado, Gann, Elliott como driver |
| 5 | [FUNDAMENTAL_FRAMEWORK.md](FUNDAMENTAL_FRAMEWORK.md) | Consenso de 6 frameworks (Graham, Buffett, Lynch, Greenblatt, Piotroski, DuPont) + Beneish + Altman |
| 6 | [HUNTER_MODES.md](HUNTER_MODES.md) | 3 modos del Hunter (Fundamental, Técnico-Wyckoff, Combinado) + Divergence. Phase B LIVE |
| 7 | [SMART_MONEY.md](SMART_MONEY.md) | 4 fuentes (13F, Form 4, dark pool, SI). Score 0-100. Overview pendiente cron Fase 3 |
| 8 | [CATALYST_CALENDAR.md](CATALYST_CALENDAR.md) | Tipos de catalysts, score 0-100, reglas de trading alrededor de eventos |
| 9 | [SHORT_FRAMEWORK.md](SHORT_FRAMEWORK.md) | Tesis bajistas estructurales. Composite Short Score. `mode=short` no existe — scan manual |
| 10 | [COMMANDS.md](COMMANDS.md) | Referencia conceptual de cada comando slash. Apunta a COMMANDS_status para verdad operativa |
| 11 | [COMMANDS_status.md](COMMANDS_status.md) | Estado real de cada comando: AUTO / PASTE / WEB-APP / NO EXISTE / WINDOW |
| 12 | [BLOOMBERG_WORKFLOW.md](BLOOMBERG_WORKFLOW.md) | División de las 2 hrs diarias de Bloomberg + comandos esenciales |
| 13 | [WATCHLIST.md](WATCHLIST.md) | Tesis activas + cantera del snapshot. Regla madre + workflow semanal |
| 14 | [THESIS_LOG.md](THESIS_LOG.md) | Registro self-improving de tesis. Template, métricas, triggers |
| 15 | [DATA_SOURCE.md](DATA_SOURCE.md) | Endpoints reales, schema del snapshot, convenciones, ventana 09-10 UTC |
| 16 | [README_HIDDEN_GEMS.md](README_HIDDEN_GEMS.md) | Arquitectura real del screener: 2 crons (gems + technical) + EDGAR + Yahoo + Supabase |
| 17 | [READING_CANON.md](READING_CANON.md) | Base de conocimiento asumida (Tier 1-4) que DIONE puede citar |
| 18 | [SETUP_GUIDE.md](SETUP_GUIDE.md) | Configuración del Project + pendientes operativos (monitoreo, smart-money overview, thesis log) |
| 19 | [KEYS.md](KEYS.md) | Claves y secretos. Finnhub termina en `q420` (no `nag`). **GITIGNORED** |
| 20 | [INDEX.md](INDEX.md) | Este archivo |

---

**Nota**: `INSTRUCTIONS.md` NO es un archivo del knowledge base — es el
system prompt del Claude Project, va pegado en Custom instructions.
