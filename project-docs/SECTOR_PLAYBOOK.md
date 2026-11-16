# SECTOR PLAYBOOK — Salud, megacaps, financieras (14-nov-2026)

Reglas para los tres grupos que antes estaban vetados o mal tratados por el scan. Complementa a `FUNDAMENTAL_FRAMEWORK.md`, que conserva el check de infraestructura de IA y data centers.

---

## 1. Principio común: calidad relativa al sector

El preScore usa umbrales absolutos de ROE, margen bruto y margen neto. Salud y software tienen márgenes estructuralmente altos y por eso copaban los primeros puestos sin que eso dijera nada sobre la empresa. Desde v4 la calidad se compara dentro del sector: importa estar en la mitad superior de sus pares.

## 2. Salud

### Por qué fallaba

1. Sesgo de escala: buenos fundamentales absolutos llevaban a un `/deep` favorable casi siempre.
2. Momento: se compró salud mientras el capital rotaba hacia IA. El sector rezagaba y las tesis se deshacían en un mes sin que la empresa empeorara.
3. Se valoraba con las mismas métricas a una farmacéutica, una aseguradora y una empresa de instrumentos.

### Cómo valorar por sub-industria

| Sub-industria | Métrica principal | Qué vigilar |
|---|---|---|
| Farmacéuticas grandes | P/E forward y FCF yield contra su historia de 10 años | Porcentaje de ventas que pierde patente en 5 años, reposición del pipeline, exposición a negociación de precios de Medicare |
| Biotech con ingresos | EV/ventas contra crecimiento, valor del pipeline por probabilidad de éxito | Concentración en un producto, caja en años de gasto |
| Biotech sin ingresos | No se valora por múltiplos | Fuera de la cuenta real. En papel, tamaño mínimo y sin evento binario a menos de 60 días |
| Equipos y dispositivos médicos | EV/EBITDA y crecimiento orgánico | Volumen de procedimientos, ciclo de reemplazo, reembolso |
| Herramientas y life sciences (TMO, A, MTD, IQV) | EV/EBITDA, book-to-bill | Gasto en I+D de farmacéuticas y biotech, presupuesto NIH, demanda de China |
| Aseguradoras y managed care (UNH, HUM, ELV) | P/E forward, tendencia del medical loss ratio | Tarifas de Medicare Advantage, riesgo regulatorio y electoral |
| Distribuidores y servicios (MCK, COR, HCA) | P/E, margen operativo, FCF | Mezcla de pagadores, costos laborales |

Reverse DCF sigue siendo obligatorio. En farmacéuticas se hace sobre el flujo ajustado por la caída de las patentes que vencen.

### Reglas de entrada para salud

1. Fuerza relativa del sector: XLV contra SPY a 63 días no puede estar en el tercio inferior de los 11 sectores, salvo que salud esté en la lista de sobreponderados por vista macro.
2. La acción debe tener etiqueta EN ZONA, RETROCESO o EXTENDIDA. Una acción de salud con etiqueta ROTA no se compra por fundamentales, se registra como `SIN_ORDEN`.
3. Sin eventos binarios (decisión FDA, lectura de fase 3 que defina la empresa) dentro de los 60 días siguientes en la cuenta real.

### Salud como cobertura defensiva

Con matices. En los 25 meses desde 2012 que empezaron con SPY bajo su SMA200, salud rindió −0.46% mensual contra el promedio del universo (consumo básico −0.85%, utilities −0.53%). Los defensivos amortiguan durante la caída, pero después de que el índice pierde la SMA200 los meses siguientes suelen ser de rebote y se quedan atrás. Consecuencias:

- Salud sirve para bajar la beta de la cartera antes de la caída o durante ella, no como respuesta tardía.
- La cobertura real del mandato es el tamaño: medio riesgo por posición con SPY bajo SMA200, más el tramo de liquidez.
- Una posición defensiva se declara como tal en la tesis (`thesis_mode: "defensiva"`) y se mide contra XLV, no contra SPY.

Dato del 14-nov-2026: 10 de las 20 acciones con mejor momentum del S&P 500 eran de salud (MRNA, CRL, RVTY, HUM, VEEV, TECH, TMO, MTD, IQV, A), junto con refinadoras de energía. El liderazgo rotó respecto al periodo en que se compró salud sin éxito. Es contexto, no señal de compra: el momentum no mostró poder predictivo en el backtest.

## 3. Megacaps (más de $200B)

### El problema

Con el veto, DIONE no opinaba sobre las empresas que mueven el índice. Sin veto, el ranking devolvía siempre MSFT, NVDA y AAPL porque sus variables casi no cambian de una semana a otra.

### Solución

1. Los megacaps salen del ranking de descubrimiento y van al tablero de megacaps de `/scan`: unas 35 empresas, con etiqueta de tendencia, distancia a la SMA50 y fuerza relativa contra SPY. La información útil del tablero es el cambio: quién pasó a ROTA, quién volvió a EN ZONA.
2. Entran al tablero pasen o no el gate (GOOGL, META, AVGO, AMD, ORCL, LLY, TSLA, JPM, V y MA hoy no están en el snapshot).
3. Ya se tienen a través del núcleo. Comprar NVDA directo encima de VOO y QQQ es una sobreponderación, y la tesis debe justificarla. El límite de 15% por acción cuenta lo que aporta el núcleo.
4. Momento natural de entrada: etiqueta RETROCESO en un megacap con tesis vigente. Un sell-off que no nace en la empresa (rotación, susto macro) es el caso típico.
5. El check de infraestructura de IA de `FUNDAMENTAL_FRAMEWORK.md` aplica a toda la cadena de data centers.

### Caídas de líderes con buenos fundamentales

Una acción de calidad cae por flujos, posicionamiento y valuación además de por resultados. El sistema lo trata así:

- Si cae la acción con su sector y con el mercado: es beta. Se revisa régimen y fuerza relativa. La tesis de empresa no cambió.
- Si cae sola contra su sector: se busca la causa en resultados, guidance o noticias antes de comprar el retroceso.
- En ambos casos el reverse DCF dice cuánto crecimiento sigue implícito en el precio. Una caída de 20% en una acción que descontaba 30% anual durante 10 años puede dejarla todavía cara.

## 4. Financieras

El gate de D/E y FCF no aplica a bancos y aseguradoras. Entran por `/deep` directo o por el tablero sectorial, con estas métricas:

| Tipo | Métricas |
|---|---|
| Bancos | P/TBV contra ROTCE, margen de interés neto, CET1, castigos netos, mezcla y costo de depósitos |
| Aseguradoras | P/B contra ROE, ratio combinado, crecimiento de primas, reservas |
| Gestoras y bolsas | P/E, flujos netos, margen operativo |

Sector XLF como ETF táctico cuando la vista macro lo sobrepondera (curva empinándose, crédito sano).

## 5. Qué registrar en el log

Toda tesis lleva `sector`, `sector_etf` y `sector_view`. Con eso el tracker separa cuánto del resultado vino de la vista sectorial y cuánto de la acción.
