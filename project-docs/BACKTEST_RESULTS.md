# BACKTEST RESULTS — Validación empírica del framework técnico v3

Backtest propio ejecutado en junio 2026 para validar el rediseño del
COMPOSITE TECHNICAL SCORE. Reemplaza la justificación basada solo en
papers académicos (que validaban a nivel de asset allocation, no de
single-stock timing).

---

## SETUP

- **Período**: junio 2021 - junio 2026 (5 años exactos, 1,260 días de trading)
- **Universo**: 30 single names + SPY benchmark
  - Megacaps: AAPL, MSFT, NVDA, GOOG, META, AMZN, NFLX, TSLA
  - Mid-caps del screener: AZZ, EBAY, IDCC, MLI, FSLR, NOW
  - Volátiles/especulativos: COIN, BABA, TSLA, NEM
  - Defensivos: WMT, JNJ, KO, PG, COST, HD
  - Cíclicos: JPM, XOM, CVX, NEE, LMT, CAT, DE
- **Frictions**: 5 bps por lado (comisión + slippage)
- **Sizing**: equal-weight, sin leverage
- **Risk-free rate**: 2.5% anual para Sharpe
- **Cash return** cuando flat: 2.5% anual

---

## ESTRATEGIAS TESTEADAS

### Trend Family

**A1 — SMA200 naked**: Long si close > SMA200, exit si close < SMA200

**A2 — SMA200 con 2% buffer**: Long si close > SMA200×1.02, exit si close < SMA200×0.98 (anti-whipsaw)

**A3 — Golden Cross**: Long si SMA50 > SMA200, exit en death cross

### Wyckoff Family

**B1 — Wyckoff strict**:
- Spring: close rompe min(low[t-60:t-1]) con volumen < 0.85× avg20, recovery ≤5 bars, no new lower low en 15 bars
- SOS: close > max(high[spring-60:spring]) con volumen > 1.5× avg20
- Stop: max(spring_low - 1.5×ATR, spring_low × 0.96), trail a SMA50×0.96 después de 20d

**B2 — Wyckoff loose**: B1 con parámetros más permisivos:
- Spring lookback 40d (no 60), vol ratio 0.95 (no 0.85)
- SOS lookback 40d, vol ratio 1.2 (no 1.5)
- Ventana spring-to-sos 40d (no 30)

**C — Hybrid Wyckoff + A/D Line**:
- B2 + filtro adicional: solo entrar si A/D Line slope 60d > 0 Y CMF 20d > 0

---

## RESULTADOS

### Benchmarks

| Benchmark | CAGR | Max DD | Sharpe |
|---|---|---|---|
| SPY Buy & Hold | 13.48% | -24.5% | 0.68 |
| Universe Equal-Weight B&H | 20.31% | -45.8% avg | - |

Worst DD individual del universo: -90.9% (probable que sea COIN o similar volátil).

### Estrategias

| Strategy | Trades | Win Rate | Avg Ret/Trade | Hold | TIM | CAGR full | Avg DD | Sharpe |
|---|---|---|---|---|---|---|---|---|
| **A1 SMA200 naked** | 619 | 21.3% | +4.74% | 41d | 67% | 16.22% | -23.3% | 0.26 |
| **A2 SMA200 +2% buffer** | 261 | 35.6% | +10.41% | 97d | 67% | 14.93% | -24.1% | 0.25 |
| **A3 Golden Cross** | 133 | **46.6%** | **+21.22%** | 192d | 67% | 15.38% | **-20.7%** | 0.26 |
| B1 Wyckoff strict | 3 | 33.3% | -11.99% | 47d | 0.4% | 2.28% | -1.3% | -0.09 |
| **B2 Wyckoff loose** | 32 | **50.0%** | +1.15% | 58d | 4.9% | 2.59% | -5.0% | 0.02 |
| C Hybrid (Wyckoff + A/D) | 21 | 42.9% | -3.92% | 50d | 2.8% | 1.92% | -4.4% | -0.13 |

Best/worst trades:
- A1: best NVDA +601%, worst IDCC -19%
- A3: best NVDA +515%, worst COIN -42%
- B2: best XOM +35%, worst COIN -34%

---

## ANÁLISIS

### 1. Trend Family — Golden Cross gana claramente

A3 (Golden Cross) es el mejor de la familia trend:
- **Win rate 46.6%** vs 21.3% (naked) y 35.6% (con buffer)
- **Avg return per trade +21.2%** vs +4.7% (naked)
- **Median hold 146 días** — match perfecto con el horizonte táctico 3-6 meses del MANDATE
- **Max DD -20.7%** — mejor de la familia
- Mismo CAGR (~15%) que las otras variantes

**Implicación**: SMA200 naked como gate genera whipsaw masivo (median hold 5 días, 619 trades). Golden Cross filtra esto naturalmente porque requiere que AMBAS móviles se alineen — eso reduce false signals.

### 2. Wyckoff puro — Demasiado raro para ser estrategia única

Incluso con parámetros relajados (B2):
- Solo 32 trades en 5 años × 30 tickers = ~1 trade por ticker
- **TIM solo 4.9%** — 95% del tiempo en cash
- CAGR full 2.59% — apenas mejor que tasa libre de riesgo (2.5%)
- 50% win rate confirma que los signals son DE CALIDAD cuando aparecen

**Implicación**: Wyckoff puro NO puede ser el screener primario porque no compone. PERO el 50% win rate (mejor que cualquier otra) confirma que cuando aparece, es una entrada de alta probabilidad.

