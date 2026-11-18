"""Fase 4, ítem 2 — Señales de precio en small y mid caps. Paso 2a.

Pregunta: ¿el score de tendencia v4 (TECHNICAL_VALIDATED.md §4) y sus piezas
ordenan el retorno futuro en el S&P 400 y 600? En large caps el rank IC medido
fue casi cero; la web hoy lo muestra con "≈" fuera del universo validado.

Diseño (fijado antes de ver resultados):
  fechas      último día hábil de cada mes, desde 2013 (hacen falta 253 velas)
  universo    miembros del S&P 400 o 600 en esa fecha (pit.csv) con precio
  señales     las del v4 con cierres ajustados: momentum (promedio 12-1 y
              6-1), sobre SMA200, SMA200 subiendo, SMA50 sobre SMA200, fuerza
              relativa 63 ses. contra su índice (IJH o IJR), zona de entrada
              (distancia a SMA50 y RSI 14) y el score compuesto con los mismos
              puntos que lib/trendScore.js (percentil de momentum dentro del mes)
  objetivo    retorno a 63 sesiones menos el promedio del universo ese mes
  prueba      rank IC mensual y diferencia Q5−Q1 del score; t de Newey-West
              con 2 rezagos (los objetivos de 63 sesiones se solapan)
  muestras    2013–2018 y 2019–hoy
  costos      small caps: 50 pb por pierna; ida y vuelta del largo-corto = 2%
              por período de 63 sesiones
  variantes   7 señales + 6 etiquetas + score por índice (2) = 15

Uso: python study_signals.py
"""
import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
H = 63
SPLIT = pd.Timestamp("2019-01-01")
COST_LS = 0.02
INDEX_ETF = {"S&P 400": "IJH", "S&P 600": "IJR"}


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


def rsi(prices, n=14):
    d = prices.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    return 100 - 100 / (1 + up / dn)


def load():
    px = pd.read_pickle(os.path.join(DATA, "px.pkl"))
    pit = pd.read_csv(os.path.join(DATA, "pit.csv"), parse_dates=["start", "end"])
    adj = pd.DataFrame({s: df["a"] for s, df in px.items()}).sort_index()
    adj = adj[~adj.index.duplicated()]
    return adj, pit


def features(adj):
    sma50 = adj.rolling(50, min_periods=50).mean()
    sma200 = adj.rolling(200, min_periods=200).mean()
    mom12 = adj.shift(21) / adj.shift(252) - 1
    mom6 = adj.shift(21) / adj.shift(126) - 1
    return {
        "price": adj, "sma50": sma50, "sma200": sma200,
        "sma200_prev": sma200.shift(20),
        "momentum": ((mom12 + mom6) / 2).where(mom12.notna(), mom6),
        "ret63": adj / adj.shift(63) - 1,
        "dist50": adj / sma50 - 1,
        "rsi": adj.apply(rsi),
        "fwd": adj.shift(-H) / adj - 1,
    }


def members_at(pit, date):
    m = pit[(pit["start"].isna() | (pit["start"] <= date)) & (pit["end"].isna() | (pit["end"] > date))]
    return m.drop_duplicates("sym").set_index("sym")["index"]


def label(row):
    if not row.price > row.sma200:
        return "RECUPERANDO" if row.price > row.sma50 else "ROTA"
    if row.rsi < 40:
        return "RETROCESO"
    if row.dist50 > 0.10 or row.rsi > 75:
        return "EXTENDIDA"
    if abs(row.dist50) <= 0.05:
        return "EN ZONA"
    return "ALCISTA"


def entry_points(d, r):
    if pd.isna(d) or pd.isna(r):
        return 0
    if r > 75 or d > 0.10:
        return 0
    if d < -0.03:
        return 5
    if d <= 0.05 and 40 <= r <= 60:
        return 15
    return 8


def rs_points(diff):
    if pd.isna(diff):
        return 0
    return 15 if diff > 0.05 else 10 if diff > 0 else 5 if diff > -0.05 else 0


def month_panel(F, pit, date):
    idx = members_at(pit, date)
    syms = [s for s in idx.index if s in F["price"].columns]
    snap = pd.DataFrame({k: v.loc[date, syms] for k, v in F.items()})
    snap["index"] = idx.loc[syms]
    snap = snap.dropna(subset=["price", "sma200", "sma200_prev", "momentum", "fwd"])
    if len(snap) < 100:
        return None
    bench = {name: F["ret63"].loc[date].get(etf) for name, etf in INDEX_ETF.items()}
    snap["rs"] = snap["ret63"] - snap["index"].map(bench)
    snap["above200"] = (snap["price"] > snap["sma200"]).astype(float)
    snap["slope200"] = (snap["sma200"] > snap["sma200_prev"]).astype(float)
    snap["stack"] = (snap["sma50"] > snap["sma200"]).astype(float)
    snap["mom_pct"] = snap["momentum"].rank(pct=True)
    snap["entry"] = [entry_points(d, r) for d, r in zip(snap["dist50"], snap["rsi"])]
    snap["score"] = (20 * snap["above200"] + 15 * snap["slope200"] + 10 * snap["stack"]
                     + 25 * snap["mom_pct"] + snap["rs"].map(rs_points) + snap["entry"])
    snap["label"] = snap.apply(label, axis=1)
    snap["target"] = snap["fwd"] - snap["fwd"].mean()
    snap["date"] = date
    return snap


