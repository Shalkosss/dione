# Top N del S&P 500 contra el índice

¿Comprar las 1, 5, 10, 20, 50 o 100 empresas más grandes del S&P 500 le gana
siempre al índice? Ranking por capitalización con datos de cada fecha.

```
cd research/megacap_2026_11
../.venv/Scripts/python fetch.py   # Wikipedia, Yahoo y EDGAR → data/ (~10 min)
../.venv/Scripts/python -c "import importlib.util as u; s=u.spec_from_file_location('m','fetch.py'); m=u.module_from_spec(s); s.loader.exec_module(m); m.extra()"
                                   # historia de empresas que cambiaron de CIK
../.venv/Scripts/python study.py   # carteras, estadísticas y control de retrospectiva
```

En Windows, si la consola falla con caracteres, anteponer `PYTHONIOENCODING=utf-8`.
Resultados y lectura en `project-docs/MEGACAPS_2026-11.md`.
