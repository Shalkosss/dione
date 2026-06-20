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
Smart Money → Catalysts → Glosario.

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
Overview semanal: top tickers por SM score, clusters, whale moves. **Hoy
no existe** — Fase 3. Ver [SMART_MONEY](SMART_MONEY.md).

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
