import React, { useCallback, useEffect, useMemo, useState } from "react";
import { C, panel, btn } from "../theme.js";
import { Panel } from "../components/Panel.jsx";
import { KpiCard, KpiGrid, Segmented, EmptyState } from "../components/ui.jsx";
import ThesisTable from "../components/thesis/ThesisTable.jsx";
import ThesisDetail from "../components/thesis/ThesisDetail.jsx";
import EfficiencyPanel from "../components/thesis/EfficiencyPanel.jsx";
import PoolDiversity from "../components/thesis/PoolDiversity.jsx";
import { fetchTheses, fetchThesisStats } from "../lib/thesisApi.js";
import { toRow, LIVE_STATUSES } from "../lib/thesisView.js";

const FILTERS = [
  { key: "vivas", label: "Vivas", test: (r) => LIVE_STATUSES.includes(r.status) },
  { key: "revisar", label: "Revisar", test: (r) => r.flags.length > 0 || r.needsPostMortem },
  { key: "cerradas", label: "Cerradas", test: (r) => !LIVE_STATUSES.includes(r.status) },
  { key: "todas", label: "Todas", test: () => true },
];

// Thesis Log: tracker de tesis. El estado lo mantiene el cron refresh-theses;
// esta página solo lee /api/theses. Las tesis entran desde Claude Code
// (skill deep, `npm run thesis:import`).
export default function Thesis() {
  const [theses, setTheses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chosenFilter, setFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [version, setVersion] = useState(0); // fuerza recarga del detalle

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([fetchTheses(), fetchThesisStats()]);
      setTheses(list);
      setStats(st);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => theses.map((t) => toRow(t)), [theses]);
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.test).length])),
    [rows],
  );
  // Sin elección del usuario: "Vivas" si hay alguna; si todas cerraron, "Todas".
  const filter = chosenFilter ?? (counts.vivas > 0 || !rows.length ? "vivas" : "todas");
  const visible = rows.filter(FILTERS.find((f) => f.key === filter).test);

  return (
    <div>
      <KpiGrid>
        <KpiCard label="Tesis" value={rows.length} hint="registradas" />
        <KpiCard label="Armadas" value={stats?.byStatus?.ARMADA ?? 0} color={C.amber} hint="orden límite esperando" />
        <KpiCard label="Abiertas" value={stats?.byStatus?.ABIERTA ?? 0} color={C.blue} hint="posición en curso" />
        <KpiCard label="Sin orden" value={stats?.byStatus?.SIN_ORDEN ?? 0} hint="solo seguimiento" />
        <KpiCard label="Para revisar" value={counts.revisar} color={counts.revisar ? C.accent : C.text} hint="bandera o post-mortem" />
      </KpiGrid>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts[f.key] }))}
        />
        <span style={{ flex: 1 }} />
        {loading && <span style={{ fontSize: 11, color: C.muted }}>Cargando…</span>}
        <button className="dione-hover" onClick={load} disabled={loading} style={btn}>Actualizar</button>
      </div>

      {error && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, fontSize: 11.5, color: C.neg }}>
          No se pudo leer el log de tesis: {error}
        </div>
      )}

      {stats?.diversity?.live > 0 && <div style={{ marginBottom: 16 }}><PoolDiversity diversity={stats.diversity} /></div>}

      {selectedId && <ThesisDetail key={`${selectedId}-${version}`} id={selectedId} onChanged={load} />}

      <Panel title="TESIS" style={{ marginBottom: 16 }}>
        {visible.length > 0
          ? <ThesisTable rows={visible} selectedId={selectedId} onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))} />
          : (
            <EmptyState title={loading ? "Cargando…" : rows.length ? "Ninguna tesis en este filtro" : "Todavía no hay tesis"}>
              {!loading && (rows.length
                ? "Probá con otra pestaña: las tesis que ya cerraron están en Cerradas y en Todas."
                : "Corré /deep TICKER en Claude Code: la tesis se registra sola.")}
            </EmptyState>
          )}
      </Panel>

      <EfficiencyPanel stats={stats} />
    </div>
  );
}
