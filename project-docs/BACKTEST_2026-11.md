# BACKTEST 2026-11 — Auditoría del scan y evidencia que sustenta DIONE v4

Corrido el 14-nov-2026. Reemplaza a `BACKTEST_RESULTS.md` (junio 2026, 30 tickers) y complementa el test de Springs de `WYCKOFF_FRAMEWORK.md` (nov 2026). Usa un universo más grande y membresía point-in-time.

Los scripts (`fetch2.py`, `fetch4.py`, `bt2.py`, `bt3.py`) viven en `research/backtest_2026_11/`.

---

## 1. Radiografía del scan en vivo (snapshot del 14-nov-2026)

| Etapa | Nombres |
|---|---|
| Filers EDGAR escaneados | 6,356 |
| Pasan el quality gate | 504 |
| Reciben score técnico (top 200 por preScore) | 199 |
| technicalScore ≥ 70 | 40 |
| preScore ≥ 70 | 40 |
| Ambos ≥ 70 (Diamond) | 8 |

Hallazgos sobre 191 nombres con score técnico:

1. preScore y technicalScore no tienen correlación (Spearman −0.02). Exigir los dos por encima de 70 es multiplicar dos filtros independientes de ~20%, y por eso el combo siempre devuelve unos 8 nombres. El resultado sale de la aritmética del filtro y no de que el mercado ofrezca pocas oportunidades.
2. La vía Wyckoff decide el score en 5 de 191 casos. En 156 de 191 la fase viene `null`. La mitad del framework técnico gobierna el 3% de los resultados.
3. El componente "volumen en rupturas" promedia 14.4 de 15 puntos con desviación 2.4. Casi todos reciben el máximo, así que no discrimina. El de RSI promedia 8.6 de 10.
4. El golden cross fresco vale 30 puntos y el cruce viejo 8. Un cruce fresco implica que la acción venía de tendencia bajista hace poco. El Trend Track premia recuperaciones recientes y castiga a los líderes con tendencia larga.
5. El primer nombre del combo (RMD, combo 81) tenía momentum 12-1 de −4.2%. De los 25 mejores por score técnico, 6 tenían momentum negativo.
6. `gicsSector` viene `null` en 81 de 191 (42%). El filtro sectorial no es confiable hasta arreglarlo.
7. Fuera del snapshot por el gate o por data: GOOGL, META, AVGO, AMD, ORCL, LLY, TSLA, JPM, V, MA. Pasan el gate pero quedan sin score técnico por estar fuera del top 200 de preScore: MU, AMZN, COST. El scan no ve a buena parte de los líderes del mercado.
8. El gate rechaza a toda empresa con `debtToEquity == null` (2,726 filers con deuda nula o sin tag). Una empresa sin deuda puede quedar fuera por no reportar el tag.

## 2. Backtest de señales técnicas

**Setup**: miembros del S&P 500 point-in-time (dataset `fja05680/sp500`), enero 2012 a noviembre 2026, precios ajustados de Yahoo. Solo entra una acción en las fechas en que era miembro del índice. Evaluación mensual, 177 meses. El exceso se mide contra el promedio equal-weight del universo del mismo día.

**Advertencia de método que vale más que cualquier cifra**: la primera corrida usó los constituyentes actuales del S&P 500 y dio 32.9% de CAGR para el top 20 por momentum. Al usar membresía point-in-time bajó a 16.1% con Sharpe menor al de SPY. La diferencia completa era look-ahead: el universo actual incluye empresas que entraron al índice porque subieron. Cualquier backtest futuro de DIONE sobre "los tickers de hoy" tiene este sesgo.

### 2.1 Poder predictivo (rank IC de Spearman contra el retorno futuro)

