"""¿Comprar las N más grandes del S&P 500 le gana al índice? Paso 2: prueba.

Pregunta: una cartera con las 1, 5, 10, 20, 50 o 100 empresas de mayor
capitalización del S&P 500, ¿rinde siempre más que el índice (SPY)?

Diseño (fijado antes de ver resultados):
  universo    miembros del S&P 500 en cada fecha (membresía por fecha), una fila
              por CIK (GOOGL y GOOG cuentan una vez), con precio y acciones
              publicadas hace menos de 15 meses
  ranking     capitalización al cierre del último día hábil de cada mes, solo
              con datos conocidos ese día
  carteras    top N con N en {1, 5, 10, 20, 50, 100}, ponderada por
              capitalización y equiponderada; rebalanceo mensual
  objetivo    retorno total del mes siguiente (precio ajustado por dividendos)
              contra SPY
  costos      10 pb por unidad de rotación (megacaps, muy líquidas)
  métricas    retorno anual, exceso anual, tracking error, information ratio,
              máxima caída, % de años calendario y de ventanas de 3 años en
              que le gana a SPY; muestras 2010–2016 y 2017–hoy
  sesgo       control de retrospectiva: las 10 más grandes de HOY compradas
              desde el inicio (lo que muestra un gráfico típico de redes)
Uso: python study.py   (necesita data/ de fetch.py)
"""
import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
NS = [1, 5, 10, 20, 50, 100]
COST = 0.0010
MAX_AGE = pd.Timedelta(days=456)
SPLIT = pd.Timestamp("2017-01-01")
FIRST = pd.Timestamp("2010-01-01")


def split_factor_after(splits, when):
    """Producto de los splits posteriores a `when` (ratio nuevas/viejas)."""
    f = 1.0
    for d, r in splits or []:
        if d > when:
            f *= r
    return f


def load():
    pit = pd.read_csv(os.path.join(DATA, "pit.csv"), parse_dates=["start", "end"])
    px = pd.read_pickle(os.path.join(DATA, "px.pkl"))
    splits = pd.read_pickle(os.path.join(DATA, "splits.pkl"))
    ciks = pd.read_csv(os.path.join(DATA, "ciks.csv")).dropna()
    ciks["cik"] = ciks["cik"].astype(int)
    sh = pd.read_csv(os.path.join(DATA, "shares.csv"), parse_dates=["end", "filed"])
    # Por CIK y cierre, el tag preferido; luego, ordenado por fecha de presentación.
    sh = sh.sort_values("rank").drop_duplicates(["cik", "end"]).sort_values(["cik", "filed", "end"])
    return pit, px, splits, ciks, sh


def month_ends(index):
    s = index.to_series()
    return [d for d in s.groupby(index.to_period("M")).max() if d >= FIRST]


def share_series(sym, cik, sh_by_cik, splits):
    """Acciones de la empresa en unidades de hoy (ajustadas por splits) por fecha
    de presentación, sin valores aislados (un dato fuera de 0,6x–1,6x de la
    mediana de sus 7 vecinos, o fuera de 0,25x–4x de la de toda la serie, es casi siempre un error de escala en el XBRL)."""
    g = sh_by_cik.get(cik)
    if g is None or g.empty:
        return None
    g = g.sort_values(["filed", "end"]).copy()
    g["n"] = [v * split_factor_after(splits.get(sym), f) for v, f in zip(g["val"], g["filed"])]
    if sym == "BRK-B":  # Berkshire informa acciones equivalentes a clase A
        g.loc[g["n"] < 1e7, "n"] *= 1500
    # Primero contra la mediana de toda la serie (errores de escala en tandas,
    # como Berkshire en 2011, multiplicado por un millón), luego contra los vecinos.
    g = g[(g["n"] / g["n"].median()).between(0.25, 4)]
    med = g["n"].rolling(7, center=True, min_periods=1).median()
    g = g[(g["n"] / med).between(0.6, 1.6)]
    return g[["filed", "end", "n"]] if len(g) else None


def caps_on(d, pit, px, series):
    members = pit[((pit["start"].isna()) | (pit["start"] <= d)) & ((pit["end"].isna()) | (pit["end"] > d))]["sym"]
    rows = []
    for sym in members:
        df, s = px.get(sym), series.get(sym)
        if df is None or d not in df.index or s is None:
            continue
        known = s[(s["filed"] <= d) & (s["filed"] > d - MAX_AGE)]
        approx = known.empty
        # Sin dato reciente: el más cercano en el tiempo (marcado como aproximado).
        last = s.iloc[(s["filed"] - d).abs().argsort().iloc[0]] if approx else known.sort_values(["end", "filed"]).iloc[-1]
        rows.append({"sym": sym, "cik": s.attrs["cik"], "cap": df.at[d, "c"] * last["n"], "approx": approx})
    out = pd.DataFrame(rows)
    if out.empty:
        return out
    # Una fila por CIK (GOOGL y GOOG son la misma empresa).
    return out.sort_values("cap", ascending=False).drop_duplicates("cik").reset_index(drop=True)


def fwd_return(px, sym, d, nxt):
    df = px.get(sym)
    if df is None or d not in df.index:
        return np.nan
    a = df["a"]
    later = a[(a.index > d) & (a.index <= nxt)]
    if later.empty:
        return 0.0  # sin precio después: se asume efectivo al último precio
    return later.iloc[-1] / a.at[d] - 1


