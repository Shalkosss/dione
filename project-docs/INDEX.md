# INDEX — DIONE v4.1 (16-nov-2026)

Mapa de `project-docs/`. Este directorio es la fuente de los documentos del método; el proyecto de Claude guarda una copia. Orden de lectura para una sesión nueva: 1 a 7.

## Núcleo

| # | Archivo | Contenido |
|---|---|---|
| 1 | `INSTRUCTIONS.md` | Copia de las Custom instructions del proyecto de Claude. Rol, capas, formato de `/deep` |
| 2 | `MANDATE.md` | Núcleo-satélite, tamaño por presupuesto de riesgo, universo permitido. Autoridad en reglas de inversión |
| 3 | `HUNTER_MODES.md` | `/scan` v4.1: 11 sectores con tope por sector, megacaps aparte, diversidad del pool, scan por eventos |
| 4 | `TECHNICAL_VALIDATED.md` | Qué sabe y qué no sabe el técnico, régimen, score v4, órdenes, stops, tasas base |
| 5 | `THESIS_LOG.md` | Registro de tesis, máquina de estados, vigencia, métricas |
| 6 | `DEEPS_BACKFILL_2026-11.md` | Los 33 veredictos de mayo a octubre medidos contra SPY. Línea base del log |
| 7 | `DIONE_MEMORY.md` | Gates operativos y lecciones |
| 8 | `SECTOR_PLAYBOOK.md` | Salud, megacaps, financieras |
| 9 | `COMMANDS.md` | Comandos y estado |
| 10 | `BACKTEST_2026-11.md` | Auditoría del scan y backtest de señales |
| 10b | `PEAD_2026-11.md` | Drift post-earnings en el S&P 500: no hay señal explotable; los eventos son contexto |
| 11 | `ROADMAP_CLAUDE_CODE.md` | Plan para la web y para ML |
| 12 | `FLUJO_DE_TRABAJO.md` | Local más GitHub, qué vive dónde |
| 13 | `WATCHLIST.md` | Vista del log y foto de mercado |
| 14 | `UNIVERSE.md` | Universo y tramos por capitalización |

## Referencia vigente

| Archivo | Nota |
|---|---|
| `DATA_SOURCE.md` | Endpoints y schema. Los campos v3 del snapshot ya no deciden |
| `README_HIDDEN_GEMS.md` | Arquitectura de los crons. El top técnico es 200, no 150 |
| `FUNDAMENTAL_FRAMEWORK.md` | Frameworks, Beneish, Altman, 7 Powers, check de data centers. La calidad se compara dentro del sector |
| `WYCKOFF_FRAMEWORK.md` | Referencia descriptiva para leer el gráfico y ubicar niveles. No puntúa ni prioriza scans |
| `SMART_MONEY.md` | Vigente salvo el estado: el overview sí existe (`/api/smart-money`) |
| `CATALYST_CALENDAR.md` | Vigente. La regla de earnings pasa a 3 sesiones (manda `MANDATE.md`) |
| `SHORT_FRAMEWORK.md` | Vigente, solo papel |
| `BLOOMBERG_WORKFLOW.md` | Vigente |
| `TANDEM_2026_LECCIONES.md` | Lecciones del concurso. Vive solo en el proyecto de Claude, no en este paquete |
| `KEYS.md` | Solo nombres de variables y sufijos |

## Para borrar del repo en la Fase 0

`COMMANDS_status.md`, `SETUP_GUIDE.md`, `BACKTEST_RESULTS.md`, `READING_CANON.md`. Están reemplazados o no aportan al análisis.
