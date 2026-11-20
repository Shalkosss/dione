# ROADMAP — Migración a Claude Code y cambios en la web (rev. 16-nov-2026)

Especificación para trabajar el repo `Shalkosss/dione` con Claude Code. Ordenada por valor: primero lo que permite medir, después lo que cambia el scan, al final machine learning.

Stack vigente (no cambiar sin discutir): React 18 + Vite, react-router, recharts, funciones serverless en Vercel, Supabase, sin TypeScript. El `CLAUDE.md` del repo está desactualizado: dice que Thesis, Screener y Watchlist son placeholders y que no hay backend.

Flujo de trabajo: local con GitHub como fuente de verdad. Ver `FLUJO_DE_TRABAJO.md`.

---

## Fase 0 — Higiene (medio día)

1. Rotar la key de Finnhub cuando sea posible. Estuvo en texto plano en un documento del proyecto de Claude que ya se borró. No bloquea el resto.
2. Los documentos v4.1 ya vienen en `project-docs/` (se copiaron a mano desde el proyecto de Claude el 16-nov-2026, porque Claude Code no puede leer ese proyecto). Tareas: confirmar que están los 17 archivos del paquete, borrar de `project-docs/` los que quedaron obsoletos (`COMMANDS_status.md`, `SETUP_GUIDE.md`, `BACKTEST_RESULTS.md`, `READING_CANON.md`) y dejar el repo como fuente única.
3. Reescribir `CLAUDE.md` con el estado real: endpoints, tres crons, tablas de Supabase, páginas existentes, y un puntero a `project-docs/INDEX.md`.
4. Crear `research/backtest_2026_11/` con los scripts del backtest (vienen en `backtest_2026_11.zip`) y su README.
5. Confirmar que `npm run build` y los tests de `tests/` pasan.

## Fase 1 — Tracker de tesis (la prioridad)

Objetivo: que cada `/deep` quede registrado y que su estado se actualice solo todos los días.

**Datos** (Supabase)

- `theses`: los campos de `dione-thesis-v2` (ver `THESIS_LOG.md`), más `filled_at`, `fill_price`, `closed_at`, `close_price`, `close_reason`, `flags` (jsonb), `last_checked`.
- `thesis_marks`: una fila por tesis y día con `close`, `high`, `low`, `spy_close`, `sector_etf_close`, `status`. Alimenta los gráficos.
- Migrar lo que exista en `thesis_log`.

**Lógica** (`lib/thesisTracker.js`, función pura con tests)

- Entrada: tesis más velas diarias desde `last_checked`. Salida: nuevo estado, banderas, marcas.
- Transiciones y banderas tal como están en `THESIS_LOG.md`, secciones 2 y 3.
- Caso ambiguo: si el mismo día el rango toca stop y objetivo, se asume stop.
- Tests: LIMIT que se ejecuta, LIMIT que vence, invalidación antes de ejecutar, stop, TP1, salida por tiempo, earnings intermedio.

**Endpoints**

- `POST /api/theses` con token: recibe uno o varios bloques JSON v2. Sirve para pegar desde el chat y para que una sesión de Claude lo llame.
- `GET /api/theses?status=` y `GET /api/theses/[id]` con sus marcas.
- `GET /api/cron/refresh-theses`: diario a las 22:00 UTC, después del cierre. Solo lógica de precios, sin LLM.
- `GET /api/theses/stats`: métricas de la sección 6 de `THESIS_LOG.md`.

**Página Thesis**

- Tabla con estado, días, distancia a entrada, stop y objetivo, banderas.
- Gráfico por tesis: precio con líneas de entrada, stop, TP1 y objetivo, marcas de emisión, ejecución y cierre, y la curva de SPY y del ETF sectorial rebasadas a 100 en la fecha de emisión.
- Panel de eficiencia: tasa de ejecución de LIMIT, retorno perdido en expiradas, alfa por rating, convicción, sector y etiqueta de tendencia.
- Importar y exportar: se retiraron de la web el 20-nov-2026. Las tesis entran desde Claude Code (skill `deep`, `npm run thesis:import`).

Criterio de aceptación: importar 5 tesis de prueba con fechas pasadas y que el cron reconstruya sus estados correctamente contra un cálculo manual. Los 12 planes de la sección 4 de `DEEPS_BACKFILL_2026-11.md` sirven de casos de prueba con resultado conocido.

## Fase 2 — Portafolio contra benchmark

1. Tabla `transactions` (fecha, ticker, cantidad, precio, cuenta) y cálculo diario de valor de cartera. Reemplaza el estado en localStorage.
2. Retorno ponderado por tiempo contra SPY, en gráfico, con 1, 3 y 12 meses y desde inicio.
3. Pesos por sector GICS contra SPY, con la diferencia activa. Los pesos de SPY salen de las carteras publicadas de los ETFs sectoriales o de un archivo mensual.
4. Vista núcleo-satélite con los límites del `MANDATE.md` y alertas de incumplimiento, incluido el tope de 40% de tesis vivas en un mismo sector o tema.
5. Comparación con portafolios de IA públicos: adaptador por fuente que guarde posiciones, entradas, salidas y retorno a 3 y 12 meses. Falta confirmar con Rodrigo qué sitio usar y si publica datos descargables. Si no hay API, carga manual semanal de un CSV.

