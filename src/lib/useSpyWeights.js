// src/lib/useSpyWeights.js — Pesos sectoriales vigentes del S&P 500.
//
// Los trae /api/sectors (cron refresh-technical, fuente SSGA). Se piden una vez
// por carga de página. Si no llegan (desarrollo local, cron sin correr), la
// pantalla sigue con los pesos de respaldo de sectors.js y lo dice.

import { useEffect, useState } from "react";
import { SPY_WEIGHTS, SPY_WEIGHTS_AS_OF, benchFromGics } from "./sectors.js";

const FALLBACK = { bench: SPY_WEIGHTS, label: SPY_WEIGHTS_AS_OF, live: false };
let cached = null;

async function load() {
  try {
    const res = await fetch("/api/sectors");
    if (!res.ok) return FALLBACK;
    const json = await res.json();
    const spy = json?.data?.spyWeights ?? json?.spyWeights ?? null;
    const bench = benchFromGics(spy);
    return bench ? { bench, label: `SSGA ${spy.asOf ?? ""}`.trim(), live: true } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function useSpyWeights() {
  const [state, setState] = useState(FALLBACK);
  useEffect(() => {
    let alive = true;
    cached = cached || load();
    cached.then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, []);
  return state;
}
