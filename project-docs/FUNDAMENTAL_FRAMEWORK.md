# FUNDAMENTAL FRAMEWORK — Consenso de 6 frameworks fundamentales

DIONE no usa "el framework de Buffett" o "el de Lynch" aislado. Usa consenso de 6 frameworks fundamentales para reducir bias y capturar diferentes dimensiones de calidad.

---

## LOS 6 FRAMEWORKS

### Framework 1 — Graham Defensive

**Origen**: Benjamin Graham, "The Intelligent Investor" capítulo 14, "Security Analysis"

**Criterios (los 7 originales de Graham)**:
1. Tamaño adecuado: revenue > $500M, total assets > $200M
2. Strong financial condition: current ratio > 2, working capital positive
3. Earnings stability: EPS positive cada año últimos 10 años
4. Dividend record: pagado dividendos cada año últimos 20 años (relajado: 10 años para era moderna)
5. Earnings growth: EPS al menos +33% en últimos 10 años (compounded ~3% anual)
6. Moderate P/E ratio: < 15× current earnings
7. Moderate P/B ratio: P/E × P/B < 22.5

**Cuantificación**:
- 7 criterios, 1 punto cada uno
- Graham score 0-7
- Score ≥ 5 = "Graham passes"

**Cuándo es útil**: deep value, mercados con valoraciones bajas, defensive picks

**Limitación**: muy estricto para growth companies y para era moderna donde dividends son menos comunes (especialmente tech)

---

### Framework 2 — Buffett Quality

**Origen**: filosofía Berkshire Hathaway destilada de Buffett's annual letters

**Criterios**:
1. ROE > 15% sostenido últimos 5 años (consistencia, no un año aislado)
2. ROIC > WACC (creación real de valor, no destrucción)
3. Operating margin > 15% y stable o growing
4. FCF margin > 10%
5. Net debt / EBITDA < 3× (manejo conservador de leverage)
6. Earnings predictability: coefficient of variation de EPS < 0.3 últimos 5 años (low volatility)
7. Moat detectable según Hamilton Helmer 7 Powers (al menos 2 de 7)

**Cuantificación**:
- 7 criterios, 1 punto cada uno
- Buffett quality score 0-7
- Score ≥ 5 = "Buffett quality"

**Cuándo es útil**: compounders, posiciones core de largo plazo, defensive growth

---

### Framework 3 — Lynch Growth

**Origen**: Peter Lynch, "One Up on Wall Street"

**Categorías Lynch**:
- **Slow growers**: revenue growth < 5% — solo si dividend yield alto
- **Stalwarts**: revenue growth 5-10% — defensive plays
- **Fast growers**: revenue growth > 15% — donde está el alpha más grande
- **Cyclicals**: sensibles a economía (autos, airlines, commodities)
- **Turnarounds**: empresas en problemas con catalyst de recovery
- **Asset plays**: undervalued asset (real estate, IP, subsidiarias)

**Criterios para Fast Growers (donde Lynch buscaba multi-baggers)**:
1. Revenue growth > 15% últimos 3 años
2. EPS growth > 20% últimos 3 años
3. PEG < 1 (P/E divided by growth rate)
4. ROE > 15%
5. Operating margin growing
6. Debt manageable (debt/equity < 1)
7. Story comprensible en 1 minuto

**Cuantificación**:
- Asignar categoría (Lynch type)
- Para fast growers: 7 criterios, score 0-7
- Score ≥ 5 = "Lynch fast grower passes"

**Cuándo es útil**: capturar multi-baggers, growth en mid-caps especialmente

---

### Framework 4 — Greenblatt Magic Formula

**Origen**: Joel Greenblatt, "The Little Book That Beats the Market"

**Criterios (solo 2 ratios)**:
1. **Earnings Yield**: EBIT / Enterprise Value (cuanto rinde una empresa relativo a su precio + deuda)
2. **Return on Capital**: EBIT / (Net Working Capital + Net Fixed Assets) (qué tan eficientemente la empresa usa su capital operativo)

**Ranking**:
- Rankear todas las empresas del universo por Earnings Yield (top decile)
- Rankear todas por Return on Capital (top decile)
- Sumar los rankings, ordenar ascending
- Top 30 del combined ranking = Magic Formula universe

**Backtest histórico**: Greenblatt reporta ~30% CAGR 1988-2004. Replications independientes confirmando 15-20% CAGR consistent.

**Cuantificación**: incluir como score 0-10 según percentil combinado

**Cuándo es útil**: contrarian deep value, screening sistemático sin sesgos cualitativos

**Limitación**: ignora calidad cualitativa, moat, management. Captura value pero también value traps. Usar SIEMPRE combinado con otros frameworks.

---

### Framework 5 — Piotroski F-Score

**Origen**: Joseph Piotroski, "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers" (2000)

