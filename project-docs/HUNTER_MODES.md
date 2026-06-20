# HUNTER MODES

[CAMBIOS vs versión anterior: REMOVIDO el disclaimer Phase B — el
scoring técnico SÍ está computado en backend por el cron
refresh-technical 10:00 UTC. Documentada solo la ventana 09-10 UTC como
única degradación esperada.]

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

**Estado backend**: ✅ LIVE. El cron `refresh-technical` (10:00 UTC)
procesa el top 150 gate-passers por preScore, baja 400 días de candles
de Yahoo, computa `technicalScore` (0-100), `wyckoffPhase`, `RSI`, `CMF`
y los mergea al snapshot.

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
- Phase B procesa **top 150 por preScore**. Si tu interés está fuera, no
  tiene technicalScore. Usar `/wyckoff TICKER` o `/deep TICKER`.
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

### Sub-categorías (DIONE las asigna razonando sobre el breakdown)

**Diamond Tier** — pre ≥ 70 Y tech ≥ 70
- Acción: entrar agresivo, sizing según conviction + Kelly
- Real: 5-15%. Paper: 10-25%.

**Wait Tier** — pre ≥ 70, tech < 50
- Buena empresa, mal timing. NO entrar. Watchlist con alerta cuando
  técnico mejore.

**Trader Play** — pre < 50, tech ≥ 80
- Oportunidad técnica corta. Sizing pequeño (max 3%). Stop estricto.
- Horizonte 1-3m máx.

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
