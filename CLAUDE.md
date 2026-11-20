# CLAUDE.md — Contexto del proyecto DIONE WEB

Brief para Claude Code. Se lee solo al abrir el proyecto. Actualizarlo cuando
cambie una decisión o el estado real del repo. Última revisión: 17-nov-2026.

---

## QUÉ ES ESTO

DIONE WEB es la capa cuantitativa y de medición de DIONE, un sistema de
equity research. El usuario es un estudiante de finanzas (Lima, Perú) con
dos cuentas: real USD 5.000 y paper trading USD 1.000.000.

El research (los `/deep`, `/scan`, etc.) vive en un Claude Project aparte.
Esta app hace tres cosas: precalcula el universo que ese research consume
(screener, técnico, smart money), mide las tesis que emite (tracker) y
mide la cartera contra el S&P 500.

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
| `src/lib/` | Lógica del cliente: `ledger.js` (re-exporta `lib/ledger.js`), `ledgerSync.js`, `perf.js` (métricas), `sectors.js` (sectores y mandato), `marketBoard.js`, `priceHistory.js`, `thesisApi.js`, `thesisView.js`, `wyckoff.js` (eventos del Chart), `levels.js` (soportes, resistencias, directrices, perfil de volumen), `chartData.js`, `positionStats.js` (seguimiento de posiciones) |
| `src/store/` | `LedgerContext.jsx`: cuentas, órdenes y carteras de referencia en localStorage |
| `api/` | Funciones serverless (endpoints y crons) |
| `lib/` | Lógica del servidor, pura cuando se puede: scoring, EDGAR, Yahoo, tracker de tesis |
| `migrations/` | SQL para pegar en el editor de Supabase, numerado |
| `tests/` | Tests de vitest |
| `scripts/` | Utilidades de línea de comando (`docs-check`, `thesis-import`, `ledger-order`, `scan-short`, `thesis-backfill-check`) |
| `.claude/skills/` | Skills del proyecto: `deep` (corre `/deep` con datos en vivo y sube la tesis) y `orden` (registra una compra o venta que el usuario reporta) |
| `project-docs/` | Documentos del método DIONE v4.1 |
| `research/` | Laboratorio en Python, fuera de la web (`backtest_2026_11/`, `pead_2026_11/`, `quality_2026_11/`, `smallmid_2026_11/`, `megacap_2026_11/`). Entorno propio en `research/.venv` (no se commitea) |

## PÁGINAS (módulos de la terminal)

La web se reorganizó el 16-nov-2026 alrededor del roadmap. Optimizer, Risk,
Watchlist y el Screener de navegador se retiraron: no figuran en ninguna fase.

| Ruta | Página | Qué hace |
|---|---|---|
| `/` | `Portfolio.jsx` | Cartera ficticia contra benchmarks: curva base 100, rentabilidad por plazo, sectores contra S&P 500, mandato, boleta de orden (con stop y take profit), seguimiento de cada posición desde la compra (gráfico con SL y TP, R, Sharpe, beta, distancia al stop, correlación y noticias) y libro de órdenes |
| `/performance` | `Performance.jsx` | Alfa, beta, information ratio, tracking error, Sharpe, Sortino, máxima caída, captura, retornos mensuales |
| `/market` | `Market.jsx` | Régimen (SPY contra SMA200, VIX, amplitud) y tablero de los 11 sectores |
| `/scan` | `HiddenGems.jsx` | Lee el snapshot de `/api/screener`. Solo funciona en Vercel |
| `/earnings` | `Earnings.jsx` | Fechas de resultados (EDGAR) y reacción del precio |
| `/thesis` | `Thesis.jsx` | Tracker de tesis (ver abajo). Solo lectura: las tesis entran desde Claude Code |
| `/chart` | `Chart.jsx` | Línea o velas, SMA 50/200, volumen relativo (RVOL 20 o 10), eventos y fase Wyckoff, soportes y resistencias, directrices y perfil de volumen automáticos. Si el ticker está en cartera dibuja la compra, el tramo tenido en punteado, el stop y el take profit. Acepta `?t=TICKER` |

Navegación: Alt+1…7 cambia de módulo; Ctrl+K enfoca la línea de comandos, que
acepta un módulo, un ticker (`nvda`) o una orden rápida (`buy nu 100`).

