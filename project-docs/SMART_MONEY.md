# SMART MONEY

[CAMBIOS vs versión anterior: marcado explícitamente que `/smart-money`
(overview semanal sin ticker) está pendiente Fase 3 — alineado con
COMMANDS_status. `/smart-money TICKER` sigue funcional parcial
(insider + recs vía Finnhub auto; 13F y dark pool por paste Bloomberg).
Resto del framework (4 fuentes, score, traps) intacto.]

Tracking de capital institucional. Históricamente, seguir smart money
con metodología tiene alpha real (~6-10% anual en insider clusters,
~3-5% en 13F whale moves).

---

## ESTADO OPERATIVO

| Comando | Hoy | Por qué |
|---|---|---|
| `/smart-money TICKER` | ✅ parcial | insider transactions + recommendation drift vía Finnhub auto. 13F y dark pool requieren paste Bloomberg |
| `/smart-money` (overview) | 🔴 pendiente Fase 3 | requiere cron dedicado que agregue señales por ticker en Supabase. No existe hoy |

Mientras tanto, el overview se sustituye por: pasar manualmente la
watchlist a `/smart-money TICKER` ticker por ticker, o pegar el `HOLD`
+ `HDS` + `INSI` de Bloomberg para los nombres relevantes.

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