| Señal | IC 21d | IC 63d | IC 126d | t (63d) |
|---|---|---|---|---|
| Momentum 12-1 | +0.004 | +0.009 | +0.012 | +0.34 |
| Momentum 6-1 | −0.003 | +0.008 | +0.030 | +0.39 |
| Distancia al máximo de 52 semanas | −0.005 | −0.001 | +0.012 | −0.03 |
| RSI 14 | −0.010 | −0.009 | +0.006 | −0.46 |
| Puntos de golden cross (v3) | −0.007 | +0.006 | +0.014 | +0.35 |
| Trend Track v3 (réplica sin volumen) | −0.001 | +0.005 | +0.019 | +0.23 |
| Compuesto momentum (12-1, 6-1, 52s) | −0.000 | +0.006 | +0.023 | +0.26 |

Ninguna llega a t = 2. En large caps de EE. UU., en este periodo, ninguna señal de precio simple ordena los retornos a 1, 3 o 6 meses. Esto corrige la lección anterior ("momentum 12-1 es el único predictor robusto, rho +0.115"), que venía de una muestra chica.

### 2.2 Estado de tendencia (exceso a 63 días)

| Estado | Exceso | t |
|---|---|---|
| Precio sobre SMA200 | 0.00% | −0.02 |
| Precio bajo SMA200 | −0.28% | −0.75 |
| Golden cross fresco, menos de 30 días (30 pts en v3) | −0.27% | −0.54 |
| Golden cross de 30 a 90 días | +0.10% | +0.23 |
| Golden cross de más de 180 días (8 pts en v3) | −0.56% | −1.07 |
| Top 5% del compuesto de momentum | +0.95% | +1.10 |

### 2.3 Sectores

Las acciones de los 3 sectores con mejor momentum (blend 1/3/6/12 meses) rindieron +0.50% de exceso a 63 días (t 1.04). Las de los 3 peores sectores rindieron lo mismo, +0.50% (t 1.11). El momentum sectorial mecánico no separó ganadores de perdedores en esta muestra. Una cartera limitada a los top-3 sectores tuvo Sharpe 0.63 contra 0.70 sin restricción.

En los 25 meses que empezaron con SPY bajo su SMA200, el exceso mensual medio fue: Salud −0.46%, Consumo básico −0.85%, Utilities −0.53%, Tecnología +1.86%. Los defensivos protegen durante la caída. Una vez que el índice ya perdió la SMA200, los meses siguientes suelen ser de rebote y los defensivos se quedan atrás. Muestra chica (25 meses).

### 2.4 Carteras (top 20 equal-weight, rebalanceo mensual, 10 bps por lado)

| Cartera | CAGR | Vol | Sharpe | Max DD | 2022 |
|---|---|---|---|---|---|
| SPY | 14.5% | 13.9% | 0.90 | −23.9% | −18% |
| Universo equal-weight | 13.5% | 15.1% | 0.79 | −26.9% | −11% |
| Trend Track v3, top 20 | 13.4% | 15.1% | 0.78 | −21.7% | −10% |
| Compuesto momentum, top 20 | 16.1% | 22.1% | 0.70 | −30.1% | 0% |
| Compuesto momentum, top 50 | 13.0% | 16.2% | 0.72 | −22.8% | −8% |
| Compuesto, top 20, máximo 5 por sector | 14.4% | 18.6% | 0.71 | −29.5% | −3% |
| Compuesto, solo top-3 sectores | 13.7% | 20.8% | 0.63 | −29.0% | 0% |
| Universo EW con régimen (50% si SPY < SMA200) | 11.4% | 12.4% | 0.78 | −18.7% | −13% |

Ninguna variante le gana a SPY en Sharpe. El filtro de régimen cumple su función conocida: recorta el drawdown (de −26.9% a −18.7%) a cambio de unos 2 puntos de CAGR.

## 3. Estudio de eventos: ¿comprar en soporte o sobre la SMA200?

Mismo universo. "Líder" = precio sobre SMA200, SMA200 subiendo y momentum 12-1 en el 40% superior. Plan de trade simulado: entrada al cierre, stop a 2 ATR, objetivo a 2.5R, ventana de 60 sesiones.