**Portafolio ficticio**: dos cuentas (paper USD 1.000.000 y real USD 5.000),
cada una con su libro de órdenes. Vive en localStorage (`dione:ledger:v1`),
igual que las carteras de referencia (Claude, Grok u otras), que se cargan a
mano porque no hay fuente automática. Con el token cargado se sincroniza con
Supabase (Fase 2.1, `src/store/useLedgerSync.js`): cada cambio se sube con la
versión que vio el navegador; si otro navegador escribió antes, la pantalla
ofrece "usar Supabase" o "subir este navegador". Nunca mezcla libros solo.
La lógica del libro vive en `lib/ledger.js` (servidor y navegador usan la misma).
Desde Claude Code, `npm run ledger:order -- buy JMKE 10 --price 100 --account real`
(`scripts/ledger-order.mjs`, `lib/ledgerOrder.js`) baja el libro, valida la orden con
las mismas reglas y lo sube con su versión; el navegador lo adopta al sincronizar.

## ENDPOINTS

| Endpoint | Qué hace |
|---|---|
| `GET /api/screener` | Filtra y rankea el snapshot precomputado. Modos `gems`, `fundamental`, `technical`, `combo`; `megacap=1` lista solo megacaps |
| `GET /api/scan` | Rewrite a `/api/screener?mode=scan`: régimen, tablero sectorial, descubrimiento (máx. 3 por sector), megacaps y marcas semanales (`lib/scanApi.js`) |
| `GET /api/sectors`, `GET /api/regime` | Rewrites a `mode=sectors` y `mode=regime`. Los calcula `refresh-technical` y quedan en `meta.market` |
| `GET /api/universe` | Rewrite a `/api/screener?mode=universe`: todas las empresas comunes de NYSE y Nasdaq (~6.000, fila `universe`) con el gate como etiqueta, lista de espera y piso de $3 y $300M. Filtros en `lib/marketUniverse.js` (`queryUniverse`). Contexto, no candidatas |
| `GET /api/screener?mode=short` | Scan short v1 (`lib/shortScan.js`, `SHORT_FRAMEWORK.md`): deterioro fundamental, tendencia rota, sector débil y valuación sobre snapshot más universo, plan con stop a 2 ATR y pares neutrales por sector. `npm run scan:short` le suma smart money y, con `--account`, la cobertura por beta de la cartera |
| `GET /api/smart-money` | Snapshot de insiders (Form 4 de EDGAR) y analistas (Finnhub, opcional). `?ticker=` para uno solo |
| `GET /api/quote/[ticker]` | Cotización vía Yahoo chart v8, sin key. Finnhub solo de respaldo si hay `FINNHUB_KEY`. Con `?news=1` devuelve titulares de Yahoo (`lib/news.js`) |
| `GET /api/candles/[ticker]` | Proxy de velas de Yahoo, sin key |
| `GET /api/healthz` | Frescura del snapshot |
| `GET /api/events?tickers=` | Últimos 8-K con ítem 2.02 de SEC EDGAR por ticker (máx. 25). Sin key |
| `GET /api/theses` | Lista de tesis. `?status=ARMADA,ABIERTA` |
| `POST /api/theses` | Importa bloques `dione-thesis-v2`. Exige `THESES_TOKEN` |
| `GET /api/theses/[id]` | Una tesis con sus marcas diarias |
| `GET /api/theses/stats` | Métricas de eficiencia (lo atiende `api/theses/[id].js`) |
| `GET /api/theses/ledger` | Libro de órdenes de las dos cuentas y carteras de referencia. Exige `THESES_TOKEN` (`lib/ledgerApi.js`) |
| `PUT /api/theses/ledger?account=paper` | Reemplaza el libro de una cuenta con control de versión (`baseVersion`). 409 si otro escribió antes |
| `PUT /api/theses/ledger?resource=benchmarks` | Guarda la lista completa de carteras de referencia |
| `PUT /api/theses/ledger?resource=macro` | Guarda la vista sectorial de `/macro` (sobre, neutral, bajo) en la fila `macro_view`. Exige token. `/api/sectors` y `/api/scan` la devuelven como `macroView` |

Los endpoints de tesis responden `{ success, data, error?, meta? }`.

**Límite a tener presente**: el plan Hobby de Vercel admite 12 funciones por
deploy y el repo ya usa las 12 (`/api/health` se borró para dar lugar a
`/api/events`). Antes de crear un archivo nuevo en `api/`, ver si cabe en una
función existente.

## CRONS (`vercel.json`, hora UTC)

