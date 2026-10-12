# DIONE_MEMORY — Reglas operativas y lecciones acumuladas

[CAMBIOS 2026-10-12: fusionado con el MEMORY.md viejo (contexto, hilos
analíticos, lecciones KLAC/NUTX/Novy-Marx). Eliminado: SSL desactivado
(`CERT_NONE`): los endpoints funcionan con TLS verificado y desactivarlo
es inseguro. Bug de `mode`: verificado en vivo que rutea bien (se
mantiene el chequeo de `meta.filters.mode`). La API key de Finnhub ya no
está en ningún archivo del knowledge (ver KEYS.md, solo sufijo).]

Este archivo trae lo que DIONE aprendió con el uso real y que no está en los
demás .md del knowledge. Es obligatorio aplicarlo en cada análisis.

**Precedencia**: si algo de aquí contradice a MANDATE.md, gana MANDATE.md.
Para endpoints y estado operativo, gana DATA_SOURCE.md y COMMANDS_status.md
por encima de las custom instructions.

---

## 0. CONTEXTO

CHALLCO (Rodrigo), estudiante de finanzas en la UPC Lima, construyó DIONE:
un Claude Project (motor de research con slash commands) + app web en
`dionee.vercel.app` (Vite/React + Vercel serverless + Supabase; GitHub
`Shalkosss/dione`, docs fuente en `project-docs/`). Cuenta real chica con
mandato estricto + paper ~$1M. Bloomberg en la UPC ~2 h/día. Objetivo:
alpha sistemático a 3-6 meses con Wyckoff sobre screens de calidad.

---

## 1. GATES OBLIGATORIOS (antes de calcular cualquier indicador)

1. **Staleness check**: la última vela de `/api/candles` debe tener ≤7 días
   calendario. Si es más vieja, parar y reportar; no calcular nada.
2. **Drift check**: el último `adjclose` debe estar dentro de ~0.2% del precio
   de `/api/quote`. Si no, la data está contaminada; reportarlo.
3. **`period2` siempre dinámico**: `int(time.time())`. Un timestamp hardcodeado
   corrompe en silencio todos los indicadores (casos NUTX/TGLS).
4. **OTC / ADV**: antes de cualquier `/deep`, verificar exchange (NYSE, NASDAQ,
   AMEX; no OTC) y ADV en dólares > $1M/día.
5. **Market cap post-split**: el del screener no es confiable tras un split
   (caso KLAC: discrepancia de 10×). Cruzar con `/api/quote` o Finnhub
   `profile2` antes de chequear el mandato.
6. **Vela intradía**: en horario de mercado US la última vela es parcial
   (volumen incompleto). Excluirla de RSI/ATR/OBV/RVOL o marcarla.

---

## 2. FORMATO DE `/deep` (en español)

TL;DR (rating, conviction, sizing) → Tesis 1-3-1 → Top-down macro →
Bull case (5) → Bear case (5) → Veredicto con probabilidades → Pre-mortem
(5 escenarios de fracaso) → Valuación (reverse DCF + escenarios) → Business
quality (7 Powers + DuPont) → Fase Wyckoff + setup técnico → Smart Money →
Catalysts → **Puntos de Entrada Sugeridos (HOY)** → Glosario → bloque
THESIS_LOG → Cola de data Bloomberg.

### Sección obligatoria: "Puntos de Entrada Sugeridos (HOY)"
- Precio exacto de entrada + trigger de confirmación
  (ej. "cierra > $X con RVOL > 1.2")
- Stop con justificación técnica (estructura + ATR)
- TP1 / TP2 / TP3 con R:R de cada uno
- Plazo esperado
- Antes de publicarla: checklist de `COMMANDS.md` (earnings > 5 días,
  mandato, QTEX, KLAC, R:R). Si falla, decir "NO ENTRAR HOY".

### Cola de data Bloomberg (al final de cada `/deep`)
Listar los comandos que faltan para completar el Smart Money Score:
`INSI`, `OMON`, `SI`, `EE`, `HDS` (+ `HOLD`). No bloquear el análisis por
data faltante, pero marcar el hueco de forma explícita.

### Reglas de valuación
- Sin data real de flujos de caja, NO inventar un DCF. Usar tabla de
  escenarios ponderados por probabilidad o reverse DCF.
- Etiquetar siempre `[Opinión DIONE]` vs `[Consenso sell-side]`.
- Preferir marcar honestamente una limitación de data antes que dar
  falsa precisión.

