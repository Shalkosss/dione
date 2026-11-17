import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { C, mono } from "./theme.js";

// Cada módulo se carga bajo demanda: recorta el bundle inicial.
const Portfolio = lazy(() => import("./pages/Portfolio.jsx"));
const Performance = lazy(() => import("./pages/Performance.jsx"));
const Market = lazy(() => import("./pages/Market.jsx"));
const Scan = lazy(() => import("./pages/HiddenGems.jsx"));
const Earnings = lazy(() => import("./pages/Earnings.jsx"));
const Thesis = lazy(() => import("./pages/Thesis.jsx"));
const Chart = lazy(() => import("./pages/Chart.jsx"));

const Loading = () => (
  <div style={{ padding: 32, color: C.muted, fontFamily: mono, fontSize: 11.5 }}>cargando módulo…</div>
);

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Portfolio />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/market" element={<Market />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/thesis" element={<Thesis />} />
          <Route path="/chart" element={<Chart />} />
          {/* Rutas del diseño anterior: llevan a su reemplazo. */}
          <Route path="/hidden-gems" element={<Navigate to="/scan" replace />} />
          <Route path="/screener" element={<Navigate to="/scan" replace />} />
          <Route path="/risk" element={<Navigate to="/performance" replace />} />
          <Route path="/watchlist" element={<Navigate to="/market" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