def stats(r, bench):
    r, bench = r.dropna(), bench.reindex(r.index)
    ex = r - bench
    years = len(r) / 12
    cum = (1 + r).cumprod()
    out = {
        "meses": int(len(r)),
        "anual": float(cum.iloc[-1] ** (1 / years) - 1),
        "spy_anual": float((1 + bench).prod() ** (1 / years) - 1),
        "te": float(ex.std() * np.sqrt(12)),
        "max_caida": float((cum / cum.cummax() - 1).min()),
    }
    out["exceso_anual"] = out["anual"] - out["spy_anual"]
    out["ir"] = out["exceso_anual"] / out["te"] if out["te"] > 0 else np.nan
    out["t"] = out["ir"] * np.sqrt(years)  # t del exceso: IR × raíz de los años
    bc = (1 + bench).cumprod()
    out["spy_max_caida"] = float((bc / bc.cummax() - 1).min())
    yr = pd.DataFrame({"p": r, "b": bench}).groupby(r.index.year).apply(lambda g: (1 + g["p"]).prod() - (1 + g["b"]).prod())
    yr = yr[pd.DataFrame({"p": r}).groupby(r.index.year).size() >= 6]
    out["anios_gana"] = f"{int((yr > 0).sum())}/{len(yr)}"
    out["por_anio"] = {int(k): float(v) for k, v in yr.items()}
    roll_p = (1 + r).rolling(36).apply(np.prod, raw=True)
    roll_b = (1 + bench).rolling(36).apply(np.prod, raw=True)
    w = (roll_p - roll_b).dropna()
    out["ventanas_3a_gana"] = float((w > 0).mean()) if len(w) else np.nan
    return out


if __name__ == "__main__":
    pit, px, splits, ciks, sh = load()
    sh_by_cik = {k: g for k, g in sh.groupby("cik")}
    series = {}
    for sym, cik in zip(ciks["sym"], ciks["cik"]):
        s = share_series(sym, int(cik), sh_by_cik, splits)
        if s is not None:
            s.attrs["cik"] = int(cik)
            series[sym] = s
    spy = px["SPY"]["a"]
    dates = month_ends(px["SPY"].index)
    rets = {f"top{n}_{w}": {} for n in NS for w in ("cap", "eq")}
    bench, sizes, approx_top, prev_w = {}, [], [], {k: {} for k in rets}
    tops_log = {}
    for d, nxt in zip(dates[:-1], dates[1:]):
        caps = caps_on(d, pit, px, series)
        if len(caps) < 300:
            continue
        sizes.append(len(caps))
        approx_top.append(int(caps.head(100)["approx"].sum()))
        if d.month == 12:
            tops_log[str(d.date())] = list(caps["sym"].head(10))
        bench[nxt] = spy[spy.index <= nxt].iloc[-1] / spy.at[d] - 1
        fr = {s: fwd_return(px, s, d, nxt) for s in caps["sym"].head(max(NS))}
        for n in NS:
            top = caps.head(n)
            for w in ("cap", "eq"):
                wt = (top.set_index("sym")["cap"] / top["cap"].sum()) if w == "cap" else pd.Series(1 / n, index=top["sym"])
                key = f"top{n}_{w}"
                r = sum(wt[s] * fr[s] for s in wt.index if np.isfinite(fr[s]))
                turn = sum(abs(wt.get(s, 0) - prev_w[key].get(s, 0)) for s in set(wt.index) | set(prev_w[key])) / 2
                rets[key][nxt] = r - COST * turn
                prev_w[key] = wt.to_dict()
    bench = pd.Series(bench)
    print("meses:", len(bench), "· empresas por fecha:", min(sizes), "a", max(sizes),
          "· top 100 con acciones aproximadas (promedio):", round(float(np.mean(approx_top)), 1))
    print("top 10 de cada diciembre:")
    for k, v in tops_log.items():
        print(" ", k, " ".join(v))

    results = {"meses": int(len(bench)), "empresas_por_fecha": [int(min(sizes)), int(max(sizes))], "top10_diciembre": tops_log, "carteras": {}}
    for key, monthly in rets.items():
        r = pd.Series(monthly)
        res = {"total": stats(r, bench), "2010_2016": stats(r[r.index < SPLIT], bench), "2017_hoy": stats(r[r.index >= SPLIT], bench)}
        results["carteras"][key] = res
        t, a, b = res["total"], res["2010_2016"], res["2017_hoy"]
        print(f"{key:12s} anual {t['anual']:+.2%} vs SPY {t['spy_anual']:+.2%} · exceso {t['exceso_anual']:+.2%} · IR {t['ir']:.2f} · "
              f"t {t['t']:.1f} · caída {t['max_caida']:.1%} (SPY {t['spy_max_caida']:.1%}) · años {t['anios_gana']} · 3a {t['ventanas_3a_gana']:.0%} · "
              f"10-16 {a['exceso_anual']:+.2%} · 17+ {b['exceso_anual']:+.2%}")

    # Control de retrospectiva: las 10 más grandes de hoy, compradas desde el inicio.
    last = dates[dates.index(bench.index[-1]) - 1]  # última fecha de ranking usada
    today = caps_on(last, pit, px, series).head(10)
    hind = {}
    for d, nxt in zip(dates[:-1], dates[1:]):
        if nxt not in bench.index:
            continue
        fr = [fwd_return(px, s, d, nxt) for s in today["sym"]]
        fr = [x for x in fr if np.isfinite(x)]
        hind[nxt] = float(np.mean(fr)) if fr else np.nan
    h = stats(pd.Series(hind), bench)
    results["retrospectiva_top10_hoy"] = {"simbolos": list(today["sym"]), **h}
    print(f"retrospectiva (top 10 de hoy, equiponderada) anual {h['anual']:+.2%} · exceso {h['exceso_anual']:+.2%} · años {h['anios_gana']}")
    print("top 10 hoy:", " ".join(today["sym"]))
    with open(os.path.join(HERE, "results.json"), "w", encoding="utf-8") as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2, default=float)
    print("guardado results.json")
