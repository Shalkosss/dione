# Small y mid caps: tendencia y drift post-earnings (Fase 4, ítem 2): 18-nov-2026

Preguntas:
1. ¿El score de tendencia v4 o sus piezas ordenan el retorno futuro en el S&P
   400 y el S&P 600? En large caps el rank IC fue casi cero (`BACKTEST_2026-11.md`).
2. ¿Existe drift post-earnings en small y mid caps? En el S&P 500 no lo hubo
   (`PEAD_2026-11.md`) y la literatura dice que vive en las empresas chicas.

Código: `research/smallmid_2026_11/` (diseño fijado antes de ver resultados en
los docstrings de `study_signals.py` y `study_pead.py`).

## Datos

| | |
|---|---|
| Universo | Miembros del S&P 400 y 600 **en cada fecha**: lista actual más el historial de altas y bajas de Wikipedia, deshecho hacia atrás |
| Símbolos con historia | 1.729 (1.077 con baja); 1.288 con precio en Yahoo, 520 de las bajas |
| Tendencia | 163 fines de mes (ene-2013 a jul-2026), 122.466 observaciones, 1.238 empresas |
| Eventos | 44.043 publicaciones de resultados (8-K 2.02), 2012 a nov-2026, 1.240 empresas |
| Benchmark | El ETF del índice de la empresa en esa fecha: IJH (S&P 400) o IJR (S&P 600) |
| Costos | 50 pb por pierna: 2% por período para un largo-corto |
| Variantes | 15 en tendencia (7 señales, 6 etiquetas, 2 índices) y 4 en drift |

## Resultado 1: tendencia

Rank IC mensual contra el retorno a 63 sesiones (menos el promedio del universo):

| Señal | Total | 2013–2018 | 2019–hoy |
|---|---|---|---|
| **Score v4 compuesto** | +0.006 (t 0.4) | −0.009 (t −0.5) | +0.017 (t 0.9) |
| Momentum 12-1 / 6-1 | +0.000 (t 0.0) | −0.022 (t −1.3) | +0.018 (t 0.9) |
| Sobre SMA200 | +0.009 (t 0.8) | +0.001 (t 0.1) | +0.015 (t 0.9) |
| SMA200 subiendo | +0.016 (t 1.3) | +0.005 (t 0.3) | +0.025 (t 1.4) |
| SMA50 sobre SMA200 | +0.007 (t 0.6) | −0.005 (t −0.4) | +0.017 (t 1.0) |
| Fuerza relativa 63 ses. | −0.002 (t −0.2) | −0.003 (t −0.2) | −0.000 (t 0.0) |
| Zona de entrada | +0.006 (t 0.9) | +0.013 (t 1.6) | +0.001 (t 0.1) |

Score v4: Q5 − Q1 = −0.16% por período (t −0.2); −2.16% neto de costos. Por
índice: S&P 400 IC +0.004 (t 0.2), S&P 600 IC +0.008 (t 0.6).

Exceso medio a 63 sesiones por etiqueta: EN ZONA −0.25% (t −0.9), ALCISTA
−0.43% (t −1.9), EXTENDIDA +0.69% (t 1.6), RETROCESO −0.30% (t −0.6),
RECUPERANDO −0.08% (t −0.2), ROTA −0.25% (t −0.9). Ninguna es distinta de cero,
y la que más rinde es la que el método manda esperar (EXTENDIDA).

## Resultado 2: drift post-earnings

Diferencia de drift entre el quintil de mejor reacción y el de peor, contra
el ETF del índice:

| Drift | Total | 2012–2018 | 2019–hoy | Neto (2%) |
|---|---|---|---|---|
| 20 sesiones | +0.12% (t 0.5) | +0.28% (t 1.0) | −0.02% (t −0.1) | −1.88% |
| 60 sesiones | +0.42% (t 1.1) | +0.78% (t 1.7) | +0.10% (t 0.2) | −1.58% |

IC a 60 sesiones +0.014 (t 1.7). Por índice, S&P 600 algo más alto (+0.48%,
t 1.0) que S&P 400 (+0.11%, t 0.2), sin significancia en ninguno.

## Lectura

1. **El score de tendencia v4 no ordena el retorno en small y mid caps**,
   igual que en large caps. Ninguna pieza supera t 1.6 en ninguna muestra.
2. **No hay drift post-earnings explotable en el S&P 400 y 600.** Lo que hubo
   antes de 2019 (+0.78% a 60 sesiones, t 1.7) desapareció después y nunca
   cubrió costos. Es consistente con la literatura reciente: el efecto se
   arbitró y sobrevive, si acaso, en microcaps fuera de estos índices.
3. Con los ítems 1, 2 y 3 de la Fase 4 la conclusión es una sola: **con
   datos públicos y gratuitos, ni el precio, ni los estados financieros, ni la
   reacción a resultados dan una ventaja medible en el universo que DIONE
   puede operar.**

## Consecuencia para DIONE

- **Web**: la tendencia del universo fuera del gate sigue en pantalla como
  descripción del estado del precio, no como ranking. La leyenda de la vista
  Mercado completo lo dice. El "≈" queda: ahora con evidencia de que el
  score no predice tampoco en small caps.
- **Fase 5 (ML)**: queda **bloqueada**. Su condición de entrada es que la
  Fase 4 encuentre features con contenido y ninguna de las tres la encontró.
  Un modelo flexible sobre estas señales solo ajustaría ruido.
- **Dónde está la ventaja posible**: en lo que no está en estos datos. El
  análisis de cada `/deep` (tesis, catalizadores, valuación) y la disciplina
  de la cartera (núcleo en el índice, tamaño por riesgo, stops). Por eso el
  siguiente test con sentido es el ítem 4: medir el THESIS_LOG cuando tenga
  30 registros.

## Sesgos declarados

- **Supervivencia parcial**: 520 de 1.077 bajas tienen precio en Yahoo; las
  que no (en general quiebras y deslistes) faltan, lo que favorece a las
  señales de "comprar lo que sube" (los perdedores extremos no están). El
  resultado real es igual o más débil.
- **Membresía del S&P 600 antes de dic-2019**: el historial de Wikipedia
  empieza ahí; antes se usa la lista de esa fecha.
- **Eventos sin CIK**: 450 símbolos (sobre todo bajas viejas) no figuran en
  la lista actual de la SEC y no aportan eventos.
- **Sorpresa**: sin consenso de analistas, la reacción de precio hace de
  medida de sorpresa, igual que en el estudio del S&P 500.
