import React, { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import { C } from "./theme.js";

// Las páginas pesadas (Recharts, Monte Carlo, scan de universo) se cargan
// bajo demanda — recorta el bundle inicial sin perder funcionalidad.
const Optimizer = lazy(() => import("./pages/Optimizer.jsx"));
const Risk = lazy(() => import("./pages/Risk.jsx"));
const Chart = lazy(() => import("./pages/Chart.jsx"));
const Watchlist = lazy(() => import("./pages/Watchlist.jsx"));
const Screener = lazy(() => import("./pages/Screener.jsx"));
const Thesis = lazy(() => import("./pages/Thesis.jsx"));

const Loading = () => (
  <div style={{ padding: 32, color: C.muted, fontSize: 12 }}>Cargando…</div>
);

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Optimizer />} />
          <Route path="/risk" element={<Risk />} />
          <Route path="/chart" element={<Chart />} />
          <Route path="/thesis" element={<Thesis />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
