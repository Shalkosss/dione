# HUNTER MODES

[CAMBIOS vs versión anterior: agregado disclaimer al modo Técnico-Wyckoff
y al modo Combinado aclarando que el scoring técnico NO está computado
en backend (Phase B pendiente). DIONE lo computa on-the-fly desde
candles cuando ejecutás `/scan-technical` o `/scan-combo`. Resto del
framework (filtros, sub-categorías, modo Divergence, adaptación por
régimen) intacto.]

Los 3 modos de búsqueda de oportunidades + Divergence.

---

## MODO 1 — FUNDAMENTAL

**Pregunta**: "¿Cuáles son las mejores empresas del universo según
consenso de frameworks fundamentales?"

**Estado backend**: ✅ FUNCIONA. El cron precomputa el preScore
fundamental en Supabase. `/api/screener?mode=fundamental` devuelve la
shortlist real.

**Filtros mínimos**:
- Composite Fundamental Score ≥ 70/100
- Beneish M-Score < -1.78
- Altman Z-Score > 2.0
- Sector-relevant frameworks aplicados

**Output**: Top 10 ranked. Por cada uno: breakdown + 1-frase tesis +
sector + cap + price + catalyst próximo.

**Cuándo**: mercados con valoraciones bajas (post-corrección), build de
core 12-24m, macro incierto donde quality > momentum.

**Limitación**: "buenas empresas" no garantiza alpha. Cruzar con Combo.

---

## MODO 2 — TÉCNICO-WYCKOFF

**Pregunta**: "¿Cuáles tickers tienen setup técnico fuerte AHORA, sin
filtro fundamental estricto?"

> ⚠️ **DISCLAIMER PHASE B**: el scoring técnico **NO está activo en el
> backend**. El cron de hoy solo computa preScore fundamental.
> `/api/screener?mode=technical` rutea pero hoy devuelve la shortlist
> ordenada por preScore (o vacío si no hay matches). **DIONE computa
> el technical score on-the-fly** desde `/api/candles/[ticker]` para
> los candidatos relevantes cuando ejecutás `/scan-technical`. Phase B
> precomputará este scoring en Supabase.

**Filtros mínimos**:
- Composite Technical Score ≥ 70/100 (computado on-the-fly)
- Wyckoff phase identificada (no chop sin estructura)
- Volume signature positiva (OBV o A/D Line up)
- Anti-chatarra: Altman Z > 2.0, Beneish M < -1.78

**Output**: Top 10. Por cada uno: technical breakdown + Wyckoff phase y
eventos + trade plan completo + 1-frase setup + catalyst.

**Priorización Wyckoff**:
1. **Fase C confirmada** (Spring + test) — max R:R
2. **Fase B tardía** (A/D Line subiendo en lateral)
3. **Fase D** (SOS/LPS con volumen)
4. **Fase E con re-acumulación** (solo si hay consolidación en uptrend)

**Limitación**: buen setup técnico en empresa mediocre = profits cortos,
no compounding largo.

---

## MODO 3 — COMBINADO (Diamond Tier)

**Pregunta**: "¿Cuáles tickers tienen fundamentales sólidos Y setup
técnico ahora?"

> ⚠️ **DISCLAIMER PHASE B**: igual que modo Técnico. El backend hoy
> rankea por preScore fundamental; el técnico se computa on-the-fly
> sobre la shortlist cuando ejecutás `/scan-combo`. Cuando Phase B
> ranquee técnico en Supabase, este modo va a ser substancialmente más
> rápido y completo.

**Filtros**:
- Composite Fundamental ≥ 70
- Composite Technical ≥ 70
- Todos los anti-fraud / anti-bankruptcy

**Output**: Top 5-10 ranked por composite total (50/50). Breakdown +
SM score + catalyst calendar + mini-tesis 1-3-1 + recommendation.

### Sub-categorías

**Diamond Tier** — Fund ≥ 70 Y Tech ≥ 70
- Acción: entrar agresivo, sizing según conviction + Kelly
- Real: 5-15%. Paper: 10-25%.

**Wait Tier** — Fund ≥ 70, Tech < 50
- Buena empresa, mal timing. NO entrar. Watchlist con alerta cuando
  técnico mejore.

**Trader Play** — Fund < 50, Tech ≥ 80
- Oportunidad técnica corta. Sizing pequeño (max 3%). Stop estricto.
- Horizonte 1-3m máx.

---

## MODO BONUS — DIVERGENCE HUNTER

**Pregunta**: "¿Dónde hay mispricing porque los lentes están en
desacuerdo?"

**Filtro**:
- |Fund - Tech| > 30 puntos, cualquier dirección
- O: SM ≥ 80 pero ambos otros < 50

**Sub-tipos**:
1. **High fund, low tech**: quality en venta. Spring potencial.
2. **Low fund, high tech**: momentum sin fundamentals — burbuja o
   cambio narrativa.
3. **High tech, low SM**: retail rally. Blow-off top probable.
4. **Low tech, high SM**: smart money posicionándose antes del breakout.

---

## ADAPTACIÓN POR RÉGIMEN MACRO

| Régimen | Modo prioritario | Razón |
|---|---|---|
| Goldilocks | Combinado, Diamond | Multiples expanden, momentum dura |
| Reflation | Técnico, value plays | Cyclicals lideran |
| Stagflation | Fundamental (quality), defensivos | Quality protege |
| Deflation | Cash + Fundamental selectivo | Bear market |