def block(series_ic, series_spread=None):
    out = {"meses": int(series_ic.notna().sum()), "ic_medio": float(series_ic.mean()), "t_ic": float(newey_west_t(series_ic))}
    if series_spread is not None:
        out.update({"spread_q5_q1": float(series_spread.mean()), "t_spread": float(newey_west_t(series_spread)),
                    "spread_neto": float(series_spread.mean() - COST_LS)})
    return out


def split(df, fn):
    return {"total": fn(df), "2013_2018": fn(df[df.index < SPLIT]), "2019_hoy": fn(df[df.index >= SPLIT])}


if __name__ == "__main__":
    adj, pit = load()
    F = features(adj)
    dates = adj.index[(adj.index >= "2013-01-01")].to_series().groupby(adj.index[(adj.index >= "2013-01-01")].to_period("M")).max()
    dates = [d for d in dates if adj.index.get_loc(d) + H < len(adj.index)]
    panels = [p for p in (month_panel(F, pit, d) for d in dates) if p is not None]
    panel = pd.concat(panels)
    print("meses:", len(panels), "· observaciones:", len(panel), "· empresas:", panel.index.nunique(),
          "· desde", panels[0]["date"].iloc[0].date(), "hasta", panels[-1]["date"].iloc[0].date())

    signals = ["score", "momentum", "above200", "slope200", "stack", "rs", "entry"]
    monthly = panel.groupby("date")
    ic = pd.DataFrame({s: monthly.apply(lambda g, s=s: g[s].rank().corr(g["target"].rank())) for s in signals})

    def spread_of(g, col="score"):
        q = pd.qcut(g[col].rank(method="first"), 5, labels=False)
        return g.loc[q == 4, "target"].mean() - g.loc[q == 0, "target"].mean()

    spread = monthly.apply(spread_of)
    results = {"meses": len(panels), "observaciones": int(len(panel)), "horizonte": H, "costo_largo_corto": COST_LS, "senales": {}, "por_indice": {}, "etiquetas": {}}
    for s in signals:
        df = pd.DataFrame({"ic": ic[s], "spread": spread if s == "score" else np.nan})
        results["senales"][s] = split(df, lambda d, s=s: block(d["ic"], d["spread"] if s == "score" else None))
        t = results["senales"][s]
        print(f"{s:9s} IC {t['total']['ic_medio']:+.3f} (t {t['total']['t_ic']:.2f}) · 2013-18 {t['2013_2018']['ic_medio']:+.3f} (t {t['2013_2018']['t_ic']:.2f}) · 2019+ {t['2019_hoy']['ic_medio']:+.3f} (t {t['2019_hoy']['t_ic']:.2f})"
              + (f" · Q5-Q1 {t['total']['spread_q5_q1']:+.2%} (t {t['total']['t_spread']:.2f}) neto {t['total']['spread_neto']:+.2%}" if s == "score" else ""))

    for name in INDEX_ETF:
        sub = panel[panel["index"] == name].groupby("date")
        ics = sub.apply(lambda g: g["score"].rank().corr(g["target"].rank()))
        results["por_indice"][name] = split(pd.DataFrame({"ic": ics}), lambda d: block(d["ic"]))
        print(f"score en {name}: IC {results['por_indice'][name]['total']['ic_medio']:+.3f} (t {results['por_indice'][name]['total']['t_ic']:.2f})")

    labels = panel.groupby(["date", "label"])["target"].mean().unstack()
    for lab in labels.columns:
        x = labels[lab]
        results["etiquetas"][lab] = {"meses": int(x.notna().sum()), "exceso_medio_63s": float(x.mean()), "t": float(newey_west_t(x)),
                                     "peso_promedio": float(panel.groupby("date")["label"].apply(lambda s: (s == lab).mean()).mean())}
        print(f"  {lab:12s} exceso {x.mean():+.2%} (t {newey_west_t(x):.2f})")

    with open(os.path.join(HERE, "results_signals.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    panel.to_pickle(os.path.join(DATA, "panel_signals.pkl"))
    print("guardado results_signals.json")
