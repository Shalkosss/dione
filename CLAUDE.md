# CLAUDE.md — Contexto del proyecto DIONE WEB

Brief para Claude Code. Se lee solo al abrir el proyecto. Actualizarlo cuando
cambie una decisión o el estado real del repo. Última revisión: 16-nov-2026.

---

## QUÉ ES ESTO

DIONE WEB es la capa cuantitativa y de medición de DIONE, un sistema de
equity research. El usuario es un estudiante de finanzas (Lima, Perú) con
dos cuentas: real USD 5.000 y paper trading USD 1.000.000.

El research (los `/deep`, `/scan`, etc.) vive en un Claude Project aparte.
Esta app hace tres cosas: precalcula el universo que ese research consume
(screener, técnico, smart money), mide las tesis que emite (tracker) y
optimiza el portafolio.

**Método**: los documentos están en `project-docs/` y el repo es la fuente
única. Empezar por `project-docs/INDEX.md` (orden de lectura 1 a 7).
`npm run docs:check` compara la carpeta contra ese índice.

**Plan de trabajo**: `project-docs/ROADMAP_CLAUDE_CODE.md` (Fase 0 a 5).
**Flujo**: local + GitHub como fuente de verdad, Vercel despliega `main`
(`project-docs/FLUJO_DE_TRABAJO.md`).

---

## STACK

- React 18 + Vite 5, react-router-dom 6, recharts 2. Sin TypeScript.
- Backend: funciones serverless de Vercel en `api/` (Node, ESM).
- Base de datos: Supabase Postgres (`@supabase/supabase-js`).
- Tests: vitest (`tests/`).
- Deploy: Vercel, automático en cada push a `main`.

NO agregar TypeScript, Redux, Next.js, Tailwind ni otras dependencias sin
discutirlo antes. El proyecto es deliberadamente minimalista.

---

## MAPA DEL REPO

| Carpeta | Qué hay |
|---|---|
| `src/pages/` | Páginas React (una por ruta) |
| `src/components/` | UI reutilizable (`Panel`, `Layout`, `thesis/`) |
| `src/lib/` | Lógica del cliente: `finance.js` (motor cuantitativo), `marketData.js`, `thesisApi.js`, `thesisView.js` |
| `src/store/` | `PortfolioContext.jsx`: estado del portafolio en localStorage |
| `api/` | Funciones serverless (endpoints y crons) |
| `lib/` | Lógica del servidor, pura cuando se puede: scoring, EDGAR, Yahoo, tracker de tesis |
| `migrations/` | SQL para pegar en el editor de Supabase, numerado |
| `tests/` | Tests de vitest |
| `scripts/` | Utilidades de línea de comando (`docs-check`, `thesis-backfill-check`) |
| `project-docs/` | Documentos del método DIONE v4.1 |
| `research/` | Laboratorio en Python, fuera de la web (`backtest_2026_11/`) |

## PÁGINAS

| Ruta | Página | Estado |
|---|---|---|
| `/` | `Optimizer.jsx` | Markowitz + Black-Litterman, frontera eficiente, rebalanceo, mandato |
| `/risk` | `Risk.jsx` | VaR, Expected Shortfall, stress tests, descomposición de riesgo |
| `/chart` | `Chart.jsx` | Gráfico de precio con indicadores y Wyckoff |
| `/watchlist` | `Watchlist.jsx` | Precios automáticos, vol y beta históricas |
| `/thesis` | `Thesis.jsx` | Tracker de tesis (ver abajo) |
| `/screener` | `Screener.jsx` | Screener en el navegador sobre el universo curado |
| `/hidden-gems` | `HiddenGems.jsx` | Lee el snapshot de `/api/screener` |

## ENDPOINTS

| Endpoint | Qué hace |
|---|---|
| `GET /api/screener` | Filtra y rankea el snapshot precomputado. Modos `gems`, `fundamental`, `technical`, `combo` |
| `GET /api/smart-money` | Snapshot de insiders y analistas. `?ticker=` para uno solo |
| `GET /api/quote/[ticker]` | Cotización vía Finnhub (usa `FINNHUB_KEY`) |
| `GET /api/candles/[ticker]` | Proxy de velas de Yahoo, sin key |
| `GET /api/health`, `GET /api/healthz` | Frescura del snapshot |
| `GET /api/theses` | Lista de tesis. `?status=ARMADA,ABIERTA` |
| `POST /api/theses` | Importa bloques `dione-thesis-v2`. Exige `THESES_TOKEN` |
| `GET /api/theses/[id]` | Una tesis con sus marcas diarias |
| `GET /api/theses/stats` | Métricas de eficiencia (lo atiende `api/theses/[id].js`) |

Los endpoints de tesis responden `{ success, data, error?, meta? }`.

**Límite a tener presente**: el plan Hobby de Vercel admite 12 funciones por
deploy y el repo ya usa las 12. Antes de crear un archivo nuevo en `api/`,
ver si cabe en una función existente.

## CRONS (`vercel.json`, hora UTC)

| Hora | Cron | Qué hace |
|---|---|---|
| 09:00 | `refresh-gems` | Universo y fundamentales desde SEC EDGAR, precio de Stooq, quality gate y preScore |
| 10:00 | `refresh-technical` | Velas de Yahoo y `technicalScore` v3 para el top 200 por preScore |
| 11:00 | `refresh-smart-money` | Insiders y analistas (Finnhub) |
| 22:00 | `refresh-theses` | Tracker: reproduce cada tesis con velas de Yahoo. Sin LLM |

