# TECHNICAL VALIDATED — Indicadores que SÍ uso y por qué descarto los demás

[CAMBIOS v3 vs v2: refactor mayor del COMPOSITE TECHNICAL SCORE y de la
filosofía de gate. SMA200 ya NO es filtro duro (estaba excluyendo
sistemáticamente las Fase C de Wyckoff, que es donde está el alpha real).
Golden Cross promovido a indicador primario de trend (mejor backtest:
46.6% win rate vs 21.3% de SMA200 naked, mismo CAGR pero menos whipsaw).
Score reestructurado en DOS vías paralelas — Trend Track y Wyckoff Track —
porque son sustitutos, no complementos. Cambios validados con backtest
propio sobre 30 tickers × 5 años (junio 2021 - junio 2026, ver
BACKTEST_RESULTS.md).]

DIONE usa SOLO indicadores con evidencia académica robusta O backtest
propio reproducible. Los demás se descartan explícitamente para evitar
data dredging y falsos signals.

---

## CAMBIO FILOSÓFICO (leer primero)

La versión anterior trataba "precio > SMA200" como gate duro para todo
modo técnico. Backtest propio demostró que esto crea un sesgo
sistemático: **excluye precisamente los setups Wyckoff Fase C (Springs),
que es donde está el alpha asimétrico**.

El nuevo framework reconoce que hay DOS modos válidos de entrar a una
acción, que son MUTUAMENTE EXCLUYENTES en el momento de la entrada:

| Vía | Cuándo entrás | Posición vs SMA200 | R:R típico | Frecuencia |
|---|---|---|---|---|
| **Trend** | Trend ya confirmado | Encima | 1:1.5 a 1:2 | Frecuente |
| **Wyckoff** | Inversión post-Spring | Debajo (al entrar) | 1:3 a 1:5 | Rara |

Un mismo ticker puede ser Trend HOY y Wyckoff hace 6 meses. Pero en un
instante dado, o estás comprando trend confirmado o reversión.
**El Composite Technical Score ahora computa AMBAS vías y reporta la
MEJOR de las dos, no el promedio**.

---

## INDICADORES VALIDADOS (los que uso)

### 1. Trend & Structure

#### Golden Cross (SMA50 > SMA200) — PRIMARIO
- **Evidencia académica**: clásica desde Granville; replicada en Faber (2007)
- **Backtest propio** (5y, 30 tickers, junio 2021 - junio 2026):
  - Win rate **46.6%** (vs 21.3% para SMA200 naked, 35.6% para SMA200+2% buffer)
  - Avg return per trade **+21.2%** (vs +4.7% naked)
  - Median hold **146 días** (match perfecto con horizonte táctico 3-6m)
  - Max drawdown **-20.7%** (vs -23.3% naked, -45.8% para buy & hold universo)
  - Sharpe 0.26 — sub-óptimo standalone, pero ÚTIL como vía paralela a Wyckoff
- **Cómo lo uso**:
  - Bullish trend confirmado: SMA50 cruzó arriba de SMA200 en últimos 60 días
  - Bearish trend confirmado: SMA50 cruzó debajo de SMA200 en últimos 60 días
  - "Cross fresco" (<30 días) es señal más fuerte que "ya cruzado hace 200 días"

#### SMA200 contextual (NO como gate duro)
- **Cómo lo uso ahora**: como CONTEXTO, no como filtro
  - Precio > SMA200 + golden cross fresco = entrada trend válida
  - Precio < SMA200 SIN Wyckoff setup = SIN señal (no entrar)
  - Precio < SMA200 CON Spring + Test confirmados = entrada Wyckoff válida
  - Precio cruzando SMA200 al alza con volumen alto = SOS confirmation potencial
- **NO uso**: "precio > SMA200" aislado como criterio de entrada. Genera whipsaw masivo (619 trades en 5y, 21% win rate)

#### Higher Highs / Lower Lows (Dow Theory)
- **Evidencia**: clásica, validada empíricamente desde Charles Dow (1900s)
- **Cómo lo uso**: identificar trend primario. Higher highs + higher lows = uptrend. Cualquier ruptura del patrón = riesgo de cambio de trend
- **Detección**: comparar swings de últimos 60, 120, 250 días

#### 52-week high/low context
- **Evidencia**: George & Hwang (2004) "The 52-Week High and Momentum Investing"
- **Cómo lo uso**: distance to 52W high como proxy de momentum sostenido. Breakouts de 52W high son entradas técnicas válidas (con confirmación de volumen)
- **Cuantificación**: sweet spot para entrada trend = -5% a +1% de 52W high con volumen confirmando

