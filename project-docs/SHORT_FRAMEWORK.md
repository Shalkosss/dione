# SHORT FRAMEWORK

[CAMBIOS vs versión anterior: eliminada toda referencia a
`/api/screener?mode=short` (no existe). `/scan-short` hoy se ejecuta
como scan manual sobre watchlist + megacaps en deterioro hasta Fase 3.
Anti-trap #9 reemplazado: "Short by analogy" eliminado por vago;
sustituido por "Short sin defensa de pre-mortem" con criterio concreto.]

Tesis bajistas con sustento estructural. Familia simétrica de los
comandos bullish.

---

## PRINCIPIO MADRE — POR QUÉ SHORTEAR ES DIFERENTE

1. **Payoff asimétrico al revés**: long pierde max 100%, short infinito
2. **Cost-to-borrow**: hard-to-borrow cobra 50-300% anualizado
3. **Squeeze risk**: covering forzado +50/+100% en días
4. **Dividend liability**: pagás el dividend del short
5. **Buy-in risk**: lender puede recall en cualquier momento

**Regla operativa**: con USD 5K reales, **NO se shortea en cuenta real**.
En paper trading (USD 1M) sí. En cuenta real, expresión vía put spreads.

---

## UNIVERSO SHORTEABLE (filtros DUROS)

Más estrictos que long:

| Filtro | Criterio | Razón |
|---|---|---|
| Market cap | > $2B USD | Liquidez de borrow |
| ADV | > $50M USD/día | Cerrar sin slippage |
| Short interest | < 15% del float | Evitar crowded |
| Days to cover | < 5 | Si todos cubren, < 1 sem |
| CTB estimado | < 10% anualizado | Carry razonable |
| Dividend yield | < 2% (preferible 0) | Evitar liability |
| Binary catalysts < 30d | NO | Adverse selection |

Típicos que pasan: **megacaps en deterioro estructural, large-caps
sobrevaluados con earnings decay**.

---

## EJECUCIÓN DEL SCAN HOY (sin endpoint dedicado)

`/api/screener` **NO tiene** `mode=short`. Hasta Fase 3, `/scan-short`
se ejecuta así:

1. **Universo de entrada**: watchlist + megacaps en deterioro
   (`/scan-fundamental` con preScore bajo + Beneish elevado, o paste
   manual desde Bloomberg `EQS` / sector screens).
2. **DIONE computa el Composite Short Score on-the-fly** sobre ese set,
   pidiendo candles y métricas vía `/api/quote` + Finnhub directo
   (`/stock/insider-transactions`, `/stock/recommendation`).
3. **Output**: top N candidatos con breakdown.

Cuando Fase 3 active el cron de short scoring (espejo del fundamental,
con Beneish + Altman + accruals + insider selling agregados), se va a
poder hacer `/api/screener?mode=short`.

---

## COMPOSITE SHORT SCORE (100)

### 1. Fundamental Deterioration (35)

| Sub | Máx | Cómo |
|---|---|---|
| Piotroski declining | 8 | F-Score < 4 Y bajó vs 12m |
| Beneish elevado | 10 | M > -1.78 = red flag |
| Altman distress | 7 | Z < 1.81 = +7 |
| Accruals alto | 5 | > 0.10 sostenido |
| DuPont negativo | 5 | ROE SOLO por leverage |

### 2. Wyckoff Distribution (25)

| Evento | Pts | Detección |
|---|---|---|
| Fase B distribución | 5 | Rango + A/D Line slope NEGATIVA |
| **UTAD + test** | 12 | High falso + RVOL < 0.8 + reversal |
| SOW | 5 | Breakdown del rango |
| LPSY | 3 | Rebote a la zona de breakdown |

**UTAD para shorts = Spring para longs**: máximo R:R.

### 3. Smart Money Negative (20)

| Sub | Máx | Cómo |
|---|---|---|
| Insider selling agresivo | 8 | 3+ vendiendo >$1M en 90d |
| 13F whale reductions | 5 | 2+ super-investors -30% |
| Dark pool distribution | 4 | DPI > 45% + price flat/neg |
| Analyst downgrade | 3 | 2+ en 30d |

### 4. Catalyst Bearish (15)

| Tipo | Máx |
|---|---|
| Guidance cuts próximos earnings | 5 |
| Debt maturity wall 12m | 4 |
| Regulatory / litigation | 3 |
| Dilution risk | 3 |

