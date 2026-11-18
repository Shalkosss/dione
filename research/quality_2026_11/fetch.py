"""Fase 4, ítem 3 — Factores de calidad por fecha de publicación. Paso 1: datos.

Para cada empresa del S&P 500 (universo del laboratorio de drift, que ya tiene
precios en ../pead_2026_11/data) baja su companyfacts de EDGAR y guarda los
valores anuales de 10-K con la FECHA EN QUE SE PRESENTARON. Así el estudio usa
solo lo que el mercado ya conocía en cada fecha (sin mirar el futuro).

Salida: data/facts.csv con columnas sym, concept, end, filed, val
Uso: python fetch.py   (~3 minutos; SEC pide <10 pedidos por segundo)
"""
import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
PEAD = os.path.join(HERE, "..", "pead_2026_11", "data")
os.makedirs(DATA, exist_ok=True)
SEC_UA = os.environ.get("SEC_USER_AGENT", "DIONE-research research@example.com")

# Concepto lógico → tags us-gaap en orden de preferencia (como lib/edgar.js).
CONCEPTS = {
    "ni": ["NetIncomeLoss", "ProfitLoss"],
    "rev": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "gp": ["GrossProfit"],
    "cogs": ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities"],
    "assets": ["Assets"],
    "eq": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
}
FLOWS = {"ni", "rev", "gp", "cogs", "ocf"}


def companyfacts(cik):
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json"
    for k in range(3):
        out = subprocess.run(["curl", "-s", "-m", "30", "-A", SEC_UA, url], capture_output=True, text=True, encoding="utf-8").stdout
        try:
            return json.loads(out)
        except Exception:
            time.sleep(1 + k)
    return None


def annual_rows(sym, j):
    facts = (j or {}).get("facts", {}).get("us-gaap", {})
    rows = []
    for concept, tags in CONCEPTS.items():
        for tag in tags:
            for e in facts.get(tag, {}).get("units", {}).get("USD", []):
                if not str(e.get("form", "")).startswith("10-K") or "filed" not in e or "end" not in e:
                    continue
                if concept in FLOWS:
                    if "start" not in e:
                        continue
                    days = (pd.Timestamp(e["end"]) - pd.Timestamp(e["start"])).days
                    if not 330 <= days <= 400:
                        continue
                elif "start" in e:
                    continue
                rows.append({"sym": sym, "concept": concept, "tag_rank": tags.index(tag), "end": e["end"], "filed": e["filed"], "val": e["val"]})
    return rows


def one(args):
    sym, cik = args
    time.sleep(0.5)  # 4 hilos × ~1 pedido cada 0,5 s+ ≈ 6/s
    return annual_rows(sym, companyfacts(cik))


if __name__ == "__main__":
    u = pd.read_csv(os.path.join(PEAD, "universe.csv")).drop_duplicates("cik")
    rows = []
    with ThreadPoolExecutor(4) as ex:
        for i, r in enumerate(ex.map(one, zip(u["sym"], u["cik"]))):
            rows += r
            if i % 100 == 0:
                print(f"  {i}/{len(u)} · filas {len(rows)}", flush=True)
    df = pd.DataFrame(rows)
    # Por concepto, fecha de cierre y fecha de presentación, el tag preferido.
    df = df.sort_values("tag_rank").drop_duplicates(["sym", "concept", "end", "filed"]).drop(columns="tag_rank")
    df.to_csv(os.path.join(DATA, "facts.csv"), index=False)
    print("empresas:", df["sym"].nunique(), "· filas:", len(df))