**Los 9 criterios** (1 punto cada uno):

**Profitability**:
1. Net Income > 0 en últimos 4 trimestres
2. ROA > 0 en últimos 4 trimestres
3. Operating Cash Flow > 0 en últimos 4 trimestres
4. OCF > Net Income (calidad de earnings)

**Leverage, Liquidity, Source of Funds**:
5. Long-term debt ratio decreased YoY
6. Current ratio increased YoY
7. No new shares issued YoY (no dilution)

**Operating Efficiency**:
8. Gross margin increased YoY
9. Asset turnover increased YoY

**Total F-Score**: 0-9

**Interpretación**:
- F-Score ≥ 7: alta probabilidad de mejora futura
- F-Score ≤ 3: deteriorando, evitar
- Backtest: stocks con F-Score alto outperforman F-Score bajo por ~10% anual en backtests de Piotroski

**Cuándo es útil**: especialmente potente combinado con value (low P/B). Piotroski's original paper era para value stocks; mejora el screening reduciendo value traps.

---

### Framework 6 — DuPont + Quality Decomposition

**Origen**: DuPont analysis (clásico) + AQR's Quality Minus Junk framework

**DuPont decomposition de ROE**:
```
ROE = Net Margin × Asset Turnover × Equity Multiplier
    = (Net Income / Revenue) × (Revenue / Assets) × (Assets / Equity)
```

**Interpretación**:
- ROE alto por margin: empresa con pricing power (moat) — alta calidad
- ROE alto por turnover: empresa operativamente eficiente — calidad media
- ROE alto por leverage: empresa apalancada — calidad baja, frágil

**Criterios Quality (AQR style)**:
1. ROE > 15% sostenido
2. Net margin > 10% (pricing power)
3. Asset turnover > 0.5x (efficiency)
4. Equity multiplier < 3x (low leverage)
5. ROIC > 12%
6. Earnings stability (CoV EPS < 0.4)
7. Gross margin stability (CoV gross margin < 0.15)

**Cuantificación**: score 0-7

**Cuándo es útil**: identificar high-quality compounders. Combinado con momentum = factor combo AQR (Sharpe histórico 1.3-1.5)

---

## ANTI-FRAUD FILTER — Beneish M-Score

**Origen**: Messod Beneish (1999)

**Cuantificación**: combinación de 8 ratios que detectan probabilidad de manipulación de earnings.

**Fórmula**:
```
M-Score = -4.84 + 0.92×DSRI + 0.528×GMI + 0.404×AQI + 0.892×SGI 
         + 0.115×DEPI - 0.172×SGAI + 4.679×TATA - 0.327×LVGI
```

Donde:
- DSRI: Days Sales in Receivables Index
- GMI: Gross Margin Index
- AQI: Asset Quality Index
- SGI: Sales Growth Index
- DEPI: Depreciation Index
- SGAI: Sales, General and Admin expense Index
- TATA: Total Accruals to Total Assets
- LVGI: Leverage Index

**Interpretación**:
- M-Score < -1.78: bajo riesgo de manipulación (PASS)
- M-Score > -1.78: alto riesgo de manipulación (FAIL, descartar)

**Casos famosos detectados**: Enron, WorldCom (la modelo Beneish los detectó pre-collapse), Wirecard

**REGLA DURA**: si M-Score > -1.78, el ticker se DESCARTA automáticamente sin importar qué digan los otros 6 frameworks. La calidad de earnings es no-negociable.

---

## ALTMAN Z-SCORE (Bankruptcy Risk)

**Origen**: Edward Altman (1968)

**Fórmula** (para empresas públicas manufactureras):
```
Z = 1.2×A + 1.4×B + 3.3×C + 0.6×D + 1.0×E

Donde:
A = Working Capital / Total Assets
B = Retained Earnings / Total Assets
C = EBIT / Total Assets
D = Market Cap / Total Liabilities
E = Sales / Total Assets
```

**Interpretación**:
- Z > 2.99: safe zone
- 1.81 < Z < 2.99: grey zone (caution)
- Z < 1.81: distress zone (high bankruptcy risk en 2 años)

**REGLA DURA**: si Z < 1.81 y NO es un caso de turnaround explícito documentado, descartar el ticker. Bankruptcy risk no es algo con lo que jugar para tesis fundamentales.

