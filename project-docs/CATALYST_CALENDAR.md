# CATALYST CALENDAR — Eventos que mueven precio

DIONE monitorea catalysts sistemáticamente para cada ticker en watchlist y para el universo cuando se hace scan.

---

## TIPOS DE CATALYSTS (en orden de impacto típico)

### 1. Earnings releases

**Por qué importan**: 60-70% del movimiento de precio anual de un stock individual ocurre alrededor de los 4 earnings + las 4 pre-earnings periods.

**Data a trackear**:
- Fecha exacta (BMO Before Market Open vs AMC After Market Close)
- EPS estimate del consensus + dispersión
- Revenue estimate del consensus + dispersión
- Implied move (de opciones at-the-money straddle pre-earnings)
- Historical earnings reaction (move post-earnings 4-8 últimos trimestres)
- Guidance trend (raising / lowering / in-line)

**Acción DIONE**:
- 30 días antes: alerta en `/catalysts` y en `/news` para tickers en watchlist
- 7 días antes: análisis pre-earnings (setup, expectations, what to watch)
- Día del earnings: NO posicionar nuevo (alta IV, evento binario)
- Post-earnings: análisis del reaction, ¿tesis sigue válida?

**Source**: Yahoo Finance (free), Bloomberg EVTS, Earnings Whisper para implied moves.

### 2. Management Changes

**Por qué importan**: nuevo CEO/CFO frecuentemente cambia trayectoria de empresa, especialmente en turnarounds.

**Cuándo es bullish**:
- Nuevo CEO con track record probado en industry adyacente
- Operations expert reemplazando founder en mature company
- Nuevo CFO con expertise en restructuring

**Cuándo es bearish**:
- Founder/long-term CEO sale sin sucesor claro
- Frequent CFO turnover (red flag de manipulación earnings o disclosure issues)
- "Strategic review" announced sin candidate

**Detección**: 8-K filings (SEC), news search.

### 3. Spinoffs

**Por qué importan**: empíricamente, spinoffs outperformán por ~10-15% en 24 meses (Cusatis, Miles & Woolridge 1993, replicas modernas).

**Data a trackear**:
- Anuncio de intención de spinoff
- Fecha estimada de completion
- Estructura del spin (qué entidad emerge)
- "When-issued" trading antes del spin

**Estrategia**:
- Pre-spin: comprar parent. Recibes shares del spin-off automáticamente.
- Post-spin: el spin frecuentemente cae primero (forced selling de holders que no querían el small cap), luego rallea. Entrada técnica clara.

### 4. M&A

**Por qué importan**:
- Target side: prima ~25-35% sobre precio pre-anuncio
- Acquirer side: típicamente cae corto plazo, recupera si deal accretive

**Trackear**:
- M&A rumors verificados (Bloomberg MA, Wall Street Journal, Financial Times)
- Antitrust risk (deals con regulatory issues)
- Strategic rationale (¿synergies reales o defensivo?)

**Acción DIONE**:
- Rumor verificado: análisis del strategic fit, prima implícita, probabilidad de completion
- Anuncio confirmado: cálculo del arbitrage (spread entre deal price y current price = expected return × probability completion)
- Antitrust deals: tracking de FTC/DOJ updates

### 5. Index Inclusion / Exclusion

**Por qué importan**: forced buying de ETFs pasivos cuando entra al index, forced selling al salir.

**Indices que mueven precio**:
- S&P 500 (effect histórico ~3-5%, reducido a ~1-2% últimos años)
- MSCI EM (similar)
- Russell 1000/2000 (rebalances anual junio)
- FTSE indices
- Country-specific (Brazil B3 Ibovespa, etc.)

**Predictores**:
- Market cap entrando rango target
- Profitability requirements (S&P requires 4 consecutive quarters net positive)
- Public float >= 50%
- Liquidity adequate

**Acción DIONE**: lista de candidatos cercanos a inclusion update mensualmente. NO es alpha solo, sí incremental cuando se combina con setup.

### 6. FDA Approvals (Biotech/Pharma)

**Por qué importan**: catalyst binario, movement típico ±30-70% en el día del approval/rejection.

**Data**:
- PDUFA dates (Prescription Drug User Fee Act) — fechas obligatorias FDA
- Type of approval esperado (priority review, breakthrough, accelerated, etc.)
- Advisory Committee dates (precede approval típicamente)

**Acción DIONE**: NO recomendar entrada en biotech con PDUFA inminente sin tesis fundamental clara más allá del binario. Riesgo asimétrico requiere position sizing pequeño + structured options posiblemente.