---

### 2. Momentum cuantificado

#### 12-1 month momentum (academic momentum factor)
- **Evidencia**: Jegadeesh & Titman (1993), Asness et al. (2013). Sharpe ratio standalone 0.5-0.8 en 50 años
- **Cómo lo uso**: ranking del ticker vs sector. Top quintil de momentum = momentum factor positivo
- **Cuantificación**: return(t-12months, t-1month) — excluir mes inmediato anterior

#### RSI con contexto de tendencia
- **Cómo lo uso**: solo como signal contextual, NO aislado
  - Trend up (golden cross activo): RSI < 40 = oversold pullback → considerar entrada
  - Trend down: RSI > 60 = bear bounce → no comprar
  - **En Fase C Wyckoff: RSI < 30 con divergencia bullish es señal complementaria del Spring** (el RSI no marca lower low aunque el precio sí)

#### MACD como confirmador (NO como signal entrada)
- Solo como confirmador secundario de un setup ya válido por otras lentes

---

### 3. Volume Signature

#### OBV (On-Balance Volume)
- **Evidencia**: Granville (1963), validación moderna
- **Cómo lo uso**: trend del OBV durante lateralizaciones. OBV sube + precio lateral = acumulación silenciosa (clave para Wyckoff Fase B)
- **Cuantificación**: linear regression slope de OBV últimos 60 días

#### A/D Line (Accumulation/Distribution)
- **Cómo lo uso**: divergencias A/D vs price. Si precio nuevos highs pero A/D no = distribución encubierta. Si precio nuevos lows pero A/D no = acumulación encubierta
- **NOTA del backtest**: usar A/D Line como filtro ADICIONAL sobre Wyckoff EMPEORÓ los resultados (Strategy C: -3.92% avg return vs +1.15% sin filtro). **Conclusión**: A/D Line es útil para CONFIRMAR Fase B (rango lateral con A/D subiendo) pero NO debe usarse para vetar Springs ya confirmados

#### Chaikin Money Flow (CMF)
- Lectura > +0.05 sostenida = acumulación. < -0.05 sostenida = distribución
- Bueno como filtro durante Fase B Wyckoff

#### Relative Volume (RVOL) — CRÍTICO para Wyckoff
- RVOL = volumen actual / volumen promedio 20 días
- **Spring**: RVOL < 0.85 obligatorio (volumen seco)
- **Test del Spring**: RVOL < 0.7 ideal
- **SOS (Sign of Strength)**: RVOL > 1.5 obligatorio
- **UTAD inverso (distribution)**: RVOL < 0.85 al hacer el alto falso

---

### 4. Support/Resistance (por confluencia, NO líneas arbitrarias)

#### Swing highs / swing lows
- Pivots con al menos 3 barras a cada lado. Volumen confirmador en el pivot
- Solo niveles tocados al menos 2 veces son significativos

#### Volume Profile (POC, VAH, VAL)
- POC es soporte/resistencia magnético. Breakouts del VAH con volumen son válidos. Returns al VAL son entradas potenciales

#### Confluence
- Un nivel es significativo si confluye AL MENOS 2 de:
  - Swing high/low previo
  - POC del Volume Profile
  - Round number psicológico
  - SMA50 o SMA200 (como referencia, no como signal)
  - Wyckoff event level (SC low, AR high)
  - **Soporte de años** (≥ 2 años) — magnético institucional fuerte

Niveles trazados sin confluencia = ruido, NO usar.

---

### 5. Volatilidad

#### Bollinger Band Squeeze
- BB width contraction precede a expansion (regression to vol mean)
- Squeezes al final de Fase B preceden SOS

#### ATR (Average True Range)
- **Sizing de stops dinámico**: stop generalmente 1.5× ATR debajo del entry para swing setups
- **Position sizing**: capital_per_trade = (1% portfolio) / (1.5 × ATR)
- **REGLA NUEVA**: stops basados en ATR + invalidación estructural (Spring low), NO en cross de SMA200 (los crosses generan whipsaw — backtest confirmó esto)

---

## INDICADORES DESCARTADOS (y por qué)

(sin cambios vs versión anterior; ver lista completa abajo)

