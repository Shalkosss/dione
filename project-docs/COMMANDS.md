# COMMANDS

[CAMBIOS vs versión anterior: agregada nota inicial apuntando a
COMMANDS_status.md para estado real (AUTO / PASTE / WEB-APP / NO EXISTE).
El resto del archivo se mantiene como referencia conceptual de qué hace
cada comando. NO duplica el status.]

> ⚠️ **VER [COMMANDS_status.md](COMMANDS_status.md) PARA ESTADO REAL
> DE CADA COMANDO** (qué corre auto vía endpoints, qué requiere paste,
> qué vive en el web app, qué todavía no existe). Este archivo describe
> la intención y output esperado de cada comando; el status es la verdad
> operativa.

Comandos slash y workflow operativo. Usar como mensaje completo.

---

## ANÁLISIS DE TICKERS

### `/deep TICKER`
Deep Research completo nivel institucional.
**Output**: TL;DR → Tesis 1-3-1 → Top-down → Bull/Bear cases → Veredicto →
Pre-mortem → Valuación → Business Quality → Setup Técnico + Wyckoff →
Smart Money → Catalysts → **Puntos de Entrada Sugeridos (HOY)** → Glosario →
bloque THESIS_LOG → Cola Bloomberg.

**Puntos de Entrada Sugeridos (HOY)** — sección obligatoria en todo `/deep`
(ver DIONE_MEMORY §2):
- Precio exacto de entrada + trigger de confirmación (ej. "cierra > $X con RVOL > 1.2")
- Stop con justificación técnica (estructura + ATR)
- TP1 / TP2 / TP3 con R:R de cada uno
- Plazo esperado

Antes de publicarla, pasar este checklist (si un ítem falla, la sección
dice "NO ENTRAR HOY" y el rating baja a WATCH):

| # | Chequeo | Regla de origen |
|---|---|---|
| 1 | Data fresca: última vela ≤ 7 días, adjclose ≈ quote (~0.2%) | DATA_SOURCE (staleness + drift) |
| 2 | Earnings a > 5 días hábiles | MANDATE / CATALYST_CALENDAR |
| 3 | Compliance de mandato + ruteo real/paper (cap, FCF, sizing, sector ≤35%) | MANDATE |
| 4 | Catalizador NO descontado (lección QTEX) | DIONE_MEMORY |
| 5 | Market cap cruzado quote vs screener (lección KLAC) | DIONE_MEMORY |
| 6 | R:R ≥ 1:2.5 con stop estructural (Spring/LPS/swing low − ATR) | MANDATE + TECHNICAL_VALIDATED |
| 7 | Insider S/P últimos 90d revisados (ignorar F/M) | SMART_MONEY |

**Cola Bloomberg** (al final de cada `/deep`, para cerrar Smart Money):
`TICKER HOLD`, `TICKER HDS`, `TICKER INSI`, `TICKER SI`, más `TICKER EE`
/ `TICKER OMON` si hay earnings u opciones relevantes.

### `/quick TICKER`
Análisis rápido en 5 párrafos.

### `/bull TICKER` / `/bear TICKER`
Solo un lado del adversarial.

### `/wyckoff TICKER`
Análisis Wyckoff aislado.

### `/fundamental TICKER`
Análisis fundamental aislado.

### `/valuation TICKER`
DCF + comparables + sum-of-parts + reverse DCF.

---

## HUNTER

### `/scan-fundamental [limit=N] [cap=...] [sector=...]`
Top N rankeado por composite fundamental score.

### `/scan-technical [limit=N]`
Top N con setups técnicos. Ver disclaimer Phase B en
[HUNTER_MODES](HUNTER_MODES.md).

### `/scan-combo [limit=N]`
Modo Combinado (Diamond + Wait + Trader). **Default recomendado.**

### `/scan-divergence`
Tickers donde fundamental y técnico están en desacuerdo significativo.

### `/hidden-gems [limit=N]`
Scan Tier-3 (small caps con gate estricto).

---

## SHORT

### `/scan-short [limit=N]`
Hunter modo Short. Ver [SHORT_FRAMEWORK](SHORT_FRAMEWORK.md). Hoy NO
existe `/api/screener?mode=short` — DIONE razona sobre watchlist +
megacaps en deterioro hasta Fase 3.

### `/short TICKER`
Deep Research bajista completo.

### `/distribution TICKER`
Wyckoff distribución aislado.

---

## MACRO + SECTORES

### `/macro`
Macro Atlas: régimen Dalio, growth/inflation, yield curve, breakevens,
dot plot, ISM/PMI, earnings aggregate, sentiment, asset allocation
táctica, sectores GICS OW/MW/UW, 3 themes 3-6m, top 3 risk events.

### `/sector-atlas`
Heatmap sectorial con insights no obvios.

### `/sector SECTOR_NAME`
Deep dive sectorial.

---

## SMART MONEY + CATALYSTS

### `/smart-money`
Overview: top tickers por SM score (insider clusters + analyst drift) vía
`GET /api/smart-money?limit=10`. LIVE (cron 11:00 UTC). 13F y dark pool
siguen por paste Bloomberg. Ver [SMART_MONEY](SMART_MONEY.md).

### `/smart-money TICKER`
Análisis SM específico (insider + recs auto; 13F + dark pool por paste).

### `/catalysts [TICKER]`
Catalyst calendar próximas 12 semanas.

---

## PORTAFOLIO + RIESGO (todo vive en web app)

### `/portfolio`
Estado actual del portafolio.

### `/portfolio-input`
Registrar/actualizar portafolio.

### `/risk-check`
Risk dashboard: vol, beta, VaR, ES, descomposición, concentración,
correlación, número efectivo, stress tests.

### `/rebalance`
Sugerencia de rebalanceo.

### `/forward-portfolio`
Forward Portfolio.

---

## OPERACIÓN DIARIA

### `/news`
News digest accionable para watchlist.

### `/morning-brief`
Brief operativo de la mañana.

### `/log-thesis TICKER`
Loguear tesis al thesis log.

### `/performance`
Hit rate + performance metrics del thesis log.

---

## UTILIDADES

`/glossary` · `/explain CONCEPT` · `/cheatsheet TOPIC` · `/help`

---

## WORKFLOW DIARIO RECOMENDADO

### Lunes
1. `/macro`
2. `/sector-atlas`
3. `/scan-combo`
4. `/catalysts`
5. `/deep` 2-3 tickers

### Martes-Jueves
- `/morning-brief` diario
- Deep Research de tickers identificados
- Bloomberg paste

### Viernes
- `/smart-money`
- `/news`
- `/performance` si hay tesis cumpliendo 30/90/180d

### Mensual
- `/performance` completo
- Revisión composite weights
- WATCHLIST update
- `/forward-portfolio` para rebalancing
