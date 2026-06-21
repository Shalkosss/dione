# MANDATE — Mandato de Inversión

Documento que define el perímetro de decisión para todas las recomendaciones de DIONE. Editar si cambia el perfil.

---

## CAPITAL

### Cuenta Real
- **Monto**: USD 5,000 (capital propio + apoyo familiar)
- **Disciplina**: ERROR IRREVERSIBLE >>> OPORTUNIDAD PERDIDA. En el real, conservadurismo táctico pero no del nivel "solo ETFs". Tolerancia alta al riesgo pero sin apostar la cuenta.
- **Distribución sugerida (asignación máxima)**:
  - Core ETFs: 30-50% (VOO, VT, ETFs internacionales, sector ETFs estratégicos)
  - Single names alta convicción: 40-60% (máximo 8 posiciones, mínimo 3)
  - Cash / dry powder: 5-15% para oportunidades tácticas
  - Opciones / apalancamiento: máximo 5% del capital, solo en setups de altísima convicción
- **Pesos por posición**: definidos por Markowitz (output de la app web), NO discrecional

### Cuenta de Competencia (Paper Trading)
- **Monto**: USD 1,000,000
- **Disciplina**: sofisticación institucional permitida. Strategies más arriesgadas, sizing más agresivo, vehículos más complejos.
- **Diferencia con cuenta real**: en paper trading se permite probar tesis de mayor riesgo/retorno. Aprendizaje sobre setups.

---

## HORIZONTES

### Táctico (foco principal): 3-6 meses
- Donde se busca alpha consistente
- Tesis con catalyst claro y timing técnico (Wyckoff)
- Setups con R:R mínimo 1:2.5, idealmente 1:3+
- Stop loss obligatorio definido al entrar

### Estratégico: 12-24 meses
- Posiciones core, compounders, secular themes
- Tolerancia a drawdowns intermedios mayores
- Catalysts pueden ser multi-trimestre

### Trading corto (<1 mes): NO
- No es el mandato. No hacer setups intraday ni swing < 3 semanas a menos que sea opción específica con catalyst conocido.

---

## ACTIVOS PERMITIDOS

### Equity
- US listed (NYSE, NASDAQ) — universo principal
- ADRs LATAM (MELI, NU, GLOB, VIST, BVN, CIG, etc.)
- ADRs grandes mercados internacionales (TSM, ASML, NVO, etc.)
- ETFs internacionales (VWO, EWZ, INDA, EZA, EWW, ILF, EEM, FXI, EWJ, etc.)
- ETFs sectoriales (XLE, XLF, XLK, XLV, etc.) y temáticos (SMH, ICLN, KWEB, etc.)
- Peru BVL solo para diversificación menor (max 10% del portafolio, foco SCCO, BAP, FERREYC)

### Fixed Income
- Treasury ETFs (SHY, IEF, TLT) según view de duración
- IG corporate (LQD) en regímenes de spread compression
- HY (HYG, JNK) solo en regímenes risk-on con cobertura
- EM debt (EMB, EMLC) según view de USD y EM

### Opciones
- Vanilla calls/puts compradas en setups de alta convicción y catalyst conocido
- Spreads (call spreads, put spreads) para definir riesgo
- Covered calls sobre posiciones core para income
- NO ventas desnudas, NO straddles especulativos

### Futuros
- Solo para hedging del portafolio (ES, NQ futures como protección)
- NO trading direccional especulativo

### FX
- Solo si aporta a una tesis macro específica (USDPEN para riesgo cambiario, EUR/USD para tesis Europa)
- No FX trading aislado

### EXCLUIDO
- Crypto (separado, gestionado aparte si aplica)
- Penny stocks (precio < $3, market cap < $300M)
- OTC, pink sheets
- SPACs sin merger completed
- China A-shares directos (acceso limitado, regulación opaca)
- Empresas con auditor changed last 12 months
- Empresas con going-concern qualification

---

## RESTRICCIONES DE RIESGO

### Por posición
- Máximo 15% del portafolio en una posición single name (en cuenta real)
- Máximo 25% en cuenta paper trading
- Stop loss definido al entrar, generalmente -7% a -12% según volatilidad del ticker (1.5x ATR como referencia)

### Por sector
- Máximo 35% en un sector GICS L1
- Máximo 50% en sectores correlacionados (ej: technology + communication services)

### Por geografía / moneda
- Máximo 80% en USD-denominated (recordar que ADR LATAM tiene exposure cambiaria)
- Mínimo 10% en exposure no-USD para diversificación de divisa

### Por estilo / factor
- No concentración extrema en un factor único (no >60% de exposure a momentum, growth, value)

---

## SESGOS A EVITAR ACTIVAMENTE

DIONE debe contradecirme si detecta:

1. **Home bias peruano**: sobreexposición a BVL Lima o LATAM en general
2. **Concentración en 5-10 nombres conocidos**: AAPL, MSFT, NVDA, GOOG, AMZN, TSLA, META, JPM, KO, etc. — el universo es más amplio
3. **Anchoring a tickers populares**: solo porque está en Twitter o Reddit no es razón
4. **Recency bias**: tesis basadas en news < 30 días sin contexto histórico
5. **Confirmation bias**: si solo busco confirmación de una tesis, DIONE debe forzarme a buscar contraevidencia
6. **FOMO**: especialmente en setups de alta volatilidad o momentum tardío
7. **Loss aversion**: mantener posiciones perdedoras por no aceptar el error inicial
8. **Disposition effect**: vender ganadores rápido y mantener perdedores

---

## DECISIONES POR TIPO DE CONVICCIÓN

DIONE asigna conviction 1-5 a cada tesis. Mi rule:

| Conviction | Sizing cuenta real | Sizing cuenta paper | Stop loss |
|---|---|---|---|
| 5/5 (Diamond) | 10-15% | 15-25% | -10% a -15% |
| 4/5 (BUY) | 5-10% | 8-15% | -8% a -12% |
| 3/5 (WATCH) | 0% (no entrar aún) | 3-5% (probar) | -7% |
| 2/5 (HOLD) | mantener si ya tengo | mantener si ya tengo | trailing |
| 1/5 (AVOID) | salir | salir | n/a |

---

## REBALANCEO

- Mensual: revisar contra modelo Markowitz output
- Trigger inmediato: si una posición se sale del rango ±5% de su peso target, rebalancear
- Triggers de venta:
  - Stop loss alcanzado
  - Tesis invalidada (cualquiera de las 3 condiciones de invalidación)
  - Catalyst principal failed
  - Mejor oportunidad disponible con conviction higher

---

## REPORTING

DIONE genera (cuando se le pide):
- Daily: scan de la watchlist + alertas de setups gatillándose
- Weekly: Macro Atlas update + Smart Money update
- Monthly: review de hit rate (`/performance`) + sugerencia de ajustes al composite scoring del Hunter

---

## ESCALAS DE CAPITAL

Cuando el capital crece, el mandato evoluciona:

- USD 5,000 → 25,000: agregar más single names, más sofisticación táctica
- USD 25,000 → 100,000: considerar opciones más activamente, EM debt, hedges sistemáticos
- USD 100,000+: revisar completamente el mandato — empezar a pensar en factor tilts sistemáticos vs alpha discrecional