### Fibonacci retracements aislados (38.2, 50, 61.8)
Bhattacharya & Kumar (2014) — niveles no funcionan mejor que niveles aleatorios. Solo útil como referencia visual cuando un Fibonacci COINCIDE con un swing previo o un POC.

### Elliott Wave como decision driver
Subjetivo, sin reglas falsificables. Solo como contexto cualitativo cuando coincide con Wyckoff.

### Candlestick patterns aislados
Marshall, Young, Rose (2006) — sin edge estadístico fuera de contexto trend.

### Gann (angles, square of nine)
Místico, sin base estadística reproducible.

### MACD aislado, Stochastic, Williams %R, Ultimate Oscillator, CCI, ADX standalone, DMA, Ichimoku
Todos: standalone Sharpe < 0.2 o derivativos sin información adicional.

### "Trend lines" diagonales trazadas a ojo
Subjetivas. Reemplazo: swing highs/lows + volume profile.

### Naked SMA200 como entrada/salida — NUEVO DESCARTE
- **Backtest propio**: 619 trades en 5y, 21.3% win rate, Sharpe 0.26
- Genera whipsaw masivo (median hold 5 días)
- Reemplazo: Golden Cross (46.6% win rate, mismo CAGR, mucho menos ruido)

---

## NUEVO COMPOSITE TECHNICAL SCORE (100 puntos total)

Estructura DOBLE VÍA: el score es el MÁXIMO de las dos vías + bonus por
condiciones que apliquen a ambas.

### Vía A — TREND TRACK (max 100)

Aplica cuando el ticker está claramente en uptrend confirmado.

| Componente | Pts máx | Cómo |
|---|---|---|
| **Golden Cross status** | 30 | Cross al alza <30d=30. Cross 30-90d=22. Cross 90-180d=15. SMA50<SMA200=0 |
| **Distance to 52W high** | 15 | -5% a +1%=15. -5% a -15%=10. -15% a -25%=5. <-25%=0 |
| **Momentum 12-1** | 15 | Top quintil sector=15. Top decil=18. Negative=0 |
| **OBV/A-D Line trend** | 15 | Slope positiva 60d en ambas=15. Una positiva=8. Ambas no-positivas=0 |
| **RSI contextual** | 10 | 40-65 saludable=10. 65-75 fuerte=8. >75 sobrecompra=2. <40 oversold (en trend)=8 |
| **Volume on breakouts** | 15 | RVOL>1.5 en última ruptura de resistencia clave=15. RVOL 1.2-1.5=8. RVOL<1=0 |

**Trend Track score** = suma. Threshold setup válido: ≥ 65/100.

### Vía B — WYCKOFF TRACK (max 100)

Aplica cuando el ticker está en una fase identificable de Wyckoff.

| Componente | Pts máx | Cómo |
|---|---|---|
| **Phase identification** | 20 | Phase C confirmada (Spring+Test)=20. Phase D (SOS+LPS)=18. Phase B tardía=12. Phase A=5. Phase E=8. No identificable=0 |
| **Spring detection** | 25 | Spring confirmado (<60d) con RVOL<0.85=25. Spring con RVOL 0.85-1.0=15. Sin Spring=0 |
| **Test confirmation** | 15 | Test del Spring <30d sin nuevo lower low + RVOL<0.7=15. Sin test todavía=0 |
| **SOS confirmation** | 15 | SOS <30d con RVOL>1.5 sobre resistencia clave=15. RVOL 1.2-1.5=8. Sin SOS=0 |
| **P&F count viability** | 10 | Target P&F >+30% del precio actual=10. +15-30%=5. <15% o no calculable=0 |
| **Volume signature en rango** | 15 | A/D Line + OBV ambos slope positivo durante lateralización=15. Uno=8. Ninguno=0 |

**Wyckoff Track score** = suma. Threshold setup válido: ≥ 65/100.

### Composite Final

```
Composite Technical Score = max(Trend Track, Wyckoff Track) + bonuses
```

**Bonuses** (aplican a ambas vías):
- +5 si ATR < 3% del precio (volatilidad razonable, stops cercanos posibles)
- +5 si liquidez > $10M ADV (entrada/salida sin slippage)
- -10 si A/D Line divergencia bearish > 30d (precio sube, A/D baja) — distribución encubierta

**Threshold para "Technical setup válido"**: Composite ≥ 70/100

---

## CUÁNDO PRIORIZAR WYCKOFF SOBRE TREND

DIONE prioriza la vía Wyckoff explícitamente en estos casos:

