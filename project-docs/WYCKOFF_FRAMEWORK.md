# WYCKOFF FRAMEWORK — Las 3 leyes + 5 fases cuantificadas

[CAMBIOS 2026-11-08: Spring y Test dejan de usar volumen como compuerta. El precio decide y el volumen clasifica. CAMBIOS 2026-11-14: Wyckoff queda como referencia descriptiva; no puntúa ni prioriza scans.]

Wyckoff es el framework técnico más profundo para entender comportamiento institucional. La mayoría de retail lo conoce superficial. DIONE lo aplica completo y cuantificado.

---

## LAS 3 LEYES DE WYCKOFF

### Ley 1 — Oferta y Demanda

**Concepto**: el precio se mueve por desequilibrio entre oferta y demanda. Identificar quién controla el mercado AHORA (Composite Operator = smart money, vs. público = retail).

**Cuantificación**:

| Indicador | Cálculo | Interpretación |
|---|---|---|
| **Dark pool ratio** | dark_pool_volume / total_volume | >40% sostenido = institucional acumulando/distribuyendo. <20% = mercado dominado por retail |
| **A/D Line slope (60 días)** | linear regression slope of cumulative (close>open?+volume:-volume) | Slope positiva con precio lateral = acumulación silenciosa |
| **% volume en up days vs down days (90 días)** | sum(volume on up days) / sum(volume on down days) | Ratio > 1.2 = demand wins. Ratio < 0.83 = supply wins |
| **Effort vs Result divergence** | (sum of |price change| / sum of volume) últimos 20 días vs 20 días previos | Si ratio sube = exhaustion. Si baja = saludable |

**Interpretación práctica**: durante una fase B de Wyckoff (acumulación), el precio se mantiene en rango pero los 4 indicadores arriba muestran que el composite operator está acumulando silenciosamente.

---

### Ley 2 — Causa y Efecto (LA MÁS IMPORTANTE Y MENOS USADA)

**Concepto**: el tiempo y amplitud de la lateralización (causa) determinan el tamaño del movimiento posterior (efecto). Wyckoff lo cuantificó con Point & Figure charts.

**Cuantificación con P&F count**:

1. Detectar el rango de lateralización (consolidación lateral por al menos 4-6 semanas)
2. Identificar el último mínimo significativo dentro del rango (post-Spring si existe, o el ST)
3. Construir P&F chart con box size apropiado:
   - Box size = 1% del precio para acciones $20-100
   - Box size = 0.5% para acciones $100-500
   - Box size = 0.25% para acciones >$500
4. Contar las cajas horizontales en la línea del último mínimo: N cajas
5. **Price target = mínimo + (N × box size × reversal)**, donde reversal = 3 típicamente

**Ejemplo**:
- Acción a $50, lateralización entre $48-$54 durante 3 meses
- Spring a $46 con volumen seco, test exitoso a $47
- P&F count en línea $47: 25 cajas (box size $0.50, reversal 3)
- Target = $47 + (25 × $0.50 × 3) = $47 + $37.5 = $84.5
- Esto sugiere movement objetivo de +80% desde el spring

**Realidad**: P&F count es target, no garantía. Es referencia para profit-taking. El movimiento puede agotarse antes (en 50-70% del target) o extenderse después.

---

### Ley 3 — Esfuerzo vs Resultado

**Concepto**: volume = esfuerzo, price movement = resultado. Divergencias entre ambos revelan información.

**Patrones a detectar**:

| Patrón | Detección | Significado |
|---|---|---|
| Mucho volumen + poco price change | volume > 1.5× promedio 20d, |price change| < 0.5× ATR | Exhaustion. Cerca de top (si en up trend) o bottom (si en down trend) |
| Poco volumen + mucho price change | volume < 0.7× promedio 20d, |price change| > 1.5× ATR | Falsa señal. Probable retest |
| Volumen creciente con tendencia | volume slope (20d) > 0, price slope (20d) > 0 | Tendencia saludable |
| Volumen decreciente con tendencia | volume slope (20d) < 0, price slope > 0 | Tendencia muriendo, riesgo de reversal |

---

## LAS 5 FASES DE ACUMULACIÓN

Wyckoff define una secuencia de eventos en suelos de mercado. DIONE detecta cada uno.

### Fase A — Stopping the Down Trend

Eventos secuenciales:

1. **PS (Preliminary Support)**: primer rebote después de bajada prolongada. Volume spike. No es el bottom todavía.
2. **SC (Selling Climax)**: capitulación. Volume extremo (>2× promedio 20d), wide range bar, price gap o long lower tail. Esto es el bottom psicológico.
3. **AR (Automatic Rally)**: rebote automático post-SC porque oferta se agotó. Define el techo del rango trading.
4. **ST (Secondary Test)**: retest del SC low con volumen menor. Si holds = phase A completed.

