"""Fase 4, ítem 3 — Factores de calidad por fecha de publicación. Paso 2.

Pregunta: ¿los factores de calidad del preScore y de la literatura ordenan el
retorno futuro del S&P 500 cuando se usan solo con datos ya publicados?

Diseño (fijado antes de ver resultados):
  universo    constituyentes actuales del S&P 500 desde su fecha de alta, sin
              Financials (el margen bruto de un banco no significa lo mismo)
  datos       cada ejercicio existe desde la fecha de su primer 10-K y con su
              valor ORIGINAL (las reexpresiones llegan después); se usa si se
              presentó hace menos de 15 meses
  factores    gp_a (bruto / activos, Novy-Marx), roe, accruals (−(resultado −
              flujo operativo) / activos), crecimiento de activos (invertido) y
              compuesto = promedio de los percentiles de los cuatro
  objetivo    retorno a 63 sesiones menos el promedio del universo ese mes
  prueba      rank IC mensual; diferencia Q5−Q1 del compuesto; t de Newey-West
              con 2 rezagos; muestras 2013–2018 y 2019–hoy
  costos      30 pb por pierna; el compuesto rota poco, pero se informa el
              neto suponiendo rotación completa (cota conservadora): 1,2%
  variantes   5
Uso: python study.py   (necesita data/facts.csv y ../pead_2026_11/data)
"""
import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
PEAD = os.path.join(HERE, "..", "pead_2026_11", "data")
H = 63
SPLIT = pd.Timestamp("2019-01-01")
COST_LS = 0.012
MAX_AGE = pd.Timedelta(days=456)
FACTORS = ["gp_a", "roe", "accruals", "asset_growth"]


def newey_west_t(x, lags=2):
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    n = len(x)
    if n < 12:
        return np.nan
    e = x - x.mean()
    var = e @ e / n
    for lag in range(1, lags + 1):
        var += 2 * (1 - lag / (lags + 1)) * (e[lag:] @ e[:-lag]) / n
    return x.mean() / np.sqrt(var / n) if var > 0 else np.nan


def fiscal_years(facts):
    """Por empresa y cierre: valor original de cada concepto y fecha en que se conoció."""
    f = facts.copy()
    f["end"] = pd.to_datetime(f["end"])
    f["filed"] = pd.to_datetime(f["filed"])
    first = f.sort_values("filed").drop_duplicates(["sym", "concept", "end"])
    wide = first.pivot_table(index=["sym", "end"], columns="concept", values="val", aggfunc="first")
    known = first.groupby(["sym", "end"])["filed"].min().rename("known")
    years = wide.join(known).reset_index().sort_values(["sym", "end"])
    if "gp" not in years:
        years["gp"] = np.nan
    years["gp"] = years["gp"].fillna(years.get("rev") - years.get("cogs"))
    # Año previo de la misma empresa (para crecimiento de activos).
    years["assets_prev"] = years.groupby("sym")["assets"].shift(1)
    prev_end = years.groupby("sym")["end"].shift(1)
    years.loc[(years["end"] - prev_end).dt.days.between(300, 430) == False, "assets_prev"] = np.nan  # noqa: E712
    years["gp_a"] = years["gp"] / years["assets"]
    years["roe"] = years["ni"] / years["eq"].where(years["eq"] > 0)
    years["accruals"] = -(years["ni"] - years["ocf"]) / years["assets"]
    years["asset_growth"] = -(years["assets"] / years["assets_prev"] - 1)
    return years.dropna(subset=["known"])


def snapshot(years, date):
    """Último ejercicio de cada empresa ya conocido en `date` (y no más viejo que 15 meses)."""
    avail = years[(years["known"] <= date) & (years["known"] > date - MAX_AGE)]
    return avail.sort_values("known").drop_duplicates("sym", keep="last").set_index("sym")


if __name__ == "__main__":
    u = pd.read_csv(os.path.join(PEAD, "universe.csv"), parse_dates=["added"]).drop_duplicates("cik").set_index("sym")
    u = u[u["sector"] != "Financials"]
    px = pd.read_pickle(os.path.join(PEAD, "px.pkl"))
    adj = pd.DataFrame({s: df["a"] for s, df in px.items() if s in u.index}).sort_index()
    adj = adj[~adj.index.duplicated()]
    fwd = adj.shift(-H) / adj - 1
    years = fiscal_years(pd.read_csv(os.path.join(DATA, "facts.csv")))

    idx = adj.index[adj.index >= "2013-01-01"]
    dates = [d for d in idx.to_series().groupby(idx.to_period("M")).max() if adj.index.get_loc(d) + H < len(adj.index)]
    rows = []
    for d in dates:
        members = [s for s in u.index if (pd.isna(u.loc[s, "added"]) or u.loc[s, "added"] <= d) and s in fwd.columns]
        snap = snapshot(years, d).reindex(members)
        snap["fwd"] = fwd.loc[d, members]
        snap = snap.dropna(subset=["fwd"])
        if len(snap) < 100:
            continue
        snap["target"] = snap["fwd"] - snap["fwd"].mean()
        pct = snap[FACTORS].rank(pct=True)
        snap["composite"] = pct.mean(axis=1, skipna=True).where(pct.notna().sum(axis=1) >= 3)
        snap["date"] = d
        rows.append(snap.reset_index())
    panel = pd.concat(rows)
    print("meses:", panel["date"].nunique(), "· observaciones:", len(panel), "· empresas:", panel["sym"].nunique())
    print("cobertura por factor:", {f: round(panel[f].notna().mean(), 2) for f in FACTORS + ["composite"]})

    monthly = panel.groupby("date")
    results = {"meses": int(panel["date"].nunique()), "observaciones": int(len(panel)), "horizonte": H, "factores": {}}
    for f in FACTORS + ["composite"]:
        ic = monthly.apply(lambda g, f=f: g[f].rank().corr(g["target"].rank()) if g[f].notna().sum() > 50 else np.nan)

        def spread(g, f=f):
            g = g.dropna(subset=[f])
            if len(g) < 50:
                return np.nan
            q = pd.qcut(g[f].rank(method="first"), 5, labels=False)
            return g.loc[q == 4, "target"].mean() - g.loc[q == 0, "target"].mean()

        sp = monthly.apply(spread)
        res = {}
        for name, mask in [("total", ic.index == ic.index), ("2013_2018", ic.index < SPLIT), ("2019_hoy", ic.index >= SPLIT)]:
            res[name] = {"meses": int(ic[mask].notna().sum()), "ic_medio": float(ic[mask].mean()), "t_ic": float(newey_west_t(ic[mask])),
                         "spread_q5_q1": float(sp[mask].mean()), "t_spread": float(newey_west_t(sp[mask])), "spread_neto": float(sp[mask].mean() - COST_LS)}
        results["factores"][f] = res
        t, a, b = res["total"], res["2013_2018"], res["2019_hoy"]
        print(f"{f:13s} IC {t['ic_medio']:+.3f} (t {t['t_ic']:.2f}) · Q5-Q1 {t['spread_q5_q1']:+.2%} (t {t['t_spread']:.2f}) neto {t['spread_neto']:+.2%}"
              f" · 2013-18 IC {a['ic_medio']:+.3f} (t {a['t_ic']:.2f}) · 2019+ IC {b['ic_medio']:+.3f} (t {b['t_ic']:.2f})")
    with open(os.path.join(HERE, "results.json"), "w", encoding="utf-8") as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2)
    print("guardado results.json")