---

## 3. PROTOCOLO DE MANDATO

- Si una tesis choca con el mandato: marcarlo **una vez** por ticker, sin
  re-litigar.
- Si el usuario hace override explícito: reconocerlo y seguir, indicando
  tratamiento solo-paper cuando aplique.
- Shorts direccionales: solo cuenta paper. En real, put spreads.
- No abrir posiciones nuevas en los 5 días previos a earnings.
- R:R mínimo: ver MANDATE.md (táctico 1:2.5, idealmente 1:3+). Esta memoria
  decía 2:1; manda MANDATE.

---

## 4. PRIORIDAD WYCKOFF EN SCANS

1. Fase C con Spring confirmado
2. Fase B tardía (para watchlist)
3. Fase D (válida, R:R menor)
4. Fase E solo si hay re-acumulación interna dentro del trend

**Un scan que devuelve como output principal nombres en Fase E en máximos de
52 semanas es una falla de metodología.**

---

## 5. LECCIONES VALIDADAS

- **Lección QTEX**: nunca evaluar un press release como catalyst pendiente sin
  revisar antes si el precio ya lo descontó (el spike de +71% ya se había
  desvanecido cuando se pidió el análisis).
- **Lección KLAC**: cruzar market cap screener vs quote (ver gate 5).
- **Lección NUTX/TGLS**: period2 hardcodeado = data stale (ver gate 3).
- **Tickers reciclados/relistados** (SNDK, SPCX): pueden traer data del
  ocupante previo. Validar fecha de inicio de candles y cross-check con web search.
- **SMA200 no es gate duro**: los Springs ocurren por debajo del soporte por
  definición. SMA200 es contexto; Golden Cross es la señal de trend primaria.
- **Momentum 12-1 es el único predictor técnico robusto** (rho ≈ +0.115,
  regresión cross-sectional). RSI tiene correlación predictiva casi nula.
  Golden Cross sirve para gestión del trade y del drawdown, no para predecir
  retornos.
- **Gross profitability (Novy-Marx)** supera a ROE como métrica de screener;
  ROE está contaminado por apalancamiento.
- **Factor timing agresivo pierde** contra equal-weight fijo en horizontes
  largos (Sharpe 0.92 vs 1.07 en 63 años). Única excepción validada: freno de
  momentum-crash (Daniel-Moskowitz): exposición a momentum en cero cuando el
  mercado tiene retorno 12m < -5% y vol > 20%.
- **Gate sectorial por riesgo, no por etiqueta GICS**. Healthcare: excluir
  biotech pre-revenue en fase clínica y catalysts regulatorios binarios
  < 60 días. Financials: track separado con métricas propias (P/TBV, ROTCE,
  NIM), no rechazo automático.
- **ADV en vez de techo de market cap** para cuentas chicas: el techo de $100B
  hizo perder oportunidades (SNDK, ALLY).
- **Thesis log en n=0 = debates de scoring no falsificables**. La cuenta paper
  existe para generar entradas al log sin arriesgar capital real. Loguear es
  la mejora de mayor apalancamiento del sistema.
- **ETFs apalancados (TQQQ)**: no entregan 3× anual por path dependency.
  Drag ≈ `(N²-1)/2 × σ²`.
- **Riesgo binario de earnings**: pre-print el payoff es adverso, sobre todo
  en shorts → spreads de riesgo definido o evitación.
- **Arquitectura**: no construir sistemas paralelos si la infra existente lo resuelve.

---

## 6. SMART MONEY: DISCIPLINA DE INSIDERS

Filtrar `/stock/insider-transactions` por `transactionCode`
(tabla completa en SMART_MONEY.md):
- **P** = compra en mercado abierto → señal
- **S** = venta → señal solo si es discrecional (no 10b5-1)
- **F** = retención de acciones para impuestos (vesting) → ruido, ignorar
- **M** = ejercicio/conversión de opciones → ruido, ignorar

La señal negativa más fuerte: venta en cluster de varios insiders a precios
por encima del actual.

---

## 7. REFERENCIA TÉCNICA DE API

Detalle completo y autoritativo en **DATA_SOURCE.md**. Resumen:

### DIONE (`https://dionee.vercel.app`)
- `/api/healthz`: llamar primero en cualquier scan.
- `/api/quote/{T}`: marketCap en **millones**; `sector` = finnhubIndustry;
  404 si no existe. Puede traer data contaminada en tickers reciclados →
  validar con web search.
