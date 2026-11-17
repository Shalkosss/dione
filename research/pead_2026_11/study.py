"""Fase 4, ítem 1 — Drift post-earnings. Paso 2: estudio.

Hipótesis del scan por eventos: después de publicar resultados, las acciones que
reaccionaron mejor que el mercado siguen rindiendo mejor (y las peores, peor).

Definiciones (fijadas antes de mirar resultados):
  día 0      primera sesión en la que el mercado pudo operar la noticia: la
             misma fecha si el 8-K se aceptó antes del cierre (16:00 NY), la
             siguiente si se aceptó después. Igual que lib/earningsEvents.js.
  reacción   retorno del cierre de d-1 al cierre de d+1, menos el de SPY.
  drift h    retorno del cierre de d+1 al cierre de d+1+h, menos el de SPY
             (o del ETF de su sector), con h = 20 y 60 sesiones.
  señal      quintil de la reacción dentro del trimestre calendario del día 0.
  prueba     por trimestre: diferencia de drift medio Q5 − Q1 y correlación de
             rangos (IC) entre reacción y drift. t = media / error estándar de
             la serie trimestral (Newey-West con 1 rezago).
  muestra    descubrimiento 2012–2018, validación 2019–hoy. Se informa todo.

Variantes probadas: 2 horizontes × 2 benchmarks × 2 estadísticos = 8.
Uso: python study.py   (necesita data/ de fetch.py)
"""
import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
HORIZONS = [20, 60]
SPLIT = pd.Timestamp("2019-01-01")
ROUND_TRIP_COST = 0.003  # 30 pb por pierna (entrada y salida), conservador para large caps
SECTOR_ETF = {
    "Information Technology": "XLK", "Financials": "XLF", "Health Care": "XLV", "Consumer Discretionary": "XLY",
    "Communication Services": "XLC", "Industrials": "XLI", "Consumer Staples": "XLP", "Energy": "XLE",
    "Utilities": "XLU", "Real Estate": "XLRE", "Materials": "XLB",
}


def day_zero(accepted_utc, index):
    """Posición en `index` del día 0 (o None)."""
    ny = accepted_utc.tz_convert("America/New_York")
    date = pd.Timestamp(ny.date())
    after_close = ny.hour * 60 + ny.minute >= 16 * 60
    pos = index.searchsorted(date, side="right" if after_close else "left")
    return pos if pos < len(index) else None


def window_return(series, i, j):
    if i < 0 or j >= len(series):
        return np.nan
    a, b = series.iloc[i], series.iloc[j]
    return b / a - 1 if a > 0 else np.nan


def build_panel():
    u = pd.read_csv(os.path.join(DATA, "universe.csv"), parse_dates=["added"])
    # Una empresa con dos clases (GOOGL y GOOG) cuenta una sola vez.
    u = u.drop_duplicates("cik").set_index("sym")
    ev = pd.read_csv(os.path.join(DATA, "events.csv"))
    ev = ev[ev["sym"].isin(u.index)]
    px = pd.read_pickle(os.path.join(DATA, "px.pkl"))
    spy = px["SPY"]["a"]
    ev["accepted"] = pd.to_datetime(ev["accepted"], utc=True, errors="coerce")
    ev = ev.dropna(subset=["accepted"]).sort_values(["sym", "accepted"])

    rows, dropped = [], {"sin_precio": 0, "fuera_del_indice": 0, "duplicado": 0, "sin_ventana": 0, "dato_raro": 0}
    for sym, group in ev.groupby("sym"):
        if sym not in px:
            dropped["sin_precio"] += len(group)
            continue
        s = px[sym]["a"]
        s = s[~s.index.duplicated()]
        bench = spy.reindex(s.index).ffill()
        sector = u.loc[sym, "sector"] if sym in u.index else None
        etf_sym = SECTOR_ETF.get(sector)
        etf = px[etf_sym]["a"].reindex(s.index).ffill() if etf_sym in px else None
        added = u.loc[sym, "added"] if sym in u.index else pd.NaT
        last_d0 = None
        for e in group.itertuples():
            d0 = day_zero(e.accepted, s.index)
            if d0 is None or d0 < 1:
                dropped["sin_ventana"] += 1
                continue
            date0 = s.index[d0]
            if pd.notna(added) and date0 < added:
                dropped["fuera_del_indice"] += 1
                continue
            # Dos 8-K 2.02 en menos de 30 días (preanuncio y resultado): vale el primero.
            if last_d0 is not None and (date0 - last_d0).days < 30:
                dropped["duplicado"] += 1
                continue
            last_d0 = date0
            reaction = window_return(s, d0 - 1, d0 + 1) - window_return(bench, d0 - 1, d0 + 1)
            if not np.isfinite(reaction) or abs(reaction) > 0.5:
                dropped["dato_raro"] += 1
                continue
            row = {"sym": sym, "sector": sector, "d0": date0, "reaction": reaction}
            for h in HORIZONS:
                raw = window_return(s, d0 + 1, d0 + 1 + h)
                row[f"drift{h}_spy"] = raw - window_return(bench, d0 + 1, d0 + 1 + h)
                row[f"drift{h}_etf"] = raw - window_return(etf, d0 + 1, d0 + 1 + h) if etf is not None else np.nan
            rows.append(row)
    panel = pd.DataFrame(rows)
    panel["quarter"] = panel["d0"].dt.to_period("Q")
    return panel, dropped