| Hora | Cron | Qué hace |
|---|---|---|
| 09:00 | `refresh-gems` | Universo y fundamentales desde SEC EDGAR, precio (Finnhub + Yahoo), quality gate, preScore, percentil por sector, megacaps (`lib/universe.js`) y marcas NUEVO/SUBE/BAJA contra la fila `weekly` |
| 10:00 | `refresh-technical` | Velas de Yahoo para todos los gate-passers (más SPY y los 11 ETFs): `trendScore` v4 (`lib/trendScore.js`) y `technicalScore` v3 histórico. Corta a los 210 s; si falla más del 30% no pisa los scores previos |
| 11:00 | `refresh-smart-money` | Insiders desde el Form 4 de EDGAR (top 100, compras y ventas en mercado abierto; corta a los 110 s), analistas por Finnhub solo con key, y barrido de resultados de las últimas 5 sesiones |
| 12:00 | `refresh-universe` | Rewrite a `refresh-gems?part=universe` (`lib/universeRefresh.js`): lista de NYSE y Nasdaq de la SEC, fundamentales EDGAR, precios por Yahoo spark (20 por pedido) y sectores del cache. No toca el snapshot `latest` |
| 13:00 y 14:00 | `refresh-universe-tech-1` y `-2` | Rewrites a `refresh-technical?part=1` y `?part=2` (`lib/universeTechRefresh.js`): tendencia v4 de las invertibles fuera del snapshot de calidad, mitad cada una, en filas `universe_tech_1` y `_2`. El percentil se mide contra el universo de calidad sin entrar en él |
| 22:00 | `refresh-theses` | Tracker: reproduce cada tesis con velas de Yahoo. Sin LLM |

Todos se protegen con `Authorization: Bearer $CRON_SECRET`.

## TABLAS DE SUPABASE

| Tabla | Contenido | Quién escribe |
|---|---|---|
| `hidden_gems_snapshot` | Fila `latest` con el snapshot JSONB, `weekly` con el ranking de esta semana y la anterior, `universe` con NYSE y Nasdaq completos, `universe_tech_1/2` con su tendencia, `foreign_facts` con el cache de companyfacts, `macro_view` con la vista de `/macro` y `events` con el barrido de resultados | `refresh-gems`, `refresh-technical`, `refresh-smart-money` |
| `smart_money_snapshot` | Una fila `latest` | `refresh-smart-money` |
| `symbol_metadata` | Cache de sector e industria (`001_symbol_metadata.sql`) | `lib/finnhub.js` |
| `theses` | Una fila por tesis: bloque v2 más estado del tracker (`002_theses.sql`) | `POST /api/theses`, `refresh-theses` |
| `thesis_marks` | Una fila por tesis y día: precio, SPY, ETF sectorial, estado | `refresh-theses` |
| `ledger_accounts` | Una fila por cuenta (paper, real): capital inicial y versión (`003_transactions.sql`) | `ledger_replace()` |
| `transactions` | Una fila por movimiento del libro, en orden (`pos`). `stop` y `target` de cada compra desde `004_transaction_levels.sql` | `ledger_replace()` |
| `benchmark_portfolios` | Carteras de referencia (Claude, Grok…) con sus pesos | `PUT /api/theses/ledger` |
| `thesis_log` | Tabla vieja (v1). `002_theses.sql` migra sus filas a `theses`. Ya no se usa | nadie |

`theses`, `thesis_marks` y las tres del libro tienen RLS sin policies: solo entra la
service_role. El navegador pasa siempre por `/api/theses`.

## VARIABLES DE ENTORNO

Servidor (Vercel, y `.env.local` para desarrollo): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `THESES_TOKEN`, `SEC_USER_AGENT`.
Opcionales: `FINNHUB_KEY` (solo recomendaciones de analistas y respaldo de
precios y sectores; sin ella todo funciona), `TECHNICAL_MAX_SYMBOLS`, `SMART_MONEY_TOP_N`,
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
- `scripts/thesis-import.mjs` (`npm run thesis:import -- archivo.md`): encuentra
  los bloques en un informe, los valida en local (`lib/thesisImport.js`) y los
  sube a `POST /api/theses` con el `THESES_TOKEN` de `.env.local`. `--check`
  solo valida; si un bloque falla no se sube ninguno.