Todos se protegen con `Authorization: Bearer $CRON_SECRET`.

## TABLAS DE SUPABASE

| Tabla | Contenido | Quién escribe |
|---|---|---|
| `hidden_gems_snapshot` | Una fila `latest` con el snapshot JSONB | `refresh-gems`, `refresh-technical` |
| `smart_money_snapshot` | Una fila `latest` | `refresh-smart-money` |
| `symbol_metadata` | Cache de sector e industria (`001_symbol_metadata.sql`) | `lib/finnhub.js` |
| `theses` | Una fila por tesis: bloque v2 más estado del tracker (`002_theses.sql`) | `POST /api/theses`, `refresh-theses` |
| `thesis_marks` | Una fila por tesis y día: precio, SPY, ETF sectorial, estado | `refresh-theses` |
| `thesis_log` | Tabla vieja (v1). `002_theses.sql` migra sus filas a `theses`. Ya no se usa | nadie |

`theses` y `thesis_marks` tienen RLS sin policies: solo entra la
service_role. El navegador pasa siempre por `/api/theses`.

## VARIABLES DE ENTORNO

Servidor (Vercel, y `.env.local` para desarrollo): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `THESES_TOKEN`, `FINNHUB_KEY`,
`SEC_USER_AGENT`. Opcionales: `TECHNICAL_MAX_SYMBOLS`, `SMART_MONEY_TOP_N`,
`SMART_MONEY_SYMBOLS`, `GEMS_YEAR`, `HEALTHZ_STALE_HOURS`.

Las keys nunca van en documentos ni en el repo. `.env.example` lista los
nombres.

---

## TRACKER DE TESIS (Fase 1)

Spec: `project-docs/THESIS_LOG.md`. Piezas:

- `lib/thesisSchema.js`: parser y validación del bloque `dione-thesis-v2`.
- `lib/thesisTracker.js`: máquina de estados, función pura. `replayThesis`
  reproduce la tesis desde su emisión, así que es idempotente y reconstruye
  tesis con fecha pasada.
- `lib/thesisStats.js`: métricas de la sección 6 del spec.
- `lib/thesisRefresh.js`: baja velas y orquesta. `lib/thesisStore.js`: Supabase.
- `scripts/thesis-backfill-check.mjs`: prueba de aceptación contra los 12
  planes de `DEEPS_BACKFILL_2026-11.md` con precios reales.

Reglas del tracker que no salen del spec y conviene no cambiar sin discutir:

1. Solo posiciones largas.
2. MARKET se ejecuta al cierre del día de emisión. LIMIT queda activa desde
   la sesión siguiente.
3. Mismo día con stop y objetivo en el rango: se asume stop.
4. El máximo del día en que se ejecuta un LIMIT no cuenta como objetivo.
5. Con gap, la salida es a la apertura y no al nivel teórico.
6. TP1 solo se registra; la tesis cierra en `target_3m` (o en TP1 si no hay
   objetivo base). No se modela la venta parcial ni subir el stop a la entrada.
7. `CERRADA_TESIS` y el cierre manual por tiempo entran por el campo
   `manual_close` del bloque. `time_stop` cierra solo si no se llegó a +1R.
8. La bandera de sector (regla 3 de vigencia) necesita la lista de
   sobreponderados de `/macro`, que la web todavía no tiene. Queda inactiva
   hasta la Fase 3 (`/api/sectors`).

---

## DECISIONES DE DISEÑO YA TOMADAS (no revertir sin discutir)

1. **Modelo de covarianza single-index** en el Optimizer: la diagonal es la
   varianza total; fuera de diagonal, beta_i·beta_j·var_mercado.
2. **Optimización long-only** por Monte Carlo + hill-climbing. No hay solver
   de QP, a propósito.
3. **Black-Litterman**: el prior es el equilibrio implícito en los pesos
   actuales del usuario. Los views salen del E[R] de cada activo, ponderados
   por confianza.
4. **Reglas de inversión**: manda `project-docs/MANDATE.md` (núcleo-satélite,
   tamaño por presupuesto de riesgo). El Optimizer todavía tiene los límites
   viejos hardcodeados; se alinea en la Fase 2.
5. **El técnico no elige ganadores** (`TECHNICAL_VALIDATED.md`). El
   `technicalScore` v3 del snapshot es histórico y no decide; lo reemplaza el
   score de tendencia v4 en la Fase 3.
6. **Diseño**: terminal oscura. Tokens en `src/theme.js`. JetBrains Mono. No
   cambiar la identidad visual sin pedirlo.

---

## CONVENCIONES

- Comentarios y UI en español.
- Toda la matemática va en `lib/` o `src/lib/`, nunca dentro de un `.jsx`.
  Funciones puras con tests en `tests/`.
- Componentes UI reutilizables en `src/components/`.
- Sin dependencias nuevas sin discutirlo.
- Antes de dar por terminada una tarea o de commitear: `npm test` y
  `npm run build` sin errores.
- Desarrollo local: `npm run dev`. `vite.config.js` simula `/api/quote`,
  `/api/candles` y `/api/theses`; el resto de `api/` solo corre en Vercel.
- El usuario está aprendiendo. Explicar cada cambio en dos líneas.

---

## PENDIENTES CONOCIDOS

- Rotar la key de Finnhub (estuvo en texto plano en un documento ya borrado).
- `src/lib/supabase.js` quedó sin uso desde que Thesis lee por la API.
- `README_HIDDEN_GEMS.md` está duplicado en la raíz y en `project-docs/`.
