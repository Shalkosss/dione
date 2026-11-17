import { useCallback, useEffect, useState } from "react";
import { marketStatus } from "./marketClock.js";

const THEME_KEY = "dione:theme";

function readStored(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch { /* modo privado: no se recuerda */ }
}

// Tema claro u oscuro. Se aplica como atributo en <html> y se recuerda.
export function useTheme() {
  const [theme, setTheme] = useState(() => (readStored(THEME_KEY, "dark") === "light" ? "light" : "dark"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStored(THEME_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}

// Estado del mercado de Nueva York, refrescado cada 30 segundos.
export function useMarketClock() {
  const [status, setStatus] = useState(() => marketStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(marketStatus()), 30000);
    return () => clearInterval(id);
  }, []);

  return status;
}