- `research/theses/`: bloques de los `/deep` corridos en Claude Code, uno por archivo.
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
8. La bandera de sector (regla 3 de vigencia) usa la vista de `/macro` que se
   carga en el módulo Mercado (fila `macro_view`, `lib/macroView.js`). Solo
   aplica a tesis emitidas con `sector_view: "OW"` y solo si la vista tiene
   menos de 60 días; sin vista vigente la regla queda inactiva.

---

## DECISIONES DE DISEÑO YA TOMADAS (no revertir sin discutir)

1. **Toda la medición va contra el S&P 500** con retorno ponderado por tiempo
   (`lib/ledger.js`, `twrIndex`), para que aportes y retiros no cuenten
   como retorno.
2. **Métricas de desempeño, no VaR**: alfa, information ratio y máxima caída
   (`src/lib/perf.js`). La pantalla avisa cuando hay menos de 60 sesiones.
3. **Sectores con look-through**: VOO, SPY, IVV, VTI y QQQ se abren en sus
   sectores. Los pesos del S&P 500 salen cada día de la ficha de SPY en SSGA
   (`lib/spyWeights.js`, cron `refresh-technical`, `spyWeights` en
   `/api/sectors`). Los de `src/lib/sectors.js` son solo respaldo; los de QQQ
   siguen siendo aproximados.
4. **Reglas de inversión**: manda `project-docs/MANDATE.md`. Los rangos por
   tramo y los topes están en `src/lib/sectors.js` (`mandateChecks`). El
   tamaño sugerido de la boleta es 1% de la cuenta dividido por el stop.
5. **El técnico no elige ganadores** (`TECHNICAL_VALIDATED.md`). El
   `technicalScore` v3 del snapshot es histórico y no decide. El ranking
   técnico (`/api/screener?mode=technical`, columna Tendencia del Scan) usa el
   `trendScore` v4. Etiqueta extra `ALCISTA` para el hueco que deja el
   documento (sobre SMA200, entre +5% y +10% de la SMA50, RSI normal).
6. **Gate con deuda sin tag** (17-nov-2026): si una empresa no reporta tags
   de deuda en XBRL y su balance cuadra, pasivos/patrimonio se usa como techo
   del D/E (la deuda no puede superar a los pasivos). Pasa el gate solo si ese
   techo ya es menor a 2 (`debtUntagged` en el snapshot). No se asume deuda cero.
   Lo mismo si solo tagea deuda corriente y no la de largo plazo (`debtPartial`):
   casi siempre significa que la de largo plazo está bajo un tag que no leemos.
   Si falta solo la corriente, se toma como cero (lo normal es que no tenga).
7. **Diseño** (16-nov-2026): terminal cuantitativa. Barra de comandos,
   módulos numerados, cinta de precios y barra de estado; negro con acento
   azul, esquinas rectas, tema claro opcional. Los colores son variables CSS en `src/index.css`;
   `src/theme.js` las expone como tokens (`C.accent` es `var(--accent)`), así
   que no se les puede concatenar transparencia: usar `C.accentSoft` y
   similares. Inter para texto, JetBrains Mono para datos y rótulos. Armazón en
   `Layout` y `components/shell/`; piezas comunes en `components/ui.jsx`. No cambiar la identidad visual sin pedirlo.
8. **Diversidad del pool** (17-nov-2026): máximo 40% de las tesis vivas en un
   mismo sector o tema (`poolDiversity` en `lib/thesisStats.js`, campo opcional
   `theme` del bloque). Se evalúa desde 3 tesis vivas. Solo avisa, no bloquea.
9. **Universo NYSE y Nasdaq** (17-nov-2026): vive aparte del scan (fila
   `universe`, vista "Mercado completo" del Scan). El gate ahí es una etiqueta;
   `/api/scan` y la vista de calidad no cambian. Una fila por CIK, sin
   preferentes, warrants ni fondos. Si el frame anual de EDGAR no trae a una
   empresa (pasó con Broadcom y Ford), se usan los datos del año anterior con
   `staleFundamentals: true`, también en el gate del scan.
   Emisores sin frames USD (IFRS como NU, TSM y SAP, o us-gaap en otra moneda
   como ASML): fundamentales de `companyfacts` en su moneda (`lib/companyFacts.js`,
   cache de 30 días en la fila `foreign_facts`). Ratios y gate sí; capitalización,
   FCF yield y P/E no, porque en un ADR precio × acciones da mal (un ADR de TSM
   son 5 acciones). Su piso de invertible es volumen diario ≥ $5M. Si informan el
   capex con un concepto propio (Toyota, Shell), el gate dice "FCF sin dato".
