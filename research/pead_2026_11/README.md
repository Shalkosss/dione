# Drift post-earnings (Fase 4, ítem 1)

Pregunta: después de publicar resultados, ¿las acciones que reaccionaron mejor
que el mercado siguen rindiendo mejor en las semanas siguientes? Es la
hipótesis detrás del scan por eventos (`/api/events?recent=1`).

## Cómo correrlo

Desde `research/`, con el entorno propio (no se commitea):

```
python -m venv .venv
.venv/Scripts/python -m pip install pandas numpy lxml
cd pead_2026_11
../.venv/Scripts/python fetch.py   # ~20 min: Wikipedia, SEC EDGAR y Yahoo → data/
../.venv/Scripts/python study.py   # segundos: escribe results.json
```

`SEC_USER_AGENT` (variable de entorno) identifica las consultas a la SEC.

## Diseño (fijado antes de ver resultados)

| Pieza | Definición |
|---|---|
| Universo | Constituyentes actuales del S&P 500, solo eventos posteriores a su fecha de alta |
| Evento | 8-K con ítem 2.02 desde 2012, con la hora de aceptación de EDGAR |
| Día 0 | La misma sesión si se publicó antes del cierre de NY; la siguiente si fue después |
| Reacción | Cierre d−1 a cierre d+1, menos SPY |
| Drift | Cierre d+1 a cierre d+1+h (h = 20 y 60 sesiones), menos SPY o menos el ETF del sector |
| Señal | Quintil de la reacción dentro de cada trimestre |
| Estadístico | Diferencia Q5 − Q1 y correlación de rangos (IC) por trimestre; t de Newey-West con 1 rezago sobre la serie trimestral |
| Muestras | Descubrimiento 2012–2018, validación 2019–hoy |
| Costos | 30 pb por pierna y vuelta (60 pb sobre el spread largo-corto) |
| Variantes probadas | 8 (2 horizontes × 2 benchmarks × 2 estadísticos) |

## Sesgos declarados

- **Supervivencia**: solo empresas que hoy están en el índice. Las que salieron
  (muchas por caer) no están. Esto infla el retorno de las peores reacciones
  si alguna se recuperó y sobrevivió, y deja fuera las que no.
- **Sin sorpresa contra consenso ni guía**: no hay fuente gratuita de
  estimaciones. La reacción de precio hace de medida de sorpresa (es la
  versión "earnings announcement return" de la literatura). El componente de
  guía no se prueba.
- **Large caps**: el drift post-earnings se documentó sobre todo en small
  caps; en el S&P 500 se espera más débil.

Resultados y lectura: `project-docs/PEAD_2026-11.md`.
