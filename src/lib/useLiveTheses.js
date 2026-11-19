import { useEffect, useState } from "react";
import { fetchTheses } from "./thesisApi.js";

// Tesis del tracker, una sola descarga por sesión (Chart y Portafolio las
// usan para tomar stop y objetivo cuando la orden no los trae). Si la API no
// responde (local sin keys), queda una lista vacía.
let cached = null;

export function useLiveTheses() {
  const [theses, setTheses] = useState(cached || []);
  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    fetchTheses()
      .then((list) => { cached = Array.isArray(list) ? list : []; if (alive) setTheses(cached); })
      .catch(() => { cached = []; });
    return () => { alive = false; };
  }, []);
  return theses;
}