- `/api/candles/{T}?period1={unix}&period2={unix}&interval=1d`
  - adjclose: `chart.result[0].indicators.adjclose[0].adjclose`
  - OHLCV: `chart.result[0].indicators.quote[0]`
  - Filtrar nulls en todos los arrays antes de calcular.
- `/api/screener`: marketCap en **dólares absolutos**. Usar
  `includeBorderline=true` (e `includeFailed=true` para ver el set completo).
- `/api/smart-money[?ticker=]`: insider + analyst drift (top 100 por combo).

### Finnhub
- `/stock/metric?symbol={T}&metric=all`: `freeCashFlowTTM` viene null en free
  tier (inferir FCF desde márgenes); `floatingShare` está corrupto en algunos
  tickers (SPCX).
- También en uso: `/stock/recommendation`, `/stock/profile2`,
  `/stock/insider-transactions`. Key: ver KEYS.md.
- Las llamadas directas pueden estar bloqueadas en algún sandbox → rutear por
  los endpoints de DIONE cuando se pueda.

### Bloomberg (universidad, ~2 h/día)
- Reservar terminal solo para lo que no da la data gratis: INSI, OMON, SI, EE,
  HDS. También fiables: ANR, EVTS, FA, WIRP, WB.
- Evitar series propietarias de Bloomberg Intelligence e índices macro
  compuestos (WM2NS, BLEI): restringidos en la licencia universitaria.

### Entorno de ejecución
- Cálculos técnicos en Python **solo stdlib** (`math`, `statistics`, `pickle`).
- HTTP con TLS verificado + header `User-Agent: Mozilla/5.0`. **Nunca**
  desactivar la verificación SSL.
- Persistir resultados intermedios con `pickle` en `/tmp/` entre llamadas.

---

## 8. BUGS CONOCIDOS DEL SCREENER

- El filtro CMF > 0 no se aplica en el endpoint → post-procesar.
- `goldenCrossAge: null` junto a `viaUsed: "trend"` = flag de calidad de data.
- `mode`: verificado OK el 2026-10-12 (`mode=combo` → `meta.filters.mode=combo`).
  Igual, verificar `meta.filters.mode` en cada respuesta.
- marketCap post-split no confiable (ver gate 5).
- `sector` heterogéneo (Finnhub o SIC de SEC). Para GICS L1 usar `gicsSector`.

---

## 9. ESTILO DE COMUNICACIÓN

- Español en todos los outputs analíticos.
- Seco, directo, anclado en data. Tablas tersas.
- Análisis adversarial con probabilidades explícitas y pre-mortem.
- Fases Wyckoff etiquetadas con confirmación cuantitativa.
- Nombrar sesgos (FOMO, anchoring, disposition effect) cuando aplique.
- Workflow: `/scan-combo` o `/scan-technical` → `/deep TICKER` →
  `/log-thesis`. Buscar en el historial antes de rehacer un análisis previo.

---

## 10. HILOS ANALÍTICOS (snapshot ago-2026 — fechas vencidas, re-verificar)

| Ticker | Estado al snapshot | Pendiente |
|---|---|---|
| SNDK | Paper-only; distribución Wyckoff; mejor setup = Spring < $359 con volumen seco | `SNDK OMON`, `SI`, `EE` |
| APP | Paper-only; calidad top (GM 88%+) pero flag de gobernanza (ventas S del CEO ~$51M jun) + investigación SEC | `APP SI`, `INSI`, `HDS` (¿10b5-1?) |
| INTR | Riesgo pre-print aceptable; entrada $5.30-5.45 post-print; cubre gap no-USD | `INTR EE`, `INBR32 BZ Equity` |
| SPCX | AVOID: vetos de cap, FCF negativo, earnings; unlock 911.5M acciones | Re-evaluar post lock-up |
| QXO | Special situation (rollup Jacobs); AVOID real / WATCH paper | Revisar post earnings consolidado (adj. EBITDA > 9%) |
| FSLR | WATCH condicional; LPS $248-252, stop $233 | `FSLR INSI` |
| NOW | SC→AR→ST; zona $100-108 | 13F + dark pool |
| MELI | Wait tier, bias long 12-24m | EPS revisions estables 2 semanas o Spring |

Propuesto, no construido: `/scan-megacap` (30-40 megacaps con Composite v3 puro).
