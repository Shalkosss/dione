# Factores de calidad por fecha de publicación (Fase 4, ítem 3): 18-nov-2026

Pregunta: los factores de calidad que usa el preScore (ROE) y los de la
literatura (rentabilidad bruta de Novy-Marx, accruals, crecimiento de
activos), ¿ordenan el retorno futuro del S&P 500 cuando se usan **solo con
datos ya publicados** en cada fecha?

Código: `research/quality_2026_11/` (definiciones fijadas antes de ver
resultados en el docstring de `study.py`). Resultados crudos: `results.json`.

## Datos

| | |
|---|---|
| Universo | Constituyentes actuales del S&P 500 desde su fecha de alta, sin Financials. 416 empresas con datos |
| Fundamentales | companyfacts de EDGAR. Cada ejercicio existe desde la fecha de su primer 10-K y con su valor original |
| Período | 163 fines de mes, ene-2013 a ago-2026; 53.548 observaciones |
| Objetivo | Retorno a 63 sesiones menos el promedio del universo ese mes |
| Variantes probadas | 5 (cuatro factores y el compuesto) |
| Cobertura | gp_a 67% (muchas empresas no informan GrossProfit); el resto, 90% o más |

## Resultado

Rank IC mensual medio y diferencia entre quintiles extremos (Q5 − Q1) por
período de 63 sesiones, con t de Newey-West:

| Factor | IC total | IC 2013–2018 | IC 2019–hoy | Q5 − Q1 total |
|---|---|---|---|---|
| Rentabilidad bruta (gp_a) | +0.016 (t 1.0) | +0.018 (t 0.7) | +0.014 (t 0.7) | −0.02% (t 0.0) |
| ROE | +0.012 (t 1.0) | +0.003 (t 0.2) | +0.019 (t 1.1) | −0.20% (t −0.4) |
| Accruals bajos | +0.003 (t 0.3) | +0.003 (t 0.2) | +0.002 (t 0.3) | +0.59% (t 1.7) |
| Crecimiento de activos bajo | +0.004 (t 0.3) | −0.008 (t −0.6) | +0.013 (t 0.7) | +0.34% (t 0.7) |
| **Compuesto** | **+0.015 (t 1.7)** | +0.007 (t 0.4) | **+0.022 (t 2.2)** | +0.37% (t 1.1) |

El compuesto rota 16% de sus quintiles extremos cada 63 sesiones. Con 30 pb
por pierna, el costo real es 0.19% por período: el neto queda en +0.17% cada
63 sesiones (~0.7% al año), sin significancia.

## Lectura

1. **Ningún factor de calidad por sí solo ordena el retorno del S&P 500.**
   Todos los IC están entre 0 y +0.02, con t menor a 1.1.
2. El **compuesto** es lo único con algo de señal: IC +0.015 en todo el
   período y +0.022 (t 2.2) desde 2019. Pero no sale en 2013–2018, el spread
   entre quintiles no es significativo y, con 5 variantes probadas, un t de 2.2
   en una submuestra está dentro de lo que produce el azar.
3. Es coherente con lo que ya se midió en el técnico y en el drift: en large
   caps líquidas el mercado ya incorporó lo que dicen los estados financieros
   publicados.

## Consecuencia para DIONE

- El **preScore** sigue como lo que es: un filtro barato para decidir dónde
  correr `/deep`, no una fuente de alfa. Su orden no se interpreta como
  expectativa de retorno.
- **No cambia la web.** No se agregan pesos nuevos al preScore: el compuesto
  no supera la vara de la Fase 5 (IC mayor a 0.03 con t mayor a 2 fuera de
  muestra, después de costos).
- El valor de la calidad en el método está en **evitar** problemas (gate:
  ROE, FCF, deuda, Altman), no en elegir ganadores. Eso no se probó acá: es
  un efecto sobre la cola izquierda, no sobre el promedio.

## Sesgos declarados

- **Supervivencia**: solo empresas que hoy están en el índice; las que
  cayeron y salieron no están. Favorece a los factores de calidad (las malas
  que quebraron no aparecen en el quintil bajo), así que el resultado real es
  igual o más débil.
- **Fecha de alta como membresía**: se asume membresía continua desde la
  fecha de alta de Wikipedia.
- **Sin Financials**: el margen bruto y los accruals no se leen igual en un
  banco.