**Detección programática**:
- SC: bar con range > 2.5× ATR y volume > 2.5× promedio 20d en bottom de downtrend
- AR: rebote >10% en 5-15 días post-SC
- ST: retest del SC low ±5% con volume < 70% del SC volume

### Fase B — Building the Cause

Lateralización entre el AR high y el ST/SC low. Puede durar semanas a meses (acción larga = causa fuerte = efecto grande).

**Durante fase B**:
- Composite Operator acumula silenciosamente
- Multiples tests del rango (subidas hacia AR resistance, bajadas hacia ST support)
- Volume signature: A/D Line sube, OBV mejora, CMF positivo intermitente

**Detección**: ratio del rango / ATR > 6, duración > 4 semanas, A/D Line slope positiva durante el rango

### Fase C — The Test

El evento más importante para ubicar una entrada:

**Spring** (también llamado "shakeout"):
- Último intento de los bears, precio rompe por debajo del ST low
- Recovery rápido (1-5 días) por encima del support roto
- Es la trampa final para limpiar weak hands antes del markup

**Test del Spring**:
- Retest del spring low después de un rebote
- Si holds sin nuevo lower low y la vela cierra en su mitad superior → entrada confirmada
- Todo Spring exige test, incluido el de volumen seco

**Criterio único**: el precio decide y el volumen clasifica. Ningún umbral de volumen confirma ni descarta un Spring o un Test. A/D Line y CMF tampoco los vetan.

**Detector programático de Spring**:
```
nivel = min(low[t-60:t-1])  # proxy del ST low

Spring candidato si se cumple una de estas:
  (A) close[t] < nivel AND existe e en t+1..t+5 con close[e] > nivel  # rompe al cierre y recupera en 5 días
  (B) low[t] < nivel AND close[t] >= nivel, con e = t  # undercut con cierre de vuelta

spring_low = min(low[t:e])

Test válido en la primera vela j entre e+2 y e+20 que cumpla:
  max(close[e:j-1]) >= spring_low × 1.05  # hubo rebote
  AND low[j] <= spring_low × 1.05  # vuelve a la zona
  AND min(low[e+1:j]) >= spring_low  # sin nuevo lower low
  AND (close[j] - low[j]) / (high[j] - low[j]) >= 0.5  # cierra en su mitad superior

Entrada al cierre de j.
```

Si aparece un low por debajo de `spring_low` antes del test, el candidato queda invalidado. Después de la entrada manda el stop definido en `TECHNICAL_VALIDATED.md`.

La evidencia mide la primera vela que vuelve a la zona. Si esa vela cierra en su mitad inferior, el test sigue pendiente, y aceptar una vela posterior en la zona es criterio discrecional sin medir.

`nivel` es un proxy. Si el rango dura más de 60 sesiones, el ST o SC low puede quedar fuera de la ventana, así que DIONE reporta también el nivel estructural.

**Clasificación por volumen** (etiqueta para el reporte, no cambia la decisión):