### 5. Risk / Operational (5)

- +2 SI < 5%
- +2 DTC < 3
- +1 ADV > $200M

---

## THRESHOLDS

- ≥ 65 → tesis short válida
- ≥ 80 → Diamond short
- < 65 → expresar como **avoidance**, NO short
- Fundamental Deterioration < 20 → DESCARTAR

---

## COMANDOS

### `/scan-short [limit=N]`
Top N candidatos. Hoy: scan manual descrito arriba.
Filtros opt: `cap=large|mega`, `sector=`, `phase=C` (solo UTAD).

### `/short TICKER`
Deep Research bajista completo. Espejo de `/deep`.
**Estructura**: TL;DR SHORT → Tesis Short 1-3-1 → Top-Down (régimen →
sector bear → empresa deteriorando) → Bull Case (5 pts) → Bear Case
(5 pts) → Veredicto → Pre-mortem invertido → Calidad de Earnings →
Erosión 7 Powers → Valuación inversa → Wyckoff DISTRIBUCIÓN → Trade
Plan → SM bajista → Shortability Check → Catalysts bajistas 6m → Vehículo.

### `/distribution TICKER`
Wyckoff distribución aislado.

---

## TABLA — fase a acción

| Fase distribución | Acción |
|---|---|
| Fase A (BC + AR + ST iniciales) | Watch — top no confirmado |
| Fase B (lateral post-BC, A/D ↓) | Watchlist short — alerta UTAD |
| **Fase C — UTAD + test** | **Entrada short máximo R:R** |
| Fase D — SOW | Entrada válida, R:R inferior |
| Fase E — markdown en curso | NO entrar — momentum descontado |

---

## ANTI-TRAPS

DIONE descarta automáticamente:

1. **"Está cara"** sin catalyst de deterioro
2. **"Es una burbuja"** sin UTAD ni SOW confirmado
3. **Short de quality compounder en pullback** — entrada long, no short
4. **Short de crowded short** (SI > 20%) — squeeze fuel
5. **Short post-earnings beat** sin guidance miss
6. **Short con activist value-unlock** anunciado
7. **Short con buyback authorization >10% del market cap** activo
8. **Short de target M&A rumored**
9. **Short sin pre-mortem defendible**: si DIONE no puede listar 3
   formas concretas de cómo la tesis se rompe (squeeze específico,
   catalyst bullish ignorado, mean-reversion técnica), la tesis no
   está madura. Esta verificación es independiente del score.

---

## INTEGRACIÓN BLOOMBERG

| Cmd | Output |
|---|---|
| `TICKER SI <Go>` | SI evolution + por broker |
| `TICKER INSI <Go>` | Insider selling detail |
| `TICKER CDS <Go>` | CDS spreads (leading) |
| `TICKER CRPR <Go>` | Credit profile + rating actions |
| `TICKER FA <Go>` | Calidad de earnings |
| `TICKER EE <Go>` | Estimate dispersion |
| `TICKER MOD <Go>` | Borrow rates institucionales |
| `TICKER OMON <Go>` | Options IV skew |

---

## SELF-IMPROVING (extensión THESIS_LOG)

Shorts loguean métricas extra:
- MAE (max adverse excursion)
- Carry cost realizado (días × CTB / 365)
- Squeeze events (días con +5%)
- Outcome: target / stop / squeezed / carry erosion

`/performance` extendido reporta hit rate shorts vs longs, avg return
neto de carry, holding period, squeeze frequency, Sharpe libro short.

Si Sharpe libro short < 0.5 sostenido (n ≥ 15) → **suspender shorts**,
migrar a avoidance + put spreads.

---

## RESUMEN OPERATIVO

| Pregunta | Respuesta |
|---|---|
| ¿Dónde shorteo? | Paper. En real solo put spreads |
| ¿Setup ideal? | UTAD + test + Beneish > -1.50 + insider selling + catalyst <90d |
| ¿Cuándo no? | SI > 15% / DTC > 5 / CTB > 10% / binary 30d |
| ¿Qué hago en su lugar? | Put spread / LEAPS / avoidance |
| R:R mínimo | 1:3 |
| Holding | 3-6m. >6m carry mata salvo LEAPS |
