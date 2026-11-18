"""Fase 4, ítem 2 (parte de eventos) — Drift post-earnings en small y mid caps.

Mismo diseño que research/pead_2026_11/study.py (el del S&P 500), con dos
cambios fijados antes de ver resultados:
  universo    miembros del S&P 400 o 600 en la fecha del evento (pit.csv)
  benchmark   el ETF de su índice: IJH (S&P 400) o IJR (S&P 600), en vez de
              SPY y del ETF sectorial
  costos      50 pb por pierna (1% ida y vuelta, 2% el largo-corto)
Variantes probadas: 2 horizontes × 2 estadísticos = 4.

Uso: python study_pead.py   (necesita data/ de fetch.py)
"""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pead_2026_11"))
import study as base  # noqa: E402  (day_zero, window_return, quarterly, newey_west_t)

DATA = os.path.join(HERE, "data")
HORIZONS = [20, 60]
INDEX_ETF = {"S&P 400": "IJH", "S&P 600": "IJR"}
base.ROUND_TRIP_COST = 0.01


def member_index(pit, sym, date):
    m = pit[(pit["sym"] == sym) & (pit["start"].isna() | (pit["start"] <= date)) & (pit["end"].isna() | (pit["end"] > date))]
    return m["index"].iloc[0] if len(m) else None


def build_panel():
    pit = pd.read_csv(os.path.join(DATA, "pit.csv"), parse_dates=["start", "end"])
    ev = pd.read_csv(os.path.join(DATA, "events.csv"))
    px = pd.read_pickle(os.path.join(DATA, "px.pkl"))
    ev["accepted"] = pd.to_datetime(ev["accepted"], utc=True, errors="coerce")
    ev = ev.dropna(subset=["accepted"]).sort_values(["sym", "accepted"])
    rows, dropped = [], {"sin_precio": 0, "fuera_del_indice": 0, "duplicado": 0, "sin_ventana": 0, "dato_raro": 0}
    pit_by_sym = {s: g for s, g in pit.groupby("sym")}
    for sym, group in ev.groupby("sym"):
        if sym not in px:
            dropped["sin_precio"] += len(group)
            continue
        s = px[sym]["a"]
        s = s[~s.index.duplicated()]
        benches = {name: px[etf]["a"].reindex(s.index).ffill() for name, etf in INDEX_ETF.items() if etf in px}
        last_d0 = None
        for e in group.itertuples():
            d0 = base.day_zero(e.accepted, s.index)
            if d0 is None or d0 < 1:
                dropped["sin_ventana"] += 1
                continue
            date0 = s.index[d0]
            index = member_index(pit_by_sym.get(sym, pit.iloc[0:0]), sym, date0)
            if index is None or index not in benches:
                dropped["fuera_del_indice"] += 1
                continue
            if last_d0 is not None and (date0 - last_d0).days < 30:
                dropped["duplicado"] += 1
                continue
            last_d0 = date0
            bench = benches[index]
            reaction = base.window_return(s, d0 - 1, d0 + 1) - base.window_return(bench, d0 - 1, d0 + 1)
            if not np.isfinite(reaction) or abs(reaction) > 0.6:
                dropped["dato_raro"] += 1
                continue
            row = {"sym": sym, "index": index, "d0": date0, "reaction": reaction}
            for h in HORIZONS:
                row[f"drift{h}_idx"] = base.window_return(s, d0 + 1, d0 + 1 + h) - base.window_return(bench, d0 + 1, d0 + 1 + h)
            rows.append(row)
    panel = pd.DataFrame(rows)
    panel["quarter"] = panel["d0"].dt.to_period("Q")
    return panel, dropped


if __name__ == "__main__":
    panel, dropped = build_panel()
    print("eventos válidos:", len(panel), "· descartados:", dropped)
    print("rango:", panel["d0"].min().date(), "a", panel["d0"].max().date(), "· empresas:", panel["sym"].nunique(),
          "· por índice:", panel["index"].value_counts().to_dict())
    results = {"eventos": int(len(panel)), "empresas": int(panel["sym"].nunique()), "descartados": dropped,
               "desde": str(panel["d0"].min().date()), "hasta": str(panel["d0"].max().date()), "variantes": {}}
    for h in HORIZONS:
        col = f"drift{h}_idx"
        res = base.summarize(base.quarterly(panel, col), h)
        res["por_signo"] = base.by_sign(panel, col)
        res["por_indice"] = {name: base.summarize(base.quarterly(panel[panel["index"] == name], col), h)["total"] for name in INDEX_ETF}
        results["variantes"][col] = res
        t, d, v = res["total"], res["descubrimiento_2012_2018"], res["validacion_2019_hoy"]
        print(f"{col:12s} spread {t['spread_q5_q1']:+.2%} (t {t['t_spread']:.2f}) · IC {t['ic_medio']:+.3f} (t {t['t_ic']:.2f})"
              f" · 2012-18 {d['spread_q5_q1']:+.2%} (t {d['t_spread']:.2f}) · 2019+ {v['spread_q5_q1']:+.2%} (t {v['t_spread']:.2f})"
              f" · neto {t['spread_neto_costos']:+.2%}")
        for name, b in res["por_indice"].items():
            print(f"   {name}: spread {b['spread_q5_q1']:+.2%} (t {b['t_spread']:.2f}) · IC {b['ic_medio']:+.3f} (t {b['t_ic']:.2f})")
        print("   por signo:", {k: (x["n"], round(x["drift_medio"] * 100, 2)) for k, x in res["por_signo"].items()})
    with open(os.path.join(HERE, "results_pead.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("guardado results_pead.json")