### 7. Macro Events

**Por qué importan**: mueven el mercado entero, sectores específicos.

**Events principales**:
- **Fed FOMC** (8 veces al año): rates decision + dot plot + presser
- **CPI release** (1x mes): inflation data, mueve bonds y growth stocks
- **NFP / Employment** (1x mes, primer viernes): mueve bonds, dollar
- **GDP releases** (4x año): mueve risk assets
- **PCE / Core PCE** (1x mes): Fed's preferred inflation measure
- **ISM Manufacturing / Services** (1x mes): leading indicator
- **Earnings season** (4x año): aggregate of all individual companies
- **ECB, BoJ, BoE meetings**
- **BCRP Peru** (1x mes): rate decision local
- **OPEC meetings**: mueve oil sectores

### 8. Product Launches Conocidos

**Por qué importan**: nuevos productos generan revenue + sentiment shift.

**Casos clásicos**:
- Apple iPhone events (septiembre)
- NVIDIA GTC conferences
- Tesla AI Days, Battery Days
- Healthcare conferences (JPM, ASH, ASCO, ESMO)
- CES January (electronics broad)

### 9. Quarterly Specific

**Por qué importan**: ciertos eventos recurrentes mueven sectores.

- **Tax-loss selling**: octubre-diciembre, pequeños caps suelen caer
- **January effect**: small caps suelen rallear en enero
- **Sell in May**: meme histórico, datos mixtos
- **Window dressing**: end-of-quarter institutional adjustments

---

## CATALYST SCORE (componente del Hunter)

Por ticker, 0-100:

| Componente | Puntos máx |
|---|---|
| Earnings próximos | 25 (si en <30 días + estimate trend positive) |
| Management change reciente | 15 (si nuevo CEO/CFO con track record positivo en últimos 6m) |
| Product launches conocidos | 20 (en próximos 90 días) |
| M&A rumors verificados | 15 |
| Macro tailwind sectorial | 15 |
| FDA/regulatory upcoming | 10 |

**Threshold**: Catalyst Score ≥ 50/100 = "Catalyst positive".

---

## OUTPUT DEL MÓDULO CATALYST

### `/catalysts` (overview)
- Próximas 12 semanas
- Eventos macro relevantes (Fed, CPI, NFP, etc.)
- Eventos de watchlist (earnings, anuncios)
- Eventos de universo Hunter que cambian narrativa

### `/catalysts TICKER`
- Calendar específico del ticker
- Próximos 6 meses
- Impact estimado por evento

### Pre-earnings analysis (automatic, 7 días antes)
- Setup técnico actual
- Expectations bar (consensus, whisper)
- Implied move del options market
- Historical post-earnings reaction patterns
- Pre-mortem: ¿qué escenarios de earnings invalidan la tesis?

---

## INTEGRACIÓN BLOOMBERG

Bloomberg da catalyst calendar institucional mucho más rico que sources públicos:

| Bloomberg command | Output |
|---|---|
| `TICKER EVTS <Go>` | Catalyst calendar completo |
| `TICKER EE <Go>` | Earnings estimates con dispersion |
| `TICKER ANR <Go>` | Analyst rating actions chronological |
| `ECO <Go>` | Macro economic calendar global |
| `CCAL <Go>` | Corporate calendar (earnings, conferences) |
| `FDD <Go>` | FDA decision dates |
| `MA <Go>` | M&A monitor |
| `IPO <Go>` | IPO calendar |

**Workflow Bloomberg para catalyst tracking**:
- Lunes: actualizar EVTS para toda watchlist + ECO para semana
- Pre-earnings: pegar EE + recientes EE de los 4 trimestres anteriores al Project

---

## REGLAS DE TRADING ALREDEDOR DE CATALYSTS

1. **NO posicionar nuevo en los 5 días previos a earnings** salvo opciones estructuradas
2. **Honorar stops** durante earnings — no relajar para "ver qué pasa"
3. **Post-earnings**: esperar 1-2 días para evaluar reaction antes de tomar nueva posición
4. **FDA dates**: NO posicionar a menos que tesis fundamental sea independiente del binary outcome
5. **Macro events** (FOMC, CPI): considerar reducir exposure 24h antes si volatility implícita es alta
6. **M&A target**: si comprás post-anuncio, calcular IRR del arb (spread / time to close) vs alternativas

DIONE recuerda estas reglas en cada análisis donde aplique.
