# Factores de calidad por fecha de publicación (Fase 4, ítem 3)

Usa los precios y el universo de `../pead_2026_11/data` (correr antes ese `fetch.py`).

```
cd research/quality_2026_11
../.venv/Scripts/python fetch.py   # companyfacts de ~500 empresas → data/facts.csv (~5 min)
../.venv/Scripts/python study.py   # rank IC y quintiles → results.json
```

Diseño y sesgos en el docstring de `study.py`. Resultados y lectura en
`project-docs/QUALITY_2026-11.md`.
