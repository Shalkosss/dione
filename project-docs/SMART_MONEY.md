# SMART MONEY

[CAMBIOS 2026-10-12: `/smart-money` overview marcado LIVE (cron
`refresh-smart-money` 11:00 UTC + endpoint `/api/smart-money`, verificado
HTTP 200). Alineado con COMMANDS_status y DATA_SOURCE. Agregada tabla de
códigos Form 4. Resto del framework (4 fuentes, score, traps) intacto.]

Tracking de capital institucional. Históricamente, seguir smart money
con metodología tiene alpha real (~6-10% anual en insider clusters,
~3-5% en 13F whale moves).

---

## ESTADO OPERATIVO

| Comando | Hoy | Por qué |
|---|---|---|
| `/smart-money TICKER` | ✅ AUTO (parcial) | `GET /api/smart-money?ticker=TICKER` → `{ meta, ticker, result: { score, breakdown, insider, analyst } }`. 404 si el ticker está fuera del top 100 por comboScore (agregarlo a env `SMART_MONEY_SYMBOLS`) — en ese caso, Finnhub directo `/stock/insider-transactions` + `/stock/recommendation`. 13F, dark pool y SI: paste Bloomberg |
| `/smart-money` (overview) | ✅ AUTO | `GET /api/smart-money?limit=10&minScore=0` → top N por score. Cron `refresh-smart-money` 11:00 UTC, top 100 gate-passers por comboScore + override. Cache 10 min. 503 si el snapshot no existe |

El snapshot solo cubre insider + analyst drift (componentes Form 4 y
analyst del score). Para el SM Score completo hay que sumar 13F, dark
pool y SI desde Bloomberg (`HOLD`, `HDS`, `INSI`, `SI`).

---

## 4 FUENTES DE SMART MONEY

### 1. 13F Filings
SEC requiere a institutions con >$100M AUM reportar holdings cada Q.
Public 45 días después del Q-end.

**Limitaciones**: solo long, 45d delay, solo US equities.

**Cuándo es alpha**:
- Super-investor (track record 15%+ CAGR) entra nuevo o aumenta >30%
- Cluster: múltiples super-investors al MISMO ticker mismo Q

**Lista trackear**: Buffett, Burry, Pabrai, Klarman, Ackman, Marks,
Greenblatt, Tepper, Druckenmiller, Wood, Loeb, Icahn, Coleman, Li Lu.

### 2. Form 4 — Insider Transactions
Insiders reportan trades dentro de 2 días business.

**Evidencia**: Cohen, Malloy, Pomorski (2012) — insider buying ~6% alpha.
Cluster (3+ insiders en 30d) ~10-12% alpha.

**Señales**:

| Signal | Significado |
|---|---|
| 3+ insiders buying en 30d | Cluster — catalyst conocido internamente |
| CEO/CFO buy >$500K | Conviction top management |
| New buyers (nunca compraron) | Mejor que repeat |
| Buy en pullback técnico | Combo poderoso con Wyckoff Spring |
| Selling >50% holdings concentrado | Red flag |
| Selling intermitente schedule | Vesting/diversificación, ignorar |

**Códigos de transacción Form 4** (campo `transactionCode` en Finnhub):

| Código | Qué es | Uso |
|---|---|---|
| **P** | Compra open-market discrecional | SEÑAL — la más informativa |
| **S** | Venta open-market | SEÑAL si es discrecional (no 10b5-1) y del C-suite; pesa más a precios muy sobre el actual |
| **F** | Retención de acciones para pagar impuestos (vesting) | RUIDO — ignorar |
| **M** | Ejercicio/conversión de opciones o derivados | RUIDO — ignorar (salvo que vaya seguido de S el mismo día: tratar la S) |
| A, G, J y otros | Grants, regalos, otros | Ignorar |

Distinguir 10b5-1 vs discrecional es determinante: verificar con
Bloomberg `INSI` o la nota al pie del Form 4 en EDGAR.

### 3. Dark Pool Activity

| Métrica | Interpretación |
|---|---|
| DPI > 45% sostenido | Institutional accumulation |
| Block trade frequency creciente | Accumulation/distribution |
| Dark/Lit ratio | dark_pool_volume / total_volume |

**Limitaciones**: ~2 semanas delay, no granular, dirección difícil.

### 4. Short Interest + Days to Cover

| Patrón | Interpretación |
|---|---|
| SI > 20% float, DTC > 5 | Squeeze setup (riesgo bilateral) |
| SI ↑ + price ↑ + RSI > 70 | Shorts contra trend |
| SI ↓ + price ↑ | Smart money covering, trend sostenible |
| SI ↓ + price ↓ | Bears tomando profits |

---

## SMART MONEY SCORE (100)

| Componente | Máx | Cómo |
|---|---|---|
| 13F whale signal | 30 | +30 si 1+ super-investor aumentó >30%. +15 nuevo. +5 estable |
| Insider cluster | 25 | +25 si 3+ insiders 30d. +15 si CEO/CFO >$500K |
| Dark pool ratio | 15 | (dark_ratio - 0.20) × 50, capped 0-15 |
| Short interest dynamics | 15 | +15 si SI ↓ con price ↑ |
| Analyst drift | 15 | # analistas subiendo target en 30d |

**Threshold**: ≥ 60 = positive. ≥ 80 = bullish strong.

---

## USO EN DEEP RESEARCH

Sección obligatoria con: 13F changes últimos 4Q, insider últimos 12m,
dark pool ratio últimos 90d, SI trend 12m, analyst targets dispersion,
SM Score actual.

---

## TRAPS

1. **13F lag**: para cuando te enterás, el manager ya tuvo 60+ días de gain
2. **Selling ≠ bearish**: diversificación, divorcios, taxes
3. **Closet indexers**: muchos "smart money" funds son rebrand de S&P 500
4. **Activist intentions**: Ackman compra ≠ unlock garantizado
5. **Whale ≠ alpha**: algunos super-investors underperformed últimos años
6. **Survivorship bias**: solo se mencionan los que sobrevivieron
