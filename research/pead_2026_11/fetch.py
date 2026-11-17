"""Fase 4, ítem 1 — Drift post-earnings. Paso 1: datos.

Baja, sin keys:
  1. Constituyentes actuales del S&P 500 con su CIK y fecha de alta (Wikipedia).
  2. Todas las publicaciones de resultados (8-K con ítem 2.02) de cada CIK desde
     2012, con la hora de aceptación (SEC EDGAR submissions, páginas viejas incluidas).
  3. Precios diarios ajustados desde 2011 de cada acción, SPY y los 11 ETFs
     sectoriales (Yahoo chart v8).

Salida en data/ (fuera del repo): universe.csv, events.csv, px.pkl.
Uso: python fetch.py   (unos 10 minutos; SEC pide <10 pedidos por segundo)
"""
import io
import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)

SEC_UA = os.environ.get("SEC_USER_AGENT", "DIONE-research research@example.com")
BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
START = "2012-01-01"
ETFS = ["SPY", "XLK", "XLF", "XLV", "XLY", "XLC", "XLI", "XLP", "XLE", "XLU", "XLRE", "XLB"]


def curl(url, ua=BROWSER_UA, timeout=40):
    out = subprocess.run(["curl", "-s", "-L", "-m", str(timeout), "-A", ua, url], capture_output=True, text=True, encoding="utf-8")
    return out.stdout


def universe():
    html = curl("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
    t = pd.read_html(io.StringIO(html))[0]
    t = t.rename(columns={"Symbol": "sym", "GICS Sector": "sector", "Date added": "added", "CIK": "cik"})
    t["sym"] = t["sym"].str.replace(".", "-", regex=False)
    t["added"] = pd.to_datetime(t["added"], errors="coerce")
    t = t[["sym", "cik", "sector", "added"]]
    t.to_csv(os.path.join(DATA, "universe.csv"), index=False)
    return t


def sec_json(url):
    for k in range(3):
        try:
            return json.loads(curl(url, ua=SEC_UA, timeout=20))
        except Exception:
            time.sleep(1 + k)
    return None


def earnings_rows(block):
    rows = []
    for f, items, d, acc in zip(block.get("form", []), block.get("items", []), block.get("filingDate", []), block.get("acceptanceDateTime", [])):
        if f == "8-K" and "2.02" in [s.strip() for s in str(items).split(",")] and d >= START:
            rows.append({"filed": d, "accepted": acc})
    return rows


def filings_for(cik):
    base = sec_json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json")
    if not base:
        return None
    rows = earnings_rows(base["filings"]["recent"])
    for page in base["filings"].get("files", []):
        if page.get("filingTo", "9999") < START:
            continue
        time.sleep(0.15)
        extra = sec_json(f"https://data.sec.gov/submissions/{page['name']}")
        if extra:
            rows += earnings_rows(extra)
    return rows


def events(u):
    out, missing = [], []
    for i, r in enumerate(u.itertuples()):
        rows = filings_for(r.cik)
        time.sleep(0.15)
        if rows is None:
            missing.append(r.sym)
            continue
        out += [{"sym": r.sym, **x} for x in rows]
        if i % 50 == 0:
            print(f"  EDGAR {i}/{len(u)} · eventos {len(out)}", flush=True)
    ev = pd.DataFrame(out).drop_duplicates(["sym", "filed"])
    ev.to_csv(os.path.join(DATA, "events.csv"), index=False)
    print("EDGAR sin respuesta:", missing)
    return ev


def yahoo(sym):
    p1 = int(pd.Timestamp("2011-06-01").timestamp())
    p2 = int(time.time())
    for k in range(4):
        try:
            host = "query1" if k % 2 == 0 else "query2"
            j = json.loads(curl(f"https://{host}.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2={p2}&interval=1d&events=div%2Csplit"))["chart"]["result"][0]
            q = j["indicators"]["quote"][0]
            df = pd.DataFrame({"o": q["open"], "c": q["close"], "a": j["indicators"]["adjclose"][0]["adjclose"]},
                              index=pd.to_datetime(j["timestamp"], unit="s").normalize())
            return sym, df.dropna(subset=["c", "a"])
        except Exception:
            time.sleep(2 + 2 * k)
    return sym, None


def prices(syms):
    out = {}
    with ThreadPoolExecutor(4) as ex:
        for s, df in ex.map(yahoo, syms):
            if df is not None and len(df) > 60:
                out[s] = df
    pd.to_pickle(out, os.path.join(DATA, "px.pkl"))
    print("precios:", len(out), "de", len(syms), "· faltan", [s for s in syms if s not in out][:20])
    return out


if __name__ == "__main__":
    u = universe()
    print("universo:", len(u))
    ev = events(u)
    print("eventos 8-K 2.02:", len(ev))
    prices(list(u["sym"]) + ETFS)
