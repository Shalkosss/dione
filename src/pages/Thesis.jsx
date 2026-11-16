import React, { useCallback, useEffect, useMemo, useState } from "react";
import { C, panel, btn } from "../theme.js";
import { Panel, Stat } from "../components/Panel.jsx";
import ThesisTable from "../components/thesis/ThesisTable.jsx";
import ThesisDetail from "../components/thesis/ThesisDetail.jsx";
import EfficiencyPanel from "../components/thesis/EfficiencyPanel.jsx";
import ImportPanel from "../components/thesis/ImportPanel.jsx";
import { fetchTheses, fetchThesisStats } from "../lib/thesisApi.js";
import { toRow, exportMarkdown, LIVE_STATUSES } from "../lib/thesisView.js";

const FILTERS = [
  { key: "vivas", label: "Vivas", test: (r) => LIVE_STATUSES.includes(r.status) },
  { key: "revisar", label: "Revisar", test: (r) => r.flags.length > 0 || r.needsPostMortem },
  { key: "cerradas", label: "Cerradas", test: (r) => !LIVE_STATUSES.includes(r.status) },
  { key: "todas", label: "Todas", test: () => true },
];

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Thesis Log: tracker de tesis. El estado lo mantiene el cron refresh-theses;
// esta página solo lee /api/theses, importa bloques JSON y exporta el log.
export default function Thesis() {
  const [theses, setTheses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("vivas");
  const [selectedId, setSelectedId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
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
  const visible = rows.filter(FILTERS.find((f) => f.key === filter).test);

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`THESIS_LOG_entradas_${stamp}.md`, exportMarkdown(theses));
  };

  return (
    <div>
      <div style={{ ...panel, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
        <Stat label="TESIS" value={rows.length} />
        <Stat label="ARMADAS" value={stats?.byStatus?.ARMADA ?? 0} color={C.accent} />
        <Stat label="ABIERTAS" value={stats?.byStatus?.ABIERTA ?? 0} color={C.blue} />
        <Stat label="SIN ORDEN" value={stats?.byStatus?.SIN_ORDEN ?? 0} />
        <Stat label="PARA REVISAR" value={counts.revisar} color={counts.revisar ? C.accent : C.text} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="dione-hover"
            onClick={() => setFilter(f.key)}
            style={{ ...btn, color: filter === f.key ? C.accent : C.muted, borderColor: filter === f.key ? C.accent : C.border }}
          >
            {f.label} {counts[f.key]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {loading && <span style={{ fontSize: 11, color: C.muted }}>Cargando…</span>}
        <button className="dione-hover" onClick={load} disabled={loading} style={btn}>Actualizar</button>
        <button className="dione-hover" onClick={handleExport} disabled={!theses.length} style={{ ...btn, opacity: theses.length ? 1 : 0.4 }}>
          Exportar markdown
        </button>
        <button
          className="dione-hover"
          onClick={() => setImportOpen((v) => !v)}
          style={{ ...btn, color: importOpen ? C.bg : C.accent, background: importOpen ? C.accent : "transparent", borderColor: C.accent }}
        >
          {importOpen ? "Cerrar importador" : "Importar JSON"}
        </button>
      </div>

      {error && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, fontSize: 11.5, color: C.neg }}>
          No se pudo leer el log de tesis: {error}
        </div>
      )}

      {importOpen && <ImportPanel onImported={load} />}

      {selectedId && <ThesisDetail key={`${selectedId}-${version}`} id={selectedId} onChanged={load} />}

      <Panel title="TESIS" style={{ marginBottom: 16 }}>
        {visible.length > 0
          ? <ThesisTable rows={visible} selectedId={selectedId} onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))} />
          : (
            <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>
              {loading ? "Cargando…" : rows.length
                ? "Ninguna tesis en este filtro."
                : "Todavía no hay tesis. Importá el bloque JSON que emite DIONE al terminar un /deep."}
            </div>
          )}
      </Panel>

      <EfficiencyPanel stats={stats} />
    </div>
  );
}
