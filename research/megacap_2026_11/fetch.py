"""¿Comprar las N más grandes del S&P 500 le gana al índice? Paso 1: datos.

Baja, sin keys:
  1. Membresía del S&P 500 por fecha (Wikipedia: lista actual más el historial
     de altas y bajas, deshecho hacia atrás; misma función que smallmid).
  2. Precios diarios desde 2009 con splits (Yahoo chart v8) de todos los que
     fueron miembros, y SPY.
  3. Acciones en circulación tal como se publicaron (companyfacts de EDGAR):
     promedio diluido del período, o básico, o la portada (dei). Cada dato
     existe desde su fecha de presentación.

Capitalización en la fecha d = cierre ajustado por splits en d × acciones
publicadas × splits posteriores a la presentación (así un split de NVDA en
2024 no achica su capitalización de 2020).

Salida en data/: pit.csv, members.csv, px.pkl, splits.pkl, shares.csv, ciks.csv.
Uso: python fetch.py   (~10 minutos)
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "smallmid_2026_11"))
sys.path.insert(0, os.path.join(HERE, "..", "pead_2026_11"))
from fetch import curl, sec_json, SEC_UA  # noqa: E402  (pead)
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("smallmid_fetch", os.path.join(HERE, "..", "smallmid_2026_11", "fetch.py"))
smallmid = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(smallmid)

DATA = os.path.join(HERE, "data")
os.makedirs(DATA, exist_ok=True)
START = "2009-06-01"
# Orden de preferencia de la cantidad de acciones.
SHARE_TAGS = [
    ("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding"),
    ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic"),
    ("dei", "EntityCommonStockSharesOutstanding"),
]


def wiki_500():
    """Miembros actuales y altas y bajas. Desde ago-2026 el historial vive en
    una página aparte ("Historical components of the S&P 500")."""
    import io
    members = pd.read_html(io.StringIO(curl("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")))[0]
    members = members.rename(columns={"Symbol": "sym", "GICS Sector": "sector"})
    members = members.assign(sym=members["sym"].map(smallmid.norm), index="S&P 500")[["sym", "sector", "index"]]
    ch = pd.read_html(io.StringIO(curl("https://en.wikipedia.org/wiki/Historical_components_of_the_S%26P_500")))[0]
    ch.columns = ["date", "added", "added_name", "removed", "removed_name", "reason", "refs"][: len(ch.columns)]
    ch = ch.assign(date=pd.to_datetime(ch["date"], errors="coerce"), index="S&P 500")
    ok = lambda x: isinstance(x, str) and x.strip() and x.strip().lower() != "nan"  # noqa: E731
    ch["added"] = ch["added"].map(lambda x: smallmid.norm(x) if ok(x) else None)
    ch["removed"] = ch["removed"].map(lambda x: smallmid.norm(x) if ok(x) else None)
    return members, ch.dropna(subset=["date"])[["date", "index", "added", "removed"]]


def yahoo(sym):
    p1 = int(pd.Timestamp(START).timestamp())
    p2 = int(time.time())
    for k in range(4):
        try:
            host = "query1" if k % 2 == 0 else "query2"
            j = json.loads(curl(f"https://{host}.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2={p2}&interval=1d&events=div%2Csplit"))["chart"]["result"][0]
            q = j["indicators"]["quote"][0]
            df = pd.DataFrame({"c": q["close"], "a": j["indicators"]["adjclose"][0]["adjclose"]},
                              index=pd.to_datetime(j["timestamp"], unit="s").normalize())
            df = df.dropna()
            df = df[~df.index.duplicated(keep="last")]
            sp = [(pd.to_datetime(v["date"], unit="s").normalize(), v["numerator"] / v["denominator"])
                  for v in (j.get("events", {}).get("splits", {}) or {}).values()]
            return sym, df, sp
        except Exception:
            time.sleep(2 + 2 * k)
    return sym, None, None


def companyfacts(cik):
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json"
    for k in range(3):
        out = subprocess.run(["curl", "-s", "--compressed", "-m", "40", "-A", SEC_UA, url], capture_output=True, text=True, encoding="utf-8").stdout
        try:
            return json.loads(out)
        except Exception:
            time.sleep(1 + k)
    return None


def share_rows(cik, j):
    """Primera publicación de cada cierre, por tag; el tag preferido gana."""
    rows = []
    for rank, (tax, tag) in enumerate(SHARE_TAGS):
        for e in (j or {}).get("facts", {}).get(tax, {}).get(tag, {}).get("units", {}).get("shares", []):
            if e.get("form") in ("10-K", "10-Q", "10-K/A", "10-Q/A") and e.get("val", 0) > 0:
                rows.append({"cik": cik, "rank": rank, "end": e["end"], "filed": e["filed"], "val": e["val"]})
    return rows


if __name__ == "__main__":
    members, changes = wiki_500()
    print("cambios:", len(changes), "· desde", changes["date"].min().date(), "· desde 2010:", int((changes["date"] >= "2010-01-01").sum()), flush=True)
    pit = smallmid.point_in_time(members, changes)
    pit = pit[pit["sym"].map(lambda x: isinstance(x, str) and x not in ("", "NAN"))]
    pit.to_csv(os.path.join(DATA, "pit.csv"), index=False)
    members.to_csv(os.path.join(DATA, "members.csv"), index=False)
    alive = pit[(pit["end"].isna()) | (pit["end"] >= START)]
    syms = sorted(set(alive["sym"]))
    print("miembros hoy:", len(members), "· símbolos con membresía desde", START, ":", len(syms), flush=True)

    px, splits = {}, {}
    with ThreadPoolExecutor(4) as ex:
        for s, df, sp in ex.map(yahoo, syms + ["SPY"]):
            if df is not None and len(df) > 20:
                px[s], splits[s] = df, sp
    pd.to_pickle(px, os.path.join(DATA, "px.pkl"))
    pd.to_pickle(splits, os.path.join(DATA, "splits.pkl"))
    print("precios:", len(px), "de", len(syms) + 1, flush=True)

    tickers = sec_json("https://www.sec.gov/files/company_tickers.json")
    cik_map = {str(r["ticker"]).upper().replace(".", "-"): r["cik_str"] for r in tickers.values()}
    ciks = pd.DataFrame([{"sym": s, "cik": cik_map.get(s)} for s in syms])
    ciks.to_csv(os.path.join(DATA, "ciks.csv"), index=False)
    todo = sorted(set(ciks["cik"].dropna().astype(int)))
    print("con CIK:", ciks["cik"].notna().sum(), "· CIKs:", len(todo), flush=True)

    rows = []
    for i, cik in enumerate(todo):
        rows += share_rows(cik, companyfacts(cik))
        time.sleep(0.15)
        if i % 100 == 0:
            print(f"  companyfacts {i}/{len(todo)}", flush=True)
    sh = pd.DataFrame(rows).sort_values(["cik", "rank", "end", "filed"])
    sh = sh.drop_duplicates(["cik", "rank", "end"], keep="first")
    sh.to_csv(os.path.join(DATA, "shares.csv"), index=False)
    print("filas de acciones:", len(sh))


# Empresas grandes que cambiaron de CIK al reorganizarse en un holding nuevo:
# su historia previa está en el CIK anterior. Símbolo → CIK anterior.
PREDECESSORS = {
    "GOOGL": 1288776, "GOOG": 1288776,  # Google Inc. → Alphabet (2015)
    "XOM": 34088,                       # Exxon Mobil → holding nuevo (2026)
    "DIS": 1001039,                     # Disney → TWDC Holdco (2019)
    "BLK": 1364742,                     # BlackRock → holding nuevo (2024)
    "LIN": 884905,                      # Praxair → Linde plc (2018)
    "AVGO": 1441634,                    # Avago/Broadcom Ltd → Broadcom Inc. (2018)
    "MDT": 64670,                       # Medtronic Inc. → Medtronic plc (2015)
    "CI": 701221,                       # Cigna → Cigna Group (2018)
    "APA": 6769,                        # Apache → APA Corp. (2021)
}


def extra():
    """Agrega a shares.csv la historia de los CIK anteriores, con el CIK actual."""
    ciks = pd.read_csv(os.path.join(DATA, "ciks.csv"))
    sh = pd.read_csv(os.path.join(DATA, "shares.csv"))
    rows = []
    for sym, old in PREDECESSORS.items():
        cur = ciks.loc[ciks["sym"] == sym, "cik"]
        if cur.empty or pd.isna(cur.iloc[0]):
            continue
        got = share_rows(int(cur.iloc[0]), companyfacts(old))
        print(f"  {sym}: CIK anterior {old} → {len(got)} filas", flush=True)
        rows += got
        time.sleep(0.2)
    add = pd.DataFrame(rows).sort_values(["cik", "rank", "end", "filed"]).drop_duplicates(["cik", "rank", "end"], keep="first")
    sh = pd.concat([sh, add]).drop_duplicates(["cik", "rank", "end"], keep="first")
    sh.to_csv(os.path.join(DATA, "shares.csv"), index=False)
    print("filas de acciones:", len(sh))