10. **Tendencia fuera del gate** (17-nov-2026): el percentil de momentum de las
   empresas del universo se mide contra el universo de calidad sin sumarse a
   él (`percentileAgainst`), así los trend scores de calidad no cambian. Llevan
   la bandera `fuera_validado` (en pantalla, "≈"): el v4 se validó en large caps.
   La amplitud del mercado completo sale en `/api/regime` como `breadthMarket`
   (calidad más las tandas del día); `breadthUniverse` sigue siendo solo calidad.
11. **Wyckoff del Chart** (19-nov-2026): `src/lib/wyckoff.js` sigue WYCKOFF_FRAMEWORK.md:
   RVOL contra las 20 sesiones PREVIAS, Spring (A) y (B) sin compuerta de volumen
   (seco, moderado o shakeout es solo etiqueta), Test en la primera vuelta a la zona
   con cierre en la mitad superior, invalidación por nuevo mínimo. `lib/wyckoff.js`
   (servidor) es el del `technicalScore` v3 histórico y conserva la regla vieja:
   no decide nada. Soportes, resistencias y directrices (`src/lib/levels.js`) son
   descriptivos. Stop y take profit viven en la compra (`stop`, `target`); si faltan,
   el seguimiento usa los de la tesis viva del ticker.

12. **Cortos en resistencia** (21-nov-2026): `lib/shortTiming.js` toma como referencia la resistencia más cercana encima (nivel, directriz o SMA50). Se entra a mercado solo si, con el stop medio ATR sobre esa resistencia, el primer soporte debajo paga 3R; si no hay soporte debajo (mínimos de varios meses) o no paga, orden límite en la resistencia. Bloquea si hay acumulación Wyckoff activa (Spring con mínimo intacto o clímax de venta). El deep short es el skill `short` (`.claude/skills/short/`). Lo pidió el usuario tras ver que el scan proponía shortear FLY pegado a su soporte.

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
  `/api/candles`, `/api/theses` y `/api/events`; el resto de `api/` solo corre en Vercel.
- El usuario está aprendiendo. Explicar cada cambio en dos líneas.

---

## PENDIENTES CONOCIDOS

- **Configurar `THESES_TOKEN` en Vercel producción** (20-nov-2026 `/api/theses/ledger` respondía 503 "no configurado"): sin eso no sincroniza el libro ni funcionan `ledger:order`, `thesis:import` ni `scan:short --account`.
- Scan short v1: sin short interest, días para cubrir, costo de préstamo ni Beneish (verificar en el broker). Casi todos los candidatos salen del universo con datos parciales; los del snapshot de calidad rara vez califican.
- Rotar la key de Finnhub (estuvo en texto plano en un documento ya borrado).
- Aplicar `migrations/003_transactions.sql` y después `004_transaction_levels.sql` en Supabase (sin ellas el libro, o su stop y take profit, quedan solo en el navegador).
- Earnings no cubre emisores extranjeros (6-K), como NU.
- Gate de deuda: si solo falta la deuda corriente se toma como cero; una empresa que la tenga bajo un tag no leído sale con D/E algo subestimado.
- `MEGACAPS` (`lib/universe.js`) y `GICS_OVERRIDES` (`lib/gics.js`) se mantienen a mano.
- Universo: las extranjeras no tienen capitalización (ratio de ADR). Para tenerla haría falta el ratio ADS/acción por emisor o una fuente de market cap.
- El cache de `companyfacts` se completa en varios días (unas 400 empresas por corrida).
- Fase 2.5: comparación con carteras de IA públicas. Hoy se cargan a mano; falta elegir una fuente con datos descargables.
- La vista de `/macro` se carga a mano en Mercado: el research todavía no la publica sola.
- Fase 4: solo falta el ítem 4 (medir el THESIS_LOG con 30 registros). Hechos y sin señal explotable: ítem 1, drift post-earnings en el S&P 500 (`PEAD_2026-11.md`); ítem 2, tendencia v4 y drift en S&P 400 y 600 (`SMALLMID_2026-11.md`); ítem 3, calidad por fecha de publicación (`QUALITY_2026-11.md`). `/api/events` y la tendencia son contexto; el preScore es filtro.
- Fase 5 (ML) bloqueada: la Fase 4 no encontró features con contenido (`SMALLMID_2026-11.md`).
