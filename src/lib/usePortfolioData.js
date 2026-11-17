import { useEffect, useMemo, useState } from "react";
import { useLedger } from "../store/LedgerContext.jsx";
import { accountState, equityCurve, twrIndex, modelIndex, valuedPositions } from "./ledger.js";
import { rebase } from "./perf.js";
import { fetchMany, daysSince } from "./priceHistory.js";

export const SPY = "SPY";
const SPY_COLOR = "var(--bench-spy)";
const today = () => new Date().toISOString().slice(0, 10);

// Junta el libro de órdenes con los precios y devuelve todo lo que las páginas
// de Portafolio y Performance necesitan: curva, índice TWR, posiciones
// valoradas y las series de cada benchmark, todas en base 100 desde el inicio.
export function usePortfolioData() {
  const { account, benchmarks, activeId } = useLedger();
  const [prices, setPrices] = useState(null);
  const [error, setError] = useState(null);

  const trades = useMemo(() => account.transactions.filter((t) => t.ticker), [account.transactions]);
  const startDate = useMemo(() => {
    const dates = account.transactions.map((t) => t.date).sort();
    return dates[0] || today();
  }, [account.transactions]);

  const liveBenchmarks = useMemo(() => benchmarks.filter((b) => Object.keys(b.weights || {}).length > 0), [benchmarks]);

  const tickers = useMemo(() => {
    const fromBench = liveBenchmarks.flatMap((b) => Object.keys(b.weights));
    return [...new Set([SPY, ...trades.map((t) => t.ticker), ...fromBench])].sort();
  }, [trades, liveBenchmarks]);

  const tickersKey = tickers.join(",");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchMany(tickersKey.split(","), daysSince(startDate, 400))
      .then((data) => {
        if (cancelled) return;
        if (!data[SPY]?.length) setError("No se pudieron bajar los precios de SPY (Yahoo). Reintentá en unos segundos.");
        setPrices(data);
      });
    return () => { cancelled = true; };
  }, [tickersKey, startDate]);

  return useMemo(() => {
    const base = { activeId, account, startDate, error, loading: !prices, hasTrades: trades.length > 0 };
    if (!prices || !prices[SPY]?.length) return { ...base, dates: [], curve: [], index: [], benchSeries: [], valued: null, prices: prices || {}, spyHistory: [] };

    const allDates = prices[SPY].map((c) => c.date);
    // Un día antes del primer movimiento, para que la curva arranque en el capital inicial.
    const firstIdx = allDates.findIndex((d) => d >= startDate);
    const dates = firstIdx === -1 ? allDates.slice(-1) : allDates.slice(Math.max(0, firstIdx - 1));
    const asOf = dates[dates.length - 1];

    // Sin órdenes no hay nada que comparar: se dejan las series vacías en vez de
    // mostrar una "cartera" plana contra el índice.
    const curve = trades.length ? equityCurve(account.initialCash, account.transactions, prices, dates) : [];
    const index = twrIndex(curve);
    const state = accountState(account.initialCash, account.transactions);
    const valued = valuedPositions(state, prices, asOf);

    const spySeries = rebase(prices[SPY].filter((c) => c.date >= dates[0]).map((c) => ({ date: c.date, value: c.close })));
    const others = liveBenchmarks.map((b) => ({
      id: b.id, name: b.name, color: b.color,
      // Las carteras de referencia arrancan en su propia fecha o en la nuestra, la que sea posterior.
      series: modelIndex(b.weights, prices, dates, b.startDate > dates[0] ? b.startDate : dates[0]),
    }));

    return {
      ...base, dates, asOf, curve, index, valued, state, prices,
      spyHistory: prices[SPY].map((c) => ({ date: c.date, value: c.close })),
      benchSeries: [{ id: "spy", name: "S&P 500", color: SPY_COLOR, series: spySeries }, ...others.filter((o) => o.series.length > 1)],
    };
  }, [prices, account, startDate, error, activeId, trades.length, liveBenchmarks]);
}
