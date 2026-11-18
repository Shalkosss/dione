# Small y mid caps (Fase 4, ítem 2)

Tendencia v4 y drift post-earnings en el S&P 400 y 600 con membresía por fecha.
Reusa las funciones de descarga y estadística de `../pead_2026_11/`.

```
cd research/smallmid_2026_11
../.venv/Scripts/python fetch.py          # Wikipedia, Yahoo y EDGAR → data/ (~80 min)
../.venv/Scripts/python study_signals.py  # tendencia: rank IC, quintiles, etiquetas
../.venv/Scripts/python study_pead.py     # drift post-earnings por índice
```

En Windows, si la consola falla con caracteres, anteponer `PYTHONIOENCODING=utf-8`.
Diseño y sesgos en los docstrings. Resultados y lectura en
`project-docs/SMALLMID_2026-11.md`.