| Tipo | V[t] / base | Lectura |
|---|---|---|
| Spring seco (#3) | < 0.80 | Poca oferta en la ruptura |
| Spring moderado (#2) | 0.80 a 1.50 | Oferta flotante |
| Shakeout (#1) | > 1.50 | Oferta alta, suele venir con penetración profunda |

`base` = `avg(volume[t-20:t-1])`. Si esa ventana contiene un evento que infla el volumen (earnings, emisión de acciones, investor day, rebalanceo), usar la media de las 60 sesiones previas al primer evento. Los cortes son convención para etiquetar y no están validados. Registrar en `THESIS_LOG.md` el ratio continuo del Spring y del test.

**Evidencia** (backtest propio, noviembre 2026): 60 acciones líquidas de EE. UU., enero 2011 a noviembre 2026. Exceso contra SPY a 20 sesiones; t de la diferencia agrupando por mes.

| Vela evaluada | V / media 20d | n | Exceso 20d | t dif. |
|---|---|---|---|---|
| Spring (A) | < 0.80 / ≥ 0.80 | 95 / 1,893 | +0.19% / +0.14% | 0.7 |
| Spring (B) | < 0.80 / ≥ 0.80 | 167 / 2,098 | -0.31% / +0.38% | -1.3 |
| Test | < 0.80 / ≥ 0.80 | 206 / 538 | -0.34% / +0.65% | -2.7 |

En un día cualquiera el exceso medio es +0.31%, y el conjunto de tests rinde +0.37%. Con volumen < 0.70 × media 20d en el test el resultado fue -1.07% (n=110). De 2,275 candidatos, 56.7% perdió su mínimo antes del test, 32.7% llegó a test y 17.2% llegó a test y aguantó 20 sesiones.

Límites: sobrevivientes de gran capitalización, sin filtro de Fase B, sin fricciones, dentro de muestra y con varios cortes. Alcanza para retirar el volumen como compuerta y no prueba que el volumen alto sea mejor.

Desde v4 (14-nov-2026) Wyckoff no puntúa ni prioriza scans. Esta sección sirve para leer el gráfico y ubicar el stop y la entrada límite.


### Fase D — Markup Beginning

Eventos:

1. **SOS (Sign of Strength)**: breakout del rango con volumen alto (>1.5× promedio 20d). Wide range bar, close cerca del high.
2. **LPS (Last Point of Support)**: pullback post-breakout, idealmente al breakout level o un poco por encima. Volumen bajo. Es la última oportunidad de entrada con buen R:R.

### Fase E — Markup (Tendencia Alcista)

Continuación del trend. Posibles re-acumulaciones intermedias (pequeñas fases B-C-D dentro del trend mayor).

---

## ACUMULACIÓN INVERSA — Distribución (Tops)

Las 5 fases inversas en techos:

| Acumulación (suelo) | Distribución (techo) |
|---|---|
| PS | PSY (Preliminary Supply) |
| SC | BC (Buying Climax) |
| AR | AR (igual nombre, dirección opuesta) |
| ST | ST |
| **Spring** | **UTAD (Upthrust After Distribution)** |
| Test | Test del UTAD |
| SOS | SOW (Sign of Weakness) |
| LPS | LPSY (Last Point of Supply) |

El UTAD es el "spring inverso": último impulso falso hacia arriba para atrapar bulls antes del markdown. Equivalente predictor de tops.

---

## ACTION-REACTION (Schabacker-Wyckoff)

Cada movimiento direccional genera un retracement proporcional. NO es Fibonacci.

**Reglas**:
- Movimiento principal A → B
- Retracement típico: 33%, 50%, 66% del movimiento (no los Fibonaccis)
- Después del retracement: continuación del movimiento con amplitud similar

**Uso práctico en trade plan**:
- Identifica swing high y swing low del trend reciente
- Calcula movimiento = swing_high - swing_low
- Retracement 33% → soporte fuerte (entrada con buen R:R)
- Retracement 50% → soporte clave
- Retracement 66% → invalidación de la tendencia si rompe

---

## INTEGRACIÓN CON OTROS LENTES TÉCNICOS

Wyckoff funciona mejor combinado con:

1. **Volume profile (POC, value area)**: el Spring suele ocurrir debajo del value area low del rango. El SOS suele romper el value area high.
2. **OBV / A/D Line**: confirmador de fase B (acumulación silenciosa)
3. **Bollinger Bands**: el squeeze al final de fase B precede al SOS
4. **52-week high/low context**: el SC de acumulación suele coincidir con un 52W low. El BC de distribución con un 52W high
5. **Relative strength vs sector**: si el ticker está en fase B mientras el sector está en uptrend, refuerza la tesis

---

## CÓMO USARLO EN DEEP RESEARCH

Sección "Setup Técnico + Wyckoff" del Deep Research debe incluir:

1. **Fase actual identificada** (A, B, C, D, o E)
2. **Eventos detectados con fechas y precios**: SC el [fecha] a [precio], AR el [fecha] a [precio], etc.
3. **Si fase C**: ¿se detectó spring? ¿se confirmó con test?
4. **P&F count target** (si aplica): "El rango proyecta target $X según count"
5. **Niveles clave**: SC low, ST low, AR high, breakout level, current price relative
6. **Volume signature**: A/D Line trend, OBV trend, CMF readings
7. **Trade plan**:
   - Entrada: $X (sobre cuál evento — Spring test, LPS, SOS confirmation)
   - Stop: $X (debajo del Spring low o ST low + buffer)
   - TP1: 50% del P&F count
   - TP2: 75% del P&F count
   - TP3: 100% del P&F count
   - R:R esperado: [calculado]

---

## CASOS DE INVALIDACIÓN

Si DIONE identificó una tesis Wyckoff alcista, las invalidaciones son:

1. **Nuevo lower low** después del Spring → no era Spring, era continuation de downtrend
2. **Breakout fallido**: SOS hace breakout pero pullback rompe el rango por debajo → fakeout, posible distribución
3. **Volume mismatch**: SOS o LPS con volumen muy bajo → señal débil, esperar
4. **A/D Line divergente**: precio rompiendo nuevos highs pero A/D Line bajando → distribución encubierta, salir

Cualquiera de estas invalida y dispara stop.

---

## NOTA SOBRE ELLIOTT WAVE

Elliott NO se usa como decision driver (subjetivo, data dredging). PERO sí como contexto cualitativo:

- Wave 3 de Elliott ≈ SOS de Wyckoff (trend más fuerte)
- Wave 5 de Elliott ≈ últimas etapas de fase E (cerca del top)
- Wave A-B-C de corrección ≈ formación de nueva acumulación

Si Elliott y Wyckoff coinciden en lectura, refuerza la convicción. Si discrepan, prevalece Wyckoff (más cuantificable).