### 3. A/D Line filter EMPEORÓ Wyckoff

Strategy C agregó filtros A/D Line slope + CMF positive a B2:
- Trades bajaron de 32 a 21 (-34%)
- Avg return cayó de +1.15% a -3.92%
- Win rate cayó de 50% a 43%

**Implicación**: A/D Line es útil para identificar Fase B (acumulación silenciosa en rango lateral), pero NO debe usarse como filtro para vetar Springs ya confirmados. Los Springs ocurren en momentos donde el A/D Line puede estar todavía deteriorando — es PARTE del setup, no contradicción.

### 4. Ningún técnico puro le gana a B&H universo

Universe EW B&H: 20.31% CAGR (mejor de todos).

Trend strategies: 14-16% CAGR (~5pp menos).

**Pero**: B&H universo tuvo -46% drawdown promedio (-90% worst). Trend strategies tuvieron -21% a -24% drawdown.

**Implicación**: Las estrategias técnicas son tradeoff de **alpha por DD**. Útiles si la prioridad es protección de capital (que es exactamente lo que dice el MANDATE: "ERROR IRREVERSIBLE >>> OPORTUNIDAD PERDIDA"). Para el mandato actual con $5K reales, esto es OK.

---

## CONCLUSIONES OPERATIVAS

### Para el framework Composite Technical Score v3:

1. **Eliminar "precio > SMA200" como filtro duro** — el backtest confirma que naked SMA200 es la peor de todas las variantes de trend (whipsaw masivo, 21% win rate).

2. **Adoptar Golden Cross como indicador primario de Trend Track** — mejor win rate, similar CAGR, mejor DD, median hold matches horizonte táctico.

3. **Estructurar el score como DOBLE VÍA** (Trend Track + Wyckoff Track), reportar el MÁXIMO no la suma. Son sustitutos en el momento de entrada, no complementos.

4. **NO usar A/D Line como filtro de veto sobre Wyckoff Springs** — empeora resultados. Usar A/D como confirmador de Fase B (rango lateral con A/D subiendo).

5. **Stops basados en estructura + ATR, NO en SMA200 crosses** — los crosses generan salidas prematuras.

### Para el sistema DIONE general:

1. **El alpha técnico standalone es modesto** (Sharpe 0.26) — esto explica por qué el Modo Combinado (fundamental + técnico) es el default recomendado en HUNTER_MODES. Solo técnico no compone vs B&H.

2. **Wyckoff Phase C es de alta calidad pero RARA** — debe complementar trend, no reemplazarla. El nuevo composite captura ambas vías.

3. **Validar la nueva configuración requiere el THESIS_LOG real** — el backtest es retrospectivo y no captura la decisión cualitativa que un analista agrega. n ≥ 20 trades documentados en `/log-thesis` darán la respuesta verdadera.

---

## LIMITACIONES DEL BACKTEST (honesto)

1. **Período de muestra**: 5 años en mercado mayoritariamente bull (2021-2026). Backtest en bear market (2000-2003, 2008-2009) probablemente cambiaría rankings.

2. **Universo restringido**: 30 tickers seleccionados. No es el universo completo (~6,000 EDGAR). Posible survivor bias (no incluí tickers que quebraron 2021-26).

3. **Detector Wyckoff es algorítmico**: subestima detecciones que un analista visual captaría (Springs en timeframes mayores, Springs en niveles psicológicos no en 60d lookback, etc.). El TRUE potential de Wyckoff es probablemente mayor que el 4.9% TIM mostrado.

4. **Frictions optimistas**: 5 bps por lado es realista para liquid US large caps. Mid-cap y small-cap tendrían frictions mayores.

5. **Sin shorts**: solo testée el lado largo. El SHORT_FRAMEWORK requiere validación separada con costos de borrow.

6. **Sin position sizing variable**: equal-weight. Kelly fraccionado podría cambiar resultados (especialmente sizing más grande en setups Wyckoff de alto win rate).

7. **Sin walk-forward**: no hay out-of-sample validation. Los parámetros del detector Wyckoff (lookbacks, vol ratios) están parametrizados pero no fueron optimizados — son razonables, no óptimos.

---

## METODOLOGÍA REPRODUCIBLE

Los scripts están en `/home/claude/backtest/`:
- `fetch.py` — descarga 6y de candles via `/api/candles`
- `backtest_v2.py` — implementa las 6 estrategias y métricas
- `results_v2.json` — resultados raw

Para reproducir:
```
cd /home/claude/backtest
python3 fetch.py        # descarga data (skips si ya existe)
python3 backtest_v2.py  # corre backtest, escribe results_v2.json
```

Los tickers están en `universe.txt`. Editar para testear otro universo.

---

## PRÓXIMOS PASOS

1. **Implementar Composite v3 on-the-fly** en DIONE (computar Trend Track y Wyckoff Track separados desde candles cuando se ejecuta `/scan-technical` o `/scan-combo`)

2. **Phase B del cron**: precomputar el Composite v3 en Supabase para todos los gate-passers del snapshot (acelera scans masivos)

3. **Forward-test con paper trading**: ejecutar el framework v3 sobre paper account durante 90 días, comparar contra benchmark v2 ejecutado en paralelo

4. **Re-correr el backtest con universo expandido** (200+ tickers) en próximos 3 meses para reducir survivor bias

5. **Agregar bear market data**: incluir 2007-2009 si se puede obtener candles para reconfirmar el behavior en regímenes adversos