def newey_west_t(x, lags=1):
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    n = len(x)
    if n < 8:
        return np.nan
    e = x - x.mean()
    var = e @ e / n
    for lag in range(1, lags + 1):
        w = 1 - lag / (lags + 1)
        var += 2 * w * (e[lag:] @ e[:-lag]) / n
    return x.mean() / np.sqrt(var / n) if var > 0 else np.nan


def quarterly(panel, col):
    out = []
    for q, g in panel.dropna(subset=[col]).groupby("quarter"):
        if len(g) < 50:
            continue
        quint = pd.qcut(g["reaction"].rank(method="first"), 5, labels=False)
        spread = g.loc[quint == 4, col].mean() - g.loc[quint == 0, col].mean()
        ic = g["reaction"].rank().corr(g[col].rank())
        out.append({"quarter": q, "start": q.start_time, "n": len(g), "spread": spread, "ic": ic,
                    "q1": g.loc[quint == 0, col].mean(), "q5": g.loc[quint == 4, col].mean()})
    return pd.DataFrame(out)


def summarize(qdf, h):
    def block(d):
        return {
            "trimestres": int(len(d)),
            "eventos": int(d["n"].sum()),
            "spread_q5_q1": float(d["spread"].mean()),
            "t_spread": float(newey_west_t(d["spread"])),
            "spread_neto_costos": float(d["spread"].mean() - 2 * ROUND_TRIP_COST),
            "ic_medio": float(d["ic"].mean()),
            "t_ic": float(newey_west_t(d["ic"])),
            "q1": float(d["q1"].mean()),
            "q5": float(d["q5"].mean()),
            "pct_trimestres_spread_positivo": float((d["spread"] > 0).mean()),
        }
    return {
        "total": block(qdf),
        "descubrimiento_2012_2018": block(qdf[qdf["start"] < SPLIT]),
        "validacion_2019_hoy": block(qdf[qdf["start"] >= SPLIT]),
        "horizonte_sesiones": h,
    }


def by_sign(panel, col):
    d = panel.dropna(subset=[col])
    big_up, big_down = d[d["reaction"] > 0.05], d[d["reaction"] < -0.05]
    return {"reaccion_mayor_5pct": {"n": int(len(big_up)), "drift_medio": float(big_up[col].mean())},
            "reaccion_menor_-5pct": {"n": int(len(big_down)), "drift_medio": float(big_down[col].mean())}}


if __name__ == "__main__":
    panel, dropped = build_panel()
    print("eventos válidos:", len(panel), "· descartados:", dropped)
    print("rango:", panel["d0"].min().date(), "a", panel["d0"].max().date(), "· empresas:", panel["sym"].nunique())
    results = {"eventos": int(len(panel)), "empresas": int(panel["sym"].nunique()), "descartados": dropped,
               "desde": str(panel["d0"].min().date()), "hasta": str(panel["d0"].max().date()), "variantes": {}}
    for h in HORIZONS:
        for bench in ["spy", "etf"]:
            col = f"drift{h}_{bench}"
            qdf = quarterly(panel, col)
            res = summarize(qdf, h)
            res["por_signo"] = by_sign(panel, col)
            results["variantes"][col] = res
            t, v, dv = res["total"], res["validacion_2019_hoy"], res["descubrimiento_2012_2018"]
            print(f"{col:13s} spread {t['spread_q5_q1']:+.2%} (t {t['t_spread']:.2f}) · IC {t['ic_medio']:+.3f} (t {t['t_ic']:.2f})"
                  f" · 2012-18 {dv['spread_q5_q1']:+.2%} (t {dv['t_spread']:.2f}) · 2019+ {v['spread_q5_q1']:+.2%} (t {v['t_spread']:.2f})"
                  f" · neto {t['spread_neto_costos']:+.2%}")
    with open(os.path.join(HERE, "results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    panel.to_pickle(os.path.join(DATA, "panel.pkl"))
    print("guardado results.json")
