# BLOOMBERG WORKFLOW — Cómo aprovechar las 2 horas diarias

Tener Bloomberg Terminal disponible 2 hrs/día es un superpoder que ningún retail tiene. Este documento define el workflow para extraer el máximo valor en ese tiempo.

---

## DIVISIÓN DEL TIEMPO (2 hrs diarias)

### Lunes (2 hrs) — Setup semanal
**Tiempo asignado al macro + sector heatmap + catalyst preview**

1. **Macro setup (30 min)**:
   - `ECO <Go>` — calendario macro semana
   - `SPX Index DES <Go>` — overview S&P 500
   - `BI <Go>` — Bloomberg Intelligence sector reports (rotar entre sectores)
   - `WB <Go>` — World Bond yields
   - `WCDS <Go>` — sovereign CDS

2. **Catalyst preview (30 min)**:
   - Para cada ticker en watchlist activa: `TICKER EVTS <Go>`
   - `EE <Go>` — earnings expectations próximas

3. **Sector heatmap (30 min)**:
   - `IMAP <Go>` — sector performance heatmap
   - `RV <Go>` — relative value entre sectores
   - Para 1-2 sectores de interés: `BI <sector> <Go>` — sector deep dive

4. **Workflow al Project (30 min)**:
   - Resumir hallazgos en formato pegable
   - Pasar al Project: `/macro` con data Bloomberg pegada
   - Pasar al Project: `/sector-atlas` con data Bloomberg pegada

### Martes (2 hrs) — Smart Money + Whale tracking
**Tiempo asignado a 13F + insider transactions**

1. **13F tracking (45 min)**:
   - `TICKER HOLD <Go>` para top 5 tickers de watchlist
   - `TICKER HDS <Go>` cambios trimestrales
   - `TICKER OWN <Go>` ownership analysis
   - Para super-investors: `MANAGER <Go>` portfolio overview (cuando hay disclosure)

2. **Insider transactions (45 min)**:
   - `INSI <Go>` para watchlist tickers
   - Búsqueda agresiva de cluster buys recientes
   - SI <Go> short interest evolution

3. **Workflow al Project (30 min)**:
   - Pegar data smart money al Project
   - `/smart-money TICKER` para cada uno con data fresca
   - Identificar setups para Deep Research

### Miércoles (2 hrs) — Deep Research de 1 ticker top
**Tiempo asignado a UN ticker de alta convicción**

Pre-ejecución: identificar qué ticker amerita (de scans lunes-martes + insights smart money).

Por el ticker elegido:
1. `TICKER FA <Go>` — financial analysis completo (export Excel)
2. `TICKER BEst <Go>` — consensus + dispersion estimates
3. `TICKER PEER <Go>` — peer analysis multiples
4. `TICKER WACC <Go>` — WACC institucional
5. `TICKER GP <Go>` — chart con indicadores
6. `TICKER ANR <Go>` — analyst ratings history
7. `TICKER EE <Go>` — earnings estimates con históricos
8. `TICKER SUPL <Go>` — supply chain (clientes/proveedores)
9. `TICKER NSE <Go>` — news sentiment
10. `TICKER CN <Go>` — company news últimos 30 días

Pegar TODO al Project en una sesión:
- `/deep TICKER` con Bloomberg data como contexto
- DIONE genera el Deep Research nivel institucional

### Jueves (2 hrs) — Validación + 2do Deep Research
**Tiempo asignado a un 2do ticker + validación de hipotesis**

Similar a miércoles pero para 2do ticker. Plus:
- Cross-check del Deep Research del miércoles: ¿algo cambió en 24 horas?
- Revisar analyst actions: ¿algún upgrade/downgrade que afecte tesis?

### Viernes (2 hrs) — Recap semana + planning
**Tiempo asignado a review + portfolio level**

1. **Recap semanal (30 min)**:
   - `IMAP <Go>` — sectores winners/losers semana
   - `WEI <Go>` — global indices
   - Watchlist: cómo cerró cada ticker, hits to stops o targets

2. **Portfolio review (45 min)**:
   - `PORT <Go>` si tenés portafolio cargado
   - `RVF <Go>` risk factor decomposition
   - `BBT <Go>` backtest si aplica

3. **Próxima semana planning (30 min)**:
   - `CCAL <Go>` corporate calendar próxima semana
   - `ECO <Go>` macro events próxima semana
   - Identificar 2-3 tickers para Deep Research siguiente miércoles/jueves

4. **Workflow al Project (15 min)**:
   - `/news` con highlights semana
   - `/performance` review del thesis log si aplica
   - `/portfolio` update si cambió composición

---

## COMANDOS BLOOMBERG ESENCIALES POR FUNCIÓN

### Para Deep Research de un ticker