## Fase 3 — Scan v4.1 en el backend

1. `lib/trendScore.js`: score de estado de tendencia y etiquetas según `TECHNICAL_VALIDATED.md`, sección 4. Con tests. Retira `technicalScore` v3 del ranking, que puede quedar como campo histórico.
2. Calcularlo para todos los que pasan el gate (hoy 504) y no solo para el top 200 por preScore. MU, AMZN y COST quedaban sin score.
3. Percentil de preScore dentro del sector (`preScoreSectorPct`).
4. Arreglar `gicsSector`: hoy viene `null` en el 42% de los nombres con score. Mapear SIC a GICS en `lib/gics.js` para los faltantes.
5. Gate: tratar la deuda sin tag como cero cuando el balance cuadra, en vez de rechazar (2,726 filers con `debtToEquity` nulo).
6. Lista de megacaps (más de $200B) que entra al snapshot aunque no pase el gate, marcada `megacap: true`. Revisar por qué faltan GOOGL, META, AVGO, AMD, TSLA, V y MA.
7. `GET /api/sectors`: retornos a 1, 3, 6 y 12 meses de los 11 ETFs sectoriales y fuerza relativa contra SPY.
8. `GET /api/regime`: SPY contra SMA200, porcentaje del universo sobre su SMA200, VIX.
9. Guardar un snapshot semanal del ranking para calcular las marcas NUEVO, SUBE y BAJA.
10. `GET /api/scan`: devuelve régimen, tablero sectorial, descubrimiento en los 11 sectores con máximo 3 por sector y tablero de megacaps en una sola llamada.
11. Datos sin key: precio y cotización por Yahoo chart v8, fundamentales, insiders (Form 4) y fechas de resultados (8-K ítem 2.02) por SEC EDGAR. Finnhub queda como opcional para recomendaciones de analistas. Cuando esto esté, la key deja de ser necesaria.
12. `GET /api/events`: empresas que reportaron en las últimas 5 sesiones, con la reacción de precio, para `/scan-eventos`.

## Fase 4 — Laboratorio de research (Python, fuera de la web)

Carpeta `research/` con universo point-in-time y validación walk-forward. Tests pendientes, en este orden:

1. Drift post-earnings: sorpresa, guía y reacción de precio, con fechas de 8-K de EDGAR. Es la hipótesis del scan por eventos.
2. Señales de precio en small y mid caps (S&P 400 y 600 históricos).
3. Rentabilidad bruta y otros factores de calidad con fundamentales por fecha de publicación.
4. Análisis del THESIS_LOG cuando haya 30 registros.

Regla del laboratorio: todo resultado declara universo, periodo, sesgos y número de variantes probadas.

**Estado (18-nov-2026)**: ítems 1, 2 y 3 hechos, ninguno con señal explotable después de costos (`PEAD_2026-11.md`, `SMALLMID_2026-11.md`, `QUALITY_2026-11.md`). Falta el ítem 4, que depende de juntar 30 tesis.

## Fase 5 — Machine learning (condicionado)

**Estado (18-nov-2026): bloqueada.** La Fase 4 no encontró features con contenido en large, mid ni small caps.

Con features de precio en large caps no hay señal que aprender: el rank IC medido es cercano a cero y un modelo flexible solo ajustaría ruido. ML entra cuando la Fase 4 encuentre features con contenido.

- Objetivo: exceso de retorno a 63 sesiones contra el sector, en ranking transversal.
- Línea base obligatoria: regresión ridge con los mismos features.
- Candidato: gradient boosting (LightGBM).
- Validación: walk-forward con purga y embargo de 63 sesiones. Sin k-fold aleatorio.
- Criterio para usarlo: rank IC fuera de muestra mayor a 0.03 con t mayor a 2 en al menos 8 años, y mejora sobre la línea base después de costos. Si no lo cumple, no se despliega.
- Uso: una columna más del scan (`mlRank`). Nunca una orden automática.

**Agentes con LLM**: los repos de agentes de trading sirven de referencia de arquitectura (roles separados para macro, fundamentales, caso bajista y riesgo). En Claude Code eso se implementa como subagentes en `.claude/agents/`. Antes de adoptar algo de un repo: revisar si muestra resultados fuera de muestra, con costos y sin mirar el futuro. La mayoría son demos.

## Prompt inicial para Claude Code

```
Lee CLAUDE.md y, en project-docs/, INDEX.md, ROADMAP_CLAUDE_CODE.md,
THESIS_LOG.md, TECHNICAL_VALIDATED.md y DEEPS_BACKFILL_2026-11.md.
Los documentos v4.1 ya están en project-docs/. Ejecuta la Fase 0 y
muéstrame el diff antes de commitear. Después implementa la Fase 1 en
una rama feature/thesis-tracker: primero lib/thesisTracker.js con sus
tests, luego la migración SQL, los endpoints, el cron y al final la
página. No agregues dependencias. Corre npm run build y los tests antes
de cada commit. Explica cada cambio en dos líneas.
```
