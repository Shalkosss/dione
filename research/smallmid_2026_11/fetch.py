"""Fase 4, ítem 2 — Small y mid caps (S&P 600 y S&P 400). Paso 1: datos.

Baja, sin keys:
  1. Constituyentes actuales del S&P 400 y 600 y su historial de altas y bajas
     (Wikipedia). Con eso se arma la membresía por fecha (pit.csv): se parte de
     la lista de hoy y se deshacen los cambios hacia atrás.
  2. Precios diarios ajustados desde 2011 de miembros actuales y ex miembros
     (Yahoo); los que Yahoo ya no tiene quedan fuera y se cuentan.
  3. Publicaciones de resultados (8-K ítem 2.02) de los que tienen CIK en la SEC.

Salida en data/: members.csv, changes.csv, pit.csv, px.pkl, events.csv.
Uso: python fetch.py   (~30 minutos)
"""
import io
import json
import os
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "pead_2026_11"))
from fetch import curl, sec_json, filings_for, prices as fetch_prices_into  # noqa: E402  (reusa el laboratorio anterior)

DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)
INDEXES = {"S&P 400": "List_of_S%26P_400_companies", "S&P 600": "List_of_S%26P_600_companies"}
ETFS = ["SPY", "IJH", "IJR", "MDY"]


def norm(t):
    return str(t).strip().upper().replace(".", "-")


def wiki(index, page):
    tables = pd.read_html(io.StringIO(curl(f"https://en.wikipedia.org/wiki/{page}")))
    members = tables[0].rename(columns={"Symbol": "sym", "GICS Sector": "sector"})
    members = members.assign(sym=members["sym"].map(norm), index=index)[["sym", "sector", "index"]]
    ch = tables[1]
    ch.columns = ["date", "added", "added_name", "removed", "removed_name", "reason"][: len(ch.columns)]
    ch = ch.assign(date=pd.to_datetime(ch["date"], errors="coerce"), index=index)
    ch["added"] = ch["added"].map(lambda x: norm(x) if isinstance(x, str) and x.strip() and x.strip().lower() != "nan" else None)
    ch["removed"] = ch["removed"].map(lambda x: norm(x) if isinstance(x, str) and x.strip() else None)
    return members, ch.dropna(subset=["date"])[["date", "index", "added", "removed"]]


def point_in_time(members, changes):
    """Intervalos de membresía [desde, hasta) por símbolo e índice."""
    rows = []
    for index in members["index"].unique():
        current = set(members.loc[members["index"] == index, "sym"])
        start = {s: None for s in current}  # None = desde antes del primer cambio
        ch = changes[changes["index"] == index].sort_values("date", ascending=False)
        end_of = {}
        for c in ch.itertuples():
            if c.added and c.added in current:
                rows.append({"sym": c.added, "index": index, "start": c.date, "end": end_of.pop(c.added, None)})
                current.discard(c.added)
                start.pop(c.added, None)
            if c.removed:
                end_of[c.removed] = c.date
                current.add(c.removed)
                start[c.removed] = None
        for s in current:
            rows.append({"sym": s, "index": index, "start": None, "end": end_of.get(s)})
    pit = pd.DataFrame(rows)
    pit["start"] = pd.to_datetime(pit["start"])
    pit["end"] = pd.to_datetime(pit["end"])
    return pit


def events_for(symbols):
    cik_map = {str(r["ticker"]).upper(): r["cik_str"] for r in sec_json("https://www.sec.gov/files/company_tickers.json").values()}
    out, no_cik = [], []
    for i, s in enumerate(symbols):
        cik = cik_map.get(s) or cik_map.get(s.replace("-", "."))
        if cik is None:
            no_cik.append(s)
            continue
        rows = filings_for(cik) or []
        out += [{"sym": s, **x} for x in rows]
        if i % 100 == 0:
            print(f"  EDGAR {i}/{len(symbols)} · eventos {len(out)}", flush=True)
    ev = pd.DataFrame(out).drop_duplicates(["sym", "filed"])
    ev.to_csv(os.path.join(DATA, "events.csv"), index=False)
    print("sin CIK en la SEC:", len(no_cik))
    return ev


if __name__ == "__main__":
    parts = [wiki(i, p) for i, p in INDEXES.items()]
    members = pd.concat([m for m, _ in parts])
    changes = pd.concat([c for _, c in parts])
    members.to_csv(os.path.join(DATA, "members.csv"), index=False)
    changes.to_csv(os.path.join(DATA, "changes.csv"), index=False)
    pit = point_in_time(members, changes)
    pit.to_csv(os.path.join(DATA, "pit.csv"), index=False)
    pit = pit[pit["sym"].map(lambda x: isinstance(x, str) and x not in ("", "NAN"))]
    pit.to_csv(os.path.join(DATA, "pit.csv"), index=False)
    syms = sorted(set(pit["sym"]))
    print("miembros hoy:", len(members), "· cambios:", len(changes), "· símbolos con historia:", len(syms),
          "· primer cambio:", changes["date"].min().date())
    # Los precios del laboratorio anterior se guardan en su propio data/; acá se
    # redirige la salida.
    import fetch as pead_fetch
    pead_fetch.DATA = DATA
    fetch_prices_into(syms + ETFS)
    events_for(syms)
