# ¿Comprar las más grandes del S&P 500 le gana siempre al índice?: 18-nov-2026

Pregunta (del usuario): la idea que circula dice que comprar la empresa más
grande del S&P 500, o las 5, 10 o 100 más grandes, rinde **siempre** más que
el índice. ¿Es cierto?

Código: `research/megacap_2026_11/` (diseño fijado antes de ver resultados en
el docstring de `study.py`). Resultados crudos: `results.json`.

## Datos

| | |
|---|---|
| Universo | Miembros del S&P 500 **en cada fecha** (lista actual más altas y bajas de Wikipedia), una fila por empresa (GOOGL y GOOG cuentan una vez) |
| Capitalización | Cierre del día × acciones tal como se publicaron en EDGAR, ajustadas por splits posteriores. Empresas que cambiaron de CIK (Google → Alphabet, Exxon, Disney, BlackRock, Linde, Broadcom…) con su historia completa |
| Ranking | Último día hábil de cada mes, solo con datos conocidos ese día |
| Período | feb-2010 a nov-2026: 202 meses |
| Carteras | Top 1, 5, 10, 20, 50 y 100, ponderadas por capitalización y equiponderadas, rebalanceo mensual, 10 pb por rotación |
| Benchmark | SPY con dividendos |

Las 10 más grandes que arma el ranking coinciden con la historia: Exxon,
Apple, Microsoft y GE en 2010; Apple, Alphabet, Microsoft, Amazon y Meta
desde 2016; Nvidia primera en 2025.

## Resultado

Exceso anual contra SPY (SPY: +14,1% anual; máxima caída −23,9%):

| Cartera (por capitalización) | Exceso anual | t | Años que gana | Ventanas de 3 años que gana | 2010–2016 | 2017–hoy | Máxima caída |
|---|---|---|---|---|---|---|---|
| Top 1 | +2,7% | 0,6 | 10 de 17 | 57% | −2,3% | +6,4% | −42,6% |
| Top 5 | +4,6% | 1,7 | 11 de 17 | 77% | −1,3% | +9,0% | −33,8% |
| Top 10 | +3,5% | 1,7 | 10 de 17 | 75% | +0,3% | +5,8% | −35,2% |
| Top 20 | +1,4% | 0,9 | 11 de 17 | 69% | −1,8% | +3,6% | −28,7% |
| Top 50 | +1,2% | 1,3 | 10 de 17 | 72% | −0,5% | +2,3% | −26,9% |
| Top 100 | +0,8% | 1,4 | 10 de 17 | 79% | −0,3% | +1,6% | −26,0% |

Equiponderadas: top 10 +3,1% (t 1,6); top 20, 50 y 100, cero.

Exceso del top 10 por año: perdió en 2010, 2012, 2013, 2014, 2016, 2022
(−17%) y 2026; ganó fuerte en 2020 (+22%), 2023 (+28%) y 2024 (+23%).

**Control de retrospectiva**: las 10 más grandes de **hoy** compradas en
2010 dan +32% anual, +18% sobre SPY, y ganan 15 de 17 años. Es el gráfico
que suele circular, y es un error: en 2010 nadie sabía que Nvidia, Tesla o
Broadcom iban a estar en esa lista. Medido sin mirar el futuro, el exceso
baja de +18% a +3,5%.

## Lectura

1. **"Siempre" es falso.** El top 10 perdió contra el índice en 7 de 17 años
   y en una de cada cuatro ventanas de 3 años. El top 1 perdió 7 de 17 años.
   En 2013 la más grande alternó entre Apple y Exxon: la cartera se comió las
   caídas de Apple de enero y junio, se perdió su rebote de julio y agosto
   por estar en Exxon, y cerró en −15% con el índice en +32%.
2. **El exceso existe en esta muestra pero no es significativo** (t entre
   0,6 y 1,8) y sale casi entero de 2017–2026, la década de las megacaps
   tecnológicas. En 2010–2016 el top 10 empató con el índice y el top 1 y el
   top 5 perdieron.
3. **Se paga con riesgo**: la máxima caída del top 5 o el top 10 fue de −34%
   a −35%, contra −24% del índice. El top 1 llegó a −43%.
4. Concentrarse en las más grandes es una **apuesta a que el período
   2017–2026 se repita**, no una regla. Diecisiete años con un solo régimen
   dominante no alcanzan para separarla de la suerte.

## Consecuencia para DIONE

- **No cambia la web.** No se agrega una regla de "comprar el top N".
- El mandato ya tiene la versión prudente de esta idea: el núcleo en el
  índice (VOO/SPY) ya pondera por capitalización, así que la cartera ya está
  cargada a las megacaps (las 10 más grandes son más de un tercio del S&P
  500). Sobreponderarlas además es concentración, y entra por los topes de
  `MANDATE.md` como cualquier otra.
- Si una tesis en una megacap pasa por `/deep`, se mide en el tracker como
  cualquier otra; el tamaño de la empresa no es argumento.

## Sesgos declarados

- **Muestra corta y de un solo régimen**: 2010–2026, dominado por la
  tecnología grande. No se pudo ir más atrás: EDGAR tiene acciones en XBRL
  desde 2009.
- **Bajas sin precio**: 189 de 826 símbolos (casi todos comprados: Celgene,
  Allergan, Time Warner, Pioneer) no tienen precio en Yahoo y no entran al
  ranking. Afecta sobre todo al top 50 y top 100; el top 10 sale completo.
- **Historial de Wikipedia incompleto**: 361 altas y bajas desde 2010. Las
  que faltan pueden dejar alguna empresa dentro o fuera unos meses.
- **Acciones aproximadas**: en promedio 3 de las 100 más grandes de cada
  fecha usan el dato de acciones más cercano en vez de uno de los últimos 15
  meses (Visa y Hershey informan por clase). Datos de escala erróneos en
  XBRL (Berkshire en 2011, ×1.000.000) se descartan con un filtro contra la
  mediana.
