import React, { createContext, useContext, useState, useEffect } from "react";

/* Estado global del portafolio. Persiste en localStorage del navegador
   (en la app desplegada esto funciona — es tu propio dominio). */

const STORAGE_KEY = "dione:portfolio:v1";

const DEFAULT_ASSETS = [
  { ticker: "VOO", sector: "US Broad", er: 8.0, vol: 15.5, beta: 1.0, w: 35, conf: "med", useView: false },
  { ticker: "MELI", sector: "Cons. Disc.", er: 18.0, vol: 38.0, beta: 1.49, w: 18, conf: "med", useView: true },
  { ticker: "NU", sector: "Financials", er: 24.0, vol: 42.0, beta: 1.01, w: 14, conf: "med", useView: true },
  { ticker: "VWO", sector: "EM Equity", er: 9.0, vol: 18.0, beta: 0.9, w: 13, conf: "low", useView: false },
  { ticker: "GLD", sector: "Gold", er: 5.0, vol: 14.0, beta: 0.05, w: 10, conf: "low", useView: false },
  { ticker: "CASH", sector: "Cash", er: 4.3, vol: 0.0, beta: 0.0, w: 10, conf: "high", useView: false },
];

const DEFAULT_PARAMS = {
  rf: 4.3,
  mktEr: 8.0,
  mktVol: 15.5,
  portSize: 5000,
  account: "real", // real | paper
  applyCap: true,
  returnMode: "direct", // direct | bl
};

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [loaded, setLoaded] = useState(false);

  // cargar al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.assets)) setAssets(s.assets);
        if (s.params) setParams({ ...DEFAULT_PARAMS, ...s.params });
      }
    } catch (e) {
      /* primera vez — sin estado guardado */
    }
    setLoaded(true);
  }, []);

  // guardar en cada cambio
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ assets, params })
      );
    } catch (e) {
      /* localStorage lleno o bloqueado */
    }
  }, [assets, params, loaded]);

  const setParam = (key, val) =>
    setParams((p) => ({ ...p, [key]: val }));

  const resetPortfolio = () => {
    setAssets(DEFAULT_ASSETS);
    setParams(DEFAULT_PARAMS);
  };

  // Inyecta vol, beta y (opcionalmente) sector reales en un activo del portafolio
  const applyHistoricalData = (ticker, vol90, beta90, sector) =>
    setAssets((prev) =>
      prev.map((a) =>
        a.ticker === ticker
          ? {
              ...a,
              ...(vol90 != null ? { vol: vol90 } : {}),
              ...(beta90 != null ? { beta: beta90 } : {}),
              ...(sector ? { sector } : {}),
            }
          : a
      )
    );

  // Agrega un ticker nuevo al portfolio (desde el Screener). Si ya existe, no-op.
  const addAssetToPortfolio = (ticker, sector) =>
    setAssets((prev) => {
      if (prev.some((a) => a.ticker.toUpperCase() === ticker.toUpperCase())) return prev;
      return [
        ...prev,
        { ticker, sector: sector || "—", er: 8, vol: 25, beta: 1, w: 0, conf: "med", useView: false },
      ];
    });

  return (
    <PortfolioContext.Provider
      value={{ assets, setAssets, params, setParams, setParam, resetPortfolio, applyHistoricalData, addAssetToPortfolio }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx)
    throw new Error("usePortfolio debe usarse dentro de PortfolioProvider");
  return ctx;
}

export const CONF_MAP = { low: 0.25, med: 0.5, high: 0.8 };