1. **Spring confirmado <30 días** + Test exitoso + soporte de años roto y reconquistado → R:R 1:3+ asimétrico
2. **Phase B tardía con squeeze** (BB width <20% del histórico) + A/D Line slope positiva → pre-SOS setup
3. **Reclaim del SMA200 con volumen alto** después de >60d debajo → puede ser SOS de macro-acumulación

En estos casos, aunque la vía Trend dé score bajo (porque precio aún está
debajo de SMA200), la vía Wyckoff captura el alpha y el composite usa esa.

---

## CUÁNDO EL TRACK TREND ES MÁS APROPIADO

1. **Bull market amplio** (>70% del universo con golden cross activo) — mejor seguir tendencias que pelear con springs raros
2. **Empresas de calidad sin caídas mayores** (>40% drawdown desde 52W high) en los últimos 12 meses — no hay Spring para detectar
3. **Sector con liderazgo claro** + ticker top quintil de momentum vs peers

En estos casos, Wyckoff Track dará scores bajos (sin spring, sin fase
identificable claramente) y el composite usa Trend Track.

---

## REGLAS DE STOP-LOSS (REFACTOREADAS)

**Antes (v2)**: stop genérico "1.5× ATR"

**Ahora (v3)**:

| Setup | Stop primario | Stop secundario |
|---|---|---|
| Wyckoff Spring entry | Spring low - 1.5×ATR (estructural + buffer vol) | Trail a SMA50 después de 20d en posición |
| Wyckoff SOS entry | LPS low - 1×ATR | Trail a SMA50 - 4% después de 20d |
| Trend (golden cross) | Entry - 2×ATR | Trail debajo del más reciente swing low, no de SMA200 |
| Trend (52W high breakout) | 52W high - 1.5×ATR | Trail debajo del más reciente swing low |

**REGLA DURA**: stops NO se mueven en función del cross de SMA200 (el backtest mostró que esto genera salidas prematuras por whipsaw). Stops dinámicos basados en estructura (swing lows, ATR) y SMA50, NO SMA200.

---

## CONTEXTO DEL BACKTEST QUE INFORMA ESTE FRAMEWORK

Ver `BACKTEST_RESULTS.md` para tabla completa. Highlights:

| Estrategia | Trades | Win Rate | CAGR | Max DD | Sharpe |
|---|---|---|---|---|---|
| Universe B&H (referencia) | - | - | 20.31% | -45.8% | - |
| SPY B&H (benchmark) | - | - | 13.48% | -24.5% | 0.68 |
| SMA200 naked (descartado) | 619 | 21.3% | 16.22% | -23.3% | 0.26 |
| SMA200 + 2% buffer | 261 | 35.6% | 14.93% | -24.1% | 0.25 |
| **Golden Cross (Trend Track)** | **133** | **46.6%** | **15.38%** | **-20.7%** | **0.26** |
| Wyckoff strict (raro) | 3 | 33.3% | 2.28% | -1.3% | -0.09 |
| Wyckoff loose | 32 | 50.0% | 2.59% | -5.0% | 0.02 |
| Wyckoff + A/D filter (peor) | 21 | 42.9% | 1.92% | -4.4% | -0.13 |

**Lectura clave del backtest**:
- Buy & Hold universo gana en CAGR pero con DD masivo (-46% promedio)
- Trend strategies reducen DD a la mitad (-21% a -24%) sacrificando ~5pp de CAGR
- Wyckoff puro NO compone (TIM < 5%, 32 trades en 5y × 30 tickers)
- **La síntesis útil**: usar Trend como BASE continua + Wyckoff como OPORTUNIDAD asimétrica cuando aparece. Esto es lo que captura el nuevo Composite (max de las dos vías)

**Honestidad sobre limitaciones del backtest**:
- 5 años en mercado mayoritariamente bull (2021-2026) — sesgo de muestra
- Sin frictions de borrow para shorts (no shorteamos en backtest)
- Detector de Wyckoff es algorítmico, subestima detecciones que un analista visual captaría
- 30 tickers, no es el universo completo (~6,000 EDGAR)
- Sin survivorship correction (NEM, COIN están vivos, pero ¿qué pasó con tickers que quebraron 2021-26 y no están en mi lista?)

El framework v3 NO es óptimo. Es MEJOR que v2 (que aplicaba SMA200 como gate duro), y es internamente consistente con la filosofía Wyckoff. La validación real va a venir del THESIS_LOG real (n≥20 trades documentados) en el próximo año.