| Evento | n | Exceso 20d (t) | Exceso 60d (t) | Gana 2.5R | Toca stop | Sin definir | E[R] |
|---|---|---|---|---|---|---|---|
| Cualquier día de un líder | 16,036 | +0.01% (−0.7) | +0.04% (−0.2) | 31% | 63% | 7% | +0.19 |
| Pullback a la SMA50 en líder | 6,886 | +0.27% (1.3) | +0.07% (0.3) | 31% | 62% | 7% | +0.19 |
| RSI < 40 en líder | 9,121 | +0.31% (2.0) | +0.28% (0.6) | 33% | 59% | 9% | +0.31 |
| Nuevo máximo de 52 semanas en líder | 12,860 | −0.14% (−1.5) | −0.07% (−0.8) | 29% | 64% | 6% | +0.14 |
| Undercut del mínimo de 60d con cierre arriba, bajo SMA200 | 11,206 | +0.11% (0.9) | +0.17% (0.1) | 32% | 58% | 10% | +0.32 |
| Mismo evento sobre SMA200 | 3,567 | +0.11% (0.6) | +0.09% (0.3) | 33% | 57% | 11% | +0.34 |
| RSI < 30 bajo SMA200 | 9,274 | +0.01% (1.1) | 0.00% (−0.2) | 31% | 57% | 12% | +0.30 |

Lectura:

1. La diferencia entre comprar en soporte y comprar sobre la SMA200 es estadísticamente cero. Ninguna forma de entrada cambia el resultado de manera medible.
2. El único evento con t cercano a 2 es el retroceso con RSI < 40 dentro de una tendencia alcista, y solo a 20 días. Con nueve eventos probados puede ser azar. Sirve como preferencia de entrada, no como compuerta.
3. Comprar la ruptura de máximos fue lo peor del grupo, aunque sin significancia.
4. Con stop de 2 ATR y objetivo de 2.5R, seis de cada diez entradas tocan el stop antes que el objetivo, sea cual sea el setup. El E[R] positivo (+0.2 a +0.3) sale de la deriva alcista del mercado y no de la selección de entrada. Exigir más R:R no crea ventaja: baja la tasa de acierto en la misma proporción.

## 4. Lo que esta evidencia no cubre

1. Small y mid caps. La literatura encuentra primas de momentum y calidad más fuertes ahí, y el snapshot de DIONE vive en buena parte en ese rango. Falta un universo point-in-time de small caps.
2. Fundamentales, sorpresas de earnings y revisiones de estimados. El drift post-earnings es la anomalía mejor documentada a 1-3 meses y no se probó.
3. El juicio cualitativo de `/deep`. Una primera medición está en `DEEPS_BACKFILL_2026-11.md`.
4. Sesgo residual: entre 7% y 34% de los miembros históricos no tienen precio en Yahoo (adquiridas, deslistadas, tickers cambiados). La cobertura mejora de 66% en 2011 a 93% en 2022.
5. Un solo régimen largo, mayormente alcista y dominado por megacaps tecnológicas.

## 5. Consecuencias para el diseño (aplicadas en v4)

1. El score técnico deja de tratarse como predictor. Describe el estado de la tendencia y ordena la lista. No se usa como compuerta de compra.
2. Se elimina el umbral doble del combo. El fundamental filtra y el técnico ordena.
3. Wyckoff sale del score. Queda como lenguaje para ubicar stops y niveles.
4. El filtro de régimen se usa para decidir cuánto riesgo tomar, no para elegir acciones.
5. El sector entra como vista discrecional registrada en el log, porque la versión mecánica no mostró ventaja.
6. La prioridad número uno pasa a ser medir los `/deep` con el tracker.
7. Machine learning sobre features de precio en large caps no tiene de dónde aprender (IC cercano a cero). Solo tiene sentido con features nuevos y validación walk-forward. Ver `ROADMAP_CLAUDE_CODE.md`.
