# Backtest noviembre 2026 (DIONE v4)

Orden de ejecución (Python 3, pandas, numpy; requiere curl):

1. `python3 fetch2.py`  — constituyentes actuales del S&P 500 (Wikipedia) y precios diarios de Yahoo desde 2010. Crea `universe.csv` y `px.pkl`.
2. `git clone --depth 1 https://github.com/fja05680/sp500 sp500hist` — membresía histórica del índice.
3. `python3 fetch4.py`  — construye `pit.csv` (membresía point-in-time) y baja precios de ex miembros.
4. `python3 bt2.py`     — rank IC, estados de tendencia, sectores, carteras. Guarda `panels.pkl`.
5. `python3 bt3.py`     — estudio de eventos de entrada con stop de 2 ATR y objetivo de 2.5R.

Resultados y lectura en `project-docs/BACKTEST_2026-11.md`.
Sesgo conocido: entre 7% y 34% de los miembros históricos no tienen precio en Yahoo.
`bt.py` (no incluido) era la primera versión con constituyentes actuales: daba 32.9% de CAGR por look-ahead.
