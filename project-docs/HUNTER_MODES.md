# HUNTER MODES

[CAMBIOS vs versión anterior: scoring técnico ahora es DOBLE VÍA (v3).
technicalScore = max(trendTrack, wyckoffTrack) + bonuses. Documentada la
capa borderline del scan combo (param includeBorderline=true).
2026-06: bumped top 150 → top 200 (TECHNICAL_MAX_SYMBOLS default). Spec
corregido: la componente vol-track usa OBV + ADL slope (no CMF) y la
capa borderline ahora respeta el `limit` del query.]

Los 3 modos de búsqueda de oportunidades + Divergence.

---

## MODO 1 — FUNDAMENTAL

**Pregunta**: "¿Cuáles son las mejores empresas del universo según
consenso de frameworks fundamentales?"

**Estado backend**: ✅ LIVE. El cron `refresh-gems` (09:00 UTC)
precomputa preScore + Altman Z/Z" + Piotroski + sector en Supabase.
`/api/screener?mode=fundamental` rankea por preScore.

**Cap range default**: $500M – $200B (overridable con `capMin`/`capMax`).

**Filtros mínimos**:
- Composite Fundamental Score ≥ 70/100 (preScore como proxy hoy)
- Beneish M-Score < -1.78 (no en snapshot — DIONE lo verifica on-the-fly si aplica)
- Altman Z-Score > 2.0 (campo `altmanZ` en results, modelo Z o Z")
- Sector-relevant frameworks aplicados

**Output**: Top 10 ranked. Por cada uno: breakdown + 1-frase tesis +
sector + cap + price + catalyst próximo.

**Cuándo**: mercados con valoraciones bajas (post-corrección), build de
core 12-24m, macro incierto donde quality > momentum.

**Limitación**: "buenas empresas" no garantiza alpha. Cruzar con Combo.

---

## MODO 2 — TÉCNICO-WYCKOFF

**Pregunta**: "¿Cuáles tickers tienen setup técnico fuerte AHORA?"

**Estado backend**: ✅ LIVE con scoring **doble vía v3**. El cron
`refresh-technical` (10:00 UTC) procesa el **top 200** gate-passers por
preScore (override con env `TECHNICAL_MAX_SYMBOLS`), baja 400 días de
candles de Yahoo, computa `technicalScore` (0-100), `wyckoffPhase`,
`RSI`, `CMF` y los mergea al snapshot.

### Cómo se computa el score (v3 doble vía)

```
technicalScore = max(trendTrack, wyckoffTrack) + bonuses
```

El ticker gana por su **mejor vía**, no por la suma. Un ticker en
acumulación Wyckoff puro con SMA50<SMA200 puede salir alto via Wyckoff.
Un ticker en uptrend establecido sin estructura Wyckoff clara puede salir
alto via Trend.

**VÍA A — Trend Track (máx 100)**:
- Golden Cross (30): edad del cruce SMA50↑SMA200. <30d=30, 30-90d=22, 90-180d=15
- Distance to 52W high (15): <1%=15, ≤5%=13, ≤15%=10, ≤25%=5
- Momentum 12-1 (15-18): percentil del batch. Top decile=18, top quintile=15
- OBV + ADL slope 60d (15): **ambos positivos=15, uno positivo=8, ninguno=0**.
  (Antes este campo decía "OBV/CMF": ese era el bug que subestimaba casos con
  acumulación lenta — ADL slope captura eso, CMF no.)
- RSI contextual (10): 40 ≤ rsi < 65 → 10; 65 ≤ rsi ≤ 75 → 8; >75 → 2;
  <40 con GC activo → 8 (pullback en uptrend). El boundary 65 cae en el
  bucket 65-75 (=8), no en 40-65.
- Volume on breakouts (15): RVOL día max vol últimos 30d. >1.5=15, 1.2-1.5=8

**VÍA B — Wyckoff Track (máx 100)**:
- Phase base: C+(Spring+Test)=20, D=18, B=12, A=5, E=8
- Spring <60d con RVOL<0.85 = +25
- Test <30d con RVOL<0.7 = +15
- SOS <30d con RVOL>1.5 = +15 (1.2-1.5 = +8)
- P&F count target >30% upside = +10 (15-30% = +5)
- OBV+CMF positivos durante lateralización Fase B/C = +15 (uno solo = +8).
  Nota: aquí sí se usa CMF (no ADL) — el track lateral mide compresión
  intra-rango, no slope multi-mes.

**Bonuses sobre el max**:
- +5 si ATR14 < 3% del precio (vol baja, stop más eficiente)
- +5 si ADV > $10M (liquidez para entrar/salir)
- -10 si A/D bearish divergence sostenida >30d

El field `technicalBreakdown` del response del screener tiene:
```
{ trendTrack, wyckoffTrack, composite, bonuses, viaUsed: "trend"|"wyckoff",
  goldenCrossAge, rsi, cmf, momentum12_1, wyckoffPhase }
```

**Cap range default**: $300M – $50B.

**Filtros mínimos**:
- Composite Technical Score ≥ 70/100 (`technicalScore` del snapshot)
- Wyckoff phase identificada (campo `wyckoffPhase`, no null)
- Volume signature positiva (campo `cmf` > 0 o A/D Line trending)
- Anti-chatarra heredado del gate fundamental

**Output**: Top 10. Breakdown + Wyckoff phase y eventos + trade plan +
1-frase setup + catalyst.

**Priorización Wyckoff**:
1. **Fase C confirmada** (Spring + test) — max R:R
2. **Fase B tardía** (A/D Line subiendo en lateral)
3. **Fase D** (SOS/LPS con volumen)
4. **Fase E con re-acumulación** (solo si hay consolidación en uptrend)

**Limitación**:
- Phase B procesa **top 200 por preScore** (env `TECHNICAL_MAX_SYMBOLS`).
  Si tu interés está fuera, no tiene technicalScore. Usar `/wyckoff TICKER`
  o `/deep TICKER`.
- Buen setup técnico en empresa mediocre = profits cortos, no compounding.

---

## MODO 3 — COMBINADO (Diamond Tier)

**Pregunta**: "¿Cuáles tickers tienen fundamentales sólidos Y setup
técnico ahora?"

**Estado backend**: ✅ LIVE. `comboScore = round(0.5·preScore + 0.5·technicalScore)`,
computado por `refresh-technical` y merguado al snapshot.

**Cap range default**: $1B – $100B.

**Filtros**:
- preScore ≥ 70
- technicalScore ≥ 70
- gate fundamental aplicado

**Output**: Top 5-10 ranked por `comboScore`. Breakdown + SM score +
catalyst calendar + mini-tesis 1-3-1 + recommendation.

### Capa borderline (ON por default para DIONE)

DIONE debe llamar `/scan-combo` con `includeBorderline=true`. El response
viene en dos capas:

**`results` (Capa 1 — Diamond)**: máx 8.
- `comboScore ≥ 65 AND preScore ≥ 60 AND technicalScore ≥ 60`
- Candidatos directos a `/deep`.

**`borderline` (Capa 2 — Divergence)**: cap = `max(5, limit)` del query
(antes era 5 hardcoded — dejaba afuera nombres legítimos cuando había 5+
con mejor combo). Cada uno con campo `borderlineReason` que dispara cuál
criterio matcheó (en orden):

| Reason | Criterio | Lectura |
|---|---|---|
| `fundamental fuerte, técnico deprimido` | `pre≥70 AND tech<55` | Quality en venta. Posible Wait Tier / Spring potencial |
| `técnico fuerte, fundamental marginal` | `tech≥75 AND pre<55` | Momentum sin fundamentals. Posible Trader Play / blow-off top |
| `comboScore borderline (50-64)` | `50≤combo≤64` | Cerca del threshold. Revisar antes de descartar |

DIONE debe mostrar ambas capas con el header `⚠️ BORDERLINE — revisar
con /deep antes de descartar` sobre la capa 2.

### Sub-categorías de Diamond (DIONE las asigna razonando sobre el breakdown)

**Diamond Tier** — pre ≥ 70 Y tech ≥ 70
- Acción: entrar agresivo, sizing según conviction + Kelly
- Real: 5-15%. Paper: 10-25%.

**Wait Tier** — pre ≥ 70, tech < 50 → ahora aparece en `borderline` como
"fundamental fuerte, técnico deprimido". DIONE no entra, watchlist con
alerta cuando técnico mejore.

**Trader Play** — pre < 50, tech ≥ 80 → ahora aparece en `borderline`
como "técnico fuerte, fundamental marginal". DIONE sizing pequeño
(max 3%), stop estricto, horizonte 1-3m máx.

---

## MODO BONUS — DIVERGENCE HUNTER

**Pregunta**: "¿Dónde hay mispricing porque los lentes están en
desacuerdo?"

**Filtro** (DIONE cruza scores del snapshot):
- |preScore - technicalScore| > 30 puntos, cualquier dirección
- O: SM ≥ 80 (computado on-the-fly) pero pre/tech < 50

**Sub-tipos**:
1. **High fund, low tech**: quality en venta. Spring potencial.
2. **Low fund, high tech**: momentum sin fundamentals — burbuja o cambio narrativa.
3. **High tech, low SM**: retail rally. Blow-off top probable.
4. **Low tech, high SM**: smart money posicionándose antes del breakout.

---

## VENTANA DE DEGRADACIÓN

**Única ventana conocida**: 09:00-10:00 UTC diario.

Durante esa hora:
- `refresh-gems` está regenerando el snapshot desde cero
- `technicalScore`/`comboScore` están en null hasta que `refresh-technical` corra a las 10:00
- El endpoint cae a sort por `preScore` y expone `meta.filters.sortFallback`

Fuera de esa ventana (otras 23h del día), los 3 modos operan a capacidad
completa. En Lima (UTC-5) la ventana es 04:00-05:00 AM — improbable que
te afecte.

---

## ADAPTACIÓN POR RÉGIMEN MACRO

| Régimen | Modo prioritario | Razón |
|---|---|---|
| Goldilocks | Combinado, Diamond | Multiples expanden, momentum dura |
| Reflation | Técnico, value plays | Cyclicals lideran |
| Stagflation | Fundamental (quality), defensivos | Quality protege |
| Deflation | Cash + Fundamental selectivo | Bear market |