**Versión para no-manufacturing (servicios, financieras, REITs)**: **Z" Altman (1995)**, fórmula alternativa:
```
Z" = 6.56·A + 3.26·B + 6.72·C + 1.05·D'
D' = BookEquity / Liab    (NO MarketCap; por eso Z" funciona también sin precio)
thresholds: safe > 2.6, distress < 1.1
```
DIONE selecciona el modelo por **disponibilidad de datos**, no por GICS sector: si los 5 componentes de Z están presentes, usa Z; si no, intenta Z" con sus 4 componentes. El campo `altmanModel` del snapshot expone cuál corrió (`"Z"` o `"Z\""`).

---

## COMPOSITE FUNDAMENTAL SCORE

Total: 100 puntos

| Framework | Peso | Cálculo |
|---|---|---|
| Graham Defensive | 15 puntos | (Graham score / 7) × 15 |
| Buffett Quality | 20 puntos | (Buffett score / 7) × 20 |
| Lynch Growth (si aplica) | 10 puntos | (Lynch score / 7) × 10 |
| Greenblatt Magic Formula | 15 puntos | percentil combined ranking × 15 |
| Piotroski F-Score | 20 puntos | (F-Score / 9) × 20 |
| DuPont Quality | 15 puntos | (Quality score / 7) × 15 |
| Beneish M-Score (anti-fraud) | 5 puntos | binary: 5 si pasa, 0 si falla (con descarte total si M > -1.78) |

**Bonus/Penalties** (thresholds por modelo — Z manufacturera vs Z" non-manuf):
- +5 puntos si Altman safe-zone:
  - Z > 4.0, o
  - Z" > 2.6
- -8 puntos si Altman warning:
  - Z < 2.0, o
  - Z" < 1.1
- +8 puntos si Piotroski ≥ 8 (book quality casi perfecto); +5 si ≥ 7
- +5 "operational inflection" si piotroski ≥ 7 AND ROE ≥ 15% AND D/E < 0.5 AND FCF yield ≥ 5%
- DESCARTE (gate fail) si Altman distress: Z < 1.81 o Z" < 1.1 sin tesis de turnaround

**Threshold para "Fundamental setup válido"**: score ≥ 70/100

---

## ADAPTACIÓN POR SECTOR

Los frameworks aplican con peso variable según sector GICS:

| Sector | Frameworks dominantes |
|---|---|
| **Technology** | Buffett Quality, Lynch Growth, DuPont (margen, no asset turnover) |
| **Financials** | Graham (P/B importante), Buffett, F-Score adaptado |
| **Energy / Materials** | Greenblatt Magic Formula (cíclicos), Altman Z (bankruptcy risk) |
| **Healthcare** | Buffett Quality, Lynch (biotech como fast growers), pipeline analysis cualitativo |
| **Consumer Staples** | Graham, Buffett (compounders defensivos) |
| **Consumer Discretionary** | Lynch (cyclicals/growers), DuPont |
| **Industrials** | Buffett, DuPont, F-Score |
| **Real Estate / REITs** | Frameworks alternativos (FFO, AFFO, NAV) — NO usar P/E |
| **Utilities** | Graham, Dividend yield, regulatory environment |

DIONE adapta el composite weights dinámicamente según sector del ticker analizado.

---

## REVERSE DCF (siempre incluir en Deep Research)

**Concepto**: en vez de calcular un fair value, calcular qué growth rate implica el precio actual y juzgar si es razonable.

**Pasos**:
1. Asumir WACC actual (8-10% típicamente para US large caps)
2. Asumir terminal growth (2.5-3% típicamente)
3. Asumir projection period (10 años)
4. Resolver: ¿qué FCF growth rate hace que NPV de FCF = market cap actual?

**Output**: "El precio actual de NVDA implica un FCF growth de 24% anual durante 10 años. Dado que la industria de semis crece 8-12% anualmente y NVDA tiene 80% market share en AI compute, ¿es razonable? — [Opinión DIONE]"

Esto es lo que DIONE puede hacer y Yahoo no.

---

## 7 POWERS DE HAMILTON HELMER (Moat structural)

**Origen**: Hamilton Helmer, "7 Powers: The Foundations of Business Strategy"

Las únicas 7 fuentes sostenibles de pricing power:

1. **Scale Economies**: costos por unidad bajan con escala (AWS, Amazon retail)
2. **Network Effects**: el producto se vuelve más valioso con más usuarios (Meta, Visa)
3. **Counter-Positioning**: competidor establecido NO puede replicar tu modelo sin destruir su business existente (Netflix vs Blockbuster, Robinhood vs traditional brokers)
4. **Switching Costs**: cambiar de proveedor es caro (Microsoft Office, SAP ERP, AWS)
5. **Branding**: cliente paga premium por la marca (Apple, Hermès, Coca-Cola)
6. **Cornered Resource**: acceso preferencial a un recurso escaso (mineras con depósitos únicos, semi capacity TSM)
7. **Process Power**: procesos internos imposibles de replicar rápido (Toyota Production System, Costco's supply chain)

**Cuantificación**:
- Por cada Power identificado: 1 punto
- Score 0-7
- Empresas top tienen 2-3 Powers simultáneamente

**Output en Deep Research**: lista explícita de cuáles Powers tiene la empresa y cuáles no, con argumentación. Esto es razonamiento Claude puro, no algorítmico.