| Comando | Output |
|---|---|
| `TICKER DES <Go>` | Description y business overview |
| `TICKER FA <Go>` | Financial Analysis (income, balance, cashflow) 10y |
| `TICKER FA AS <Go>` | Asset side balance sheet detail |
| `TICKER FA LS <Go>` | Liability side detail |
| `TICKER ER <Go>` | Earnings history |
| `TICKER EE <Go>` | Earnings estimates + dispersion |
| `TICKER BEst <Go>` | Bloomberg consensus estimates |
| `TICKER ANR <Go>` | Analyst recommendations history |
| `TICKER TP <Go>` | Target prices distribution |
| `TICKER PEER <Go>` | Peer multiples comparison |
| `TICKER WACC <Go>` | WACC computation |
| `TICKER DDM <Go>` | Dividend discount model |
| `TICKER EVTS <Go>` | Events calendar |
| `TICKER CN <Go>` | Company news |
| `TICKER NSE <Go>` | News sentiment engine |
| `TICKER SUPL <Go>` | Supply chain |
| `TICKER CSR <Go>` | ESG / corporate responsibility |
| `TICKER CRPR <Go>` | Credit profile (ratings, CDS) |

### Para Smart Money

| Comando | Output |
|---|---|
| `TICKER HOLD <Go>` | Top holders actualizados |
| `TICKER HDS <Go>` | Holdings changes detail |
| `TICKER OWN <Go>` | Ownership concentration |
| `TICKER INSI <Go>` | Insider transactions |
| `TICKER SI <Go>` | Short interest |
| `TICKER BB <Go>` | Buy-back history |
| `TICKER COT <Go>` | CFTC positioning (si hay futuros relacionados) |

### Para Technical/Wyckoff

| Comando | Output |
|---|---|
| `TICKER GP <Go>` | Chart con indicadores configurables |
| `TICKER GPC <Go>` | Comparison chart |
| `TICKER GIP <Go>` | Intraday chart |
| `TICKER MOST <Go>` | Most active stocks (volume) |
| `TICKER VAP <Go>` | Volume at price (volume profile) |
| `TICKER TAS <Go>` | Trade analysis |

### Para Macro

| Comando | Output |
|---|---|
| `ECO <Go>` | Economic calendar global |
| `ECST <Go>` | Economic statistics |
| `FED <Go>` | Federal Reserve data |
| `WIRP <Go>` | World Interest Rate Probability |
| `FFIP <Go>` | Fed Funds Implied Probability |
| `BTMM <Go>` | Treasury markets monitor |
| `GC <Go>` | Generic comm prices |
| `WB <Go>` | World Bond Markets |

### Para Sector / Industry

| Comando | Output |
|---|---|
| `BI <Go>` | Bloomberg Intelligence (sector deep dives) |
| `IMAP <Go>` | Industry/sector performance heatmap |
| `RV <Go>` | Relative value table |
| `BCMS <Go>` | Bloomberg Commodity Markets |
| `IIM <Go>` | Industry indicator monitors |

### Para M&A / Eventos

| Comando | Output |
|---|---|
| `MA <Go>` | M&A monitor |
| `IPO <Go>` | IPO calendar |
| `MERS <Go>` | M&A search |
| `DOCS <Go>` | SEC filings access |
| `EE <Go>` | Earnings estimates |

---

## CÓMO PEGAR DATA BLOOMBERG AL PROJECT

Bloomberg permite exportar a Excel (CTRL+SHIFT+E) o copy/paste directamente.

**Formato recomendado para pegar al Project**:

```
[BLOOMBERG DATA — TICKER — DATE/TIME]

[Pegar tabla o screenshot transcribido]

Comando: TICKER XYZ <Go>
```

DIONE entiende cualquier formato pero lo prefiere estructurado. Para Excel exports, pegar como markdown table cuando sea posible.

---

## REGLAS DE USO BLOOMBERG

1. **Priorizar quality over quantity**: mejor 1 ticker bien analizado con Bloomberg full data que 5 a medias
2. **No duplicar lo que Yahoo da bien**: precios actuales, ratios básicos — Yahoo es suficiente. Bloomberg es para estimates, dispersion, holdings, BI reports
3. **Export y guardar**: si Bloomberg da data importante, exportar a Excel y subir al Project. La data persiste sesión a sesión.
4. **Usar BI reports agresivamente**: son nivel research institucional. Para cualquier sector que te interese, leer el último BI report mensual

---

## LO QUE BLOOMBERG ROMPE FRENTE A YAHOO

| Aspect | Yahoo | Bloomberg | Diferencia clave |
|---|---|---|---|
| Precio actual | ✓ delayed 15min | ✓ real-time | Bloomberg más rápido |
| Fundamentales básicos | ✓ | ✓ | Bloomberg más limpio histórico |
| Analyst estimates | Mean only | Full distribution + dispersion + por analista | Bloomberg infinitamente superior |
| Holdings | Top 10 institutional | Top 50+ con changes Q-by-Q | Bloomberg es 13F en steroids |
| Insider transactions | Yes, basic | Yes, detailed con context | Bloomberg agrega quien-when-why |
| Short interest | Lagged | Real-time + por broker | Bloomberg ventana mucho más fresca |
| Bond data | Limited | Full bond pricing + spreads | Bloomberg es dominante |
| Sell-side research | Headlines only | Full reports embedded | Bloomberg = research mall |
| Macro data | Limited | Full ECO + custom alerts | Bloomberg domina |
| Options chains | Basic | Full Greek + IV surface | Bloomberg superior |
| News | Yahoo headlines | Bloomberg News (institutional quality) + sentiment | Bloomberg = institutional grade |

**La conclusión**: Bloomberg agrega valor donde Yahoo es débil. Concentrar tiempo en esas áreas (estimates dispersion, holdings, sell-side research, sector intelligence) y dejar lo básico a Yahoo (precios, ratios).
