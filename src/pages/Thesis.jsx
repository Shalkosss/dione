import React, { useState, useEffect, useMemo } from "react";
import { C, panel, btn, th, td, input, mono } from "../theme.js";
import { Panel, Stat } from "../components/Panel.jsx";
import { hasSupabase } from "../lib/supabase.js";
import {
  parseThesisJson, loadTheses, saveThesis,
  updateThesis, deleteThesis,
  dueCheckpoints, updateCheckpoints, calcStats,
} from "../lib/thesis.js";
import { hasApiKey } from "../lib/marketData.js";

// ---- helpers ----

const fmtRet = (v) => v == null ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";
const retColor = (v) => v == null ? C.muted : v > 0 ? C.pos : C.neg;
const fmtMoney = (v) => v == null ? "—" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v, d = 1) => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d) + "%";
const convLabel = { low: "Baja", medium: "Media", high: "Alta" };

const STATUS_CFG = {
  open:       { color: C.blue,  label: "ABIERTA"  },
  target_hit: { color: C.pos,   label: "TARGET ✓" },
  stop_hit:   { color: C.neg,   label: "STOP ✗"   },
  expired:    { color: C.muted, label: "EXPIRADA"  },
  closed:     { color: C.muted, label: "CERRADA"   },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.open;
  return <span style={{ color: c.color, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>{c.label}</span>;
}

function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 12.5, color: color ?? C.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function HitRateRow({ items, keyLabel }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {items.map((i) => (
        <div key={i.key} style={{ fontSize: 10, color: C.muted }}>
          <span style={{ color: C.text }}>{i.key}</span>
          {" "}
          <span style={{ color: i.hitRate >= 0.6 ? C.pos : i.hitRate >= 0.4 ? C.accent : C.neg, fontWeight: 600 }}>
            {(i.hitRate * 100).toFixed(0)}%
          </span>
          <span style={{ color: C.muted }}> ({i.hits}/{i.total})</span>
        </div>
      ))}
    </div>
  );
}

// ---- componente principal ----

export default function Thesis() {
  const [theses,      setTheses]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadErr,     setLoadErr]     = useState(null);

  // import
  const [importOpen,   setImportOpen]   = useState(false);
  const [importText,   setImportText]   = useState("");
  const [importParsed, setImportParsed] = useState(null);
  const [importError,  setImportError]  = useState(null);
  const [saving,       setSaving]       = useState(false);

  // close inline
  const [closingId,   setClosingId]   = useState(null);
  const [closePrice,  setClosePrice]  = useState("");

  // post-mortem inline
  const [pmId,        setPmId]        = useState(null);
  const [pmText,      setPmText]      = useState("");
  const [savingPm,    setSavingPm]    = useState(false);

  const noSupa = !hasSupabase();

  // carga + checkpoints automáticos
  async function load() {
    setLoading(true);
    try {
      const data = await loadTheses();
      setTheses(data);
      if (hasApiKey()) autoCheckpoints(data);
    } catch (e) {
      setLoadErr(e.message);
    }
    setLoading(false);
  }

  async function autoCheckpoints(data) {
    const pending = data.filter((t) => t.status === "open" && dueCheckpoints(t).length > 0);
    if (!pending.length) return;
    let updated = false;
    for (const t of pending) {
      const changed = await updateCheckpoints(t);
      if (changed) updated = true;
    }
    if (updated) {
      const fresh = await loadTheses();
      setTheses(fresh);
    }
  }

  useEffect(() => { if (!noSupa) load(); else setLoading(false); }, []);

  // ---- import handlers ----
  function handleParse() {
    try {
      const p = parseThesisJson(importText);
      setImportParsed(p);
      setImportError(null);
    } catch (e) {
      setImportParsed(null);
      setImportError(e.message);
    }
  }

  async function handleSave() {
    if (!importParsed) return;
    setSaving(true);
    try {
      await saveThesis(importParsed);
      setImportText("");
      setImportParsed(null);
      setImportOpen(false);
      await load();
    } catch (e) {
      setImportError(e.message);
    }
    setSaving(false);
  }

  // ---- close ----
  async function handleClose(thesis) {
    const price = parseFloat(closePrice);
    if (!price || isNaN(price)) return;
    const pnl = parseFloat(((price / thesis.entry - 1) * 100).toFixed(2));
    await updateThesis(thesis.id, {
      status: "closed",
      close_price: price,
      close_date: new Date().toISOString().slice(0, 10),
      close_pnl: pnl,
    });
    setClosingId(null);
    setClosePrice("");
    await load();
  }

  // ---- post-mortem ----
  async function handlePm(id) {
    if (!pmText.trim()) return;
    setSavingPm(true);
    await updateThesis(id, { post_mortem: pmText.trim() });
    setPmId(null);
    setPmText("");
    setSavingPm(false);
    await load();
  }

  // ---- delete ----
  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar esta tesis? No se puede deshacer.")) return;
    await deleteThesis(id);
    setTheses((p) => p.filter((t) => t.id !== id));
  }

  const stats = useMemo(() => calcStats(theses), [theses]);
  const needPm = theses.filter((t) => t.status === "stop_hit" && !t.post_mortem);

  return (
    <div>
      {/* BANNER — Supabase no configurado */}
      {noSupa && (
        <div style={{ ...panel, borderColor: C.accent, marginBottom: 16, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, marginBottom: 6 }}>
            ⚠ Supabase no configurado
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            Agregá en <code style={{ color: C.text }}>.env.local</code>:
            <code style={{ color: C.pos, display: "block", marginTop: 4, padding: "6px 10px", background: C.panel2, borderRadius: 4 }}>
              VITE_SUPABASE_URL=https://xxx.supabase.co{"\n"}
              VITE_SUPABASE_ANON_KEY=eyJ...
            </code>
          </div>
        </div>
      )}

      {/* STATS */}
      {stats.total > 0 && (
        <div style={{ ...panel, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Stat label="Total tesis"  value={stats.total} />
            <Stat label="Abiertas"     value={stats.open} color={C.blue} />
            <Stat label="Cerradas"     value={stats.closed} />
            <Stat label="Hit rate"
              value={stats.hitRate != null ? pct(stats.hitRate) : "—"}
              color={stats.hitRate >= 0.6 ? C.pos : stats.hitRate >= 0.4 ? C.accent : C.neg} />
            <Stat label="Ø R30d"  value={fmtRet(stats.avgReturn30d)}  color={retColor(stats.avgReturn30d)} />
            <Stat label="Ø R90d"  value={fmtRet(stats.avgReturn90d)}  color={retColor(stats.avgReturn90d)} />
            <Stat label="Ø R180d" value={fmtRet(stats.avgReturn180d)} color={retColor(stats.avgReturn180d)} />
          </div>
          {stats.closed > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {stats.byMode?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, color: C.muted, width: 60, letterSpacing: "0.06em" }}>POR MODO</span>
                  <HitRateRow items={stats.byMode} />
                </div>
              )}
              {stats.byConviction?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, color: C.muted, width: 60, letterSpacing: "0.06em" }}>CONVICCIÓN</span>
                  <HitRateRow items={stats.byConviction} />
                </div>
              )}
              {stats.bySector?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, color: C.muted, width: 60, letterSpacing: "0.06em" }}>SECTOR</span>
                  <HitRateRow items={stats.bySector} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AVISO POST-MORTEM pendiente */}
      {needPm.length > 0 && (
        <div style={{ ...panel, borderColor: C.neg, marginBottom: 16, padding: "10px 16px", fontSize: 11 }}>
          <span style={{ color: C.neg, fontWeight: 600 }}>⚠ Post-mortem pendiente: </span>
          <span style={{ color: C.muted }}>{needPm.map((t) => t.ticker).join(", ")} — el stop fue tocado, registrá qué salió mal.</span>
        </div>
      )}

      {/* CONTROLES */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <button
          className="dione-hover"
          onClick={() => { setImportOpen((v) => !v); setImportParsed(null); setImportError(null); }}
          disabled={noSupa}
          style={{ ...btn, color: importOpen ? C.bg : C.accent, background: importOpen ? C.accent : "transparent", borderColor: C.accent, cursor: noSupa ? "not-allowed" : "pointer", opacity: noSupa ? 0.4 : 1 }}
        >
          {importOpen ? "✕ Cancelar" : "+ Nueva tesis"}
        </button>
        {loading && <span style={{ fontSize: 11, color: C.muted }}>Cargando…</span>}
        {loadErr  && <span style={{ fontSize: 11, color: C.neg }}>Error: {loadErr}</span>}
      </div>

      {/* PANEL DE IMPORTACIÓN */}
      {importOpen && (
        <div style={{ ...panel, borderColor: C.accent, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
            Pegá el JSON de tesis que genera DIONE en el chat:
          </div>
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportParsed(null); setImportError(null); }}
            placeholder={'{\n  "ticker": "MELI",\n  "entry": 2050,\n  "stop": 1900,\n  "target_3m": 2200,\n  "target_12m": 2600,\n  "conviction": "high",\n  "er_bear": -8.5,\n  "er_base": 15.2,\n  "er_bull": 41.5,\n  "invalidation": "Break below $1900 con volumen"\n}'}
            style={{ ...input, width: "100%", height: 160, textAlign: "left", resize: "vertical",
              fontFamily: mono, fontSize: 11.5, lineHeight: 1.5, padding: 10 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="dione-hover" onClick={handleParse}
              style={{ ...btn, color: C.text }}>
              Parsear
            </button>
            {importParsed && (
              <button className="dione-hover" onClick={handleSave} disabled={saving}
                style={{ ...btn, color: saving ? C.muted : C.pos, borderColor: C.pos }}>
                {saving ? "Guardando…" : "✓ Confirmar y guardar"}
              </button>
            )}
          </div>

          {importError && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.neg }}>✗ {importError}</div>
          )}

          {/* Preview */}
          {importParsed && (
            <div style={{ ...panel, borderColor: C.pos, marginTop: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, color: C.pos, letterSpacing: "0.08em", marginBottom: 10 }}>PREVIEW</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                <Field label="TICKER"     value={importParsed.ticker} color={C.accent} />
                <Field label="ENTRY"      value={fmtMoney(importParsed.entry)} />
                <Field label="STOP"       value={`${fmtMoney(importParsed.stop)} (${fmtRet((importParsed.stop/importParsed.entry-1)*100)})`} color={C.neg} />
                {importParsed.target_3m  && <Field label="TARGET 3M"  value={`${fmtMoney(importParsed.target_3m)} (${fmtRet((importParsed.target_3m/importParsed.entry-1)*100)})`}  color={C.pos} />}
                {importParsed.target_12m && <Field label="TARGET 12M" value={`${fmtMoney(importParsed.target_12m)} (${fmtRet((importParsed.target_12m/importParsed.entry-1)*100)})`} color={C.pos} />}
                <Field label="CONVICTION" value={convLabel[importParsed.conviction] ?? importParsed.conviction} />
                <Field label="MODO"       value={importParsed.thesis_mode} />
                {importParsed.er_bear != null && <Field label="E[R] BEAR" value={fmtRet(importParsed.er_bear)} color={C.neg} />}
                {importParsed.er_base != null && <Field label="E[R] BASE" value={fmtRet(importParsed.er_base)} color={C.accent} />}
                {importParsed.er_bull != null && <Field label="E[R] BULL" value={fmtRet(importParsed.er_bull)} color={C.pos} />}
              </div>
              {importParsed.invalidation && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>Invalidación: </span>{importParsed.invalidation}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TABLA DE TESIS */}
      {!loading && theses.length === 0 && !noSupa && (
        <div style={{ ...panel, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>◎</div>
          <div style={{ fontSize: 13, color: C.text }}>Sin tesis registradas.</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            Presioná <b style={{ color: C.accent }}>+ Nueva tesis</b> y pegá el JSON que genera DIONE.
          </div>
        </div>
      )}

      {theses.length > 0 && (
        <Panel title={`TESIS LOG — ${theses.length} entradas`}>
          <div style={{ overflowX: "auto", margin: -16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ ...th, textAlign: "left", paddingLeft: 16 }}>Ticker</th>
                  <th style={{ ...th, textAlign: "left" }}>Modo</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Entry</th>
                  <th style={th}>Stop</th>
                  <th style={th}>T3m</th>
                  <th style={th}>T12m</th>
                  <th style={th}>Conv.</th>
                  <th style={th}>Status</th>
                  <th style={th}>R30d</th>
                  <th style={th}>R90d</th>
                  <th style={th}>R180d</th>
                  <th style={{ ...th, paddingRight: 16 }}></th>
                </tr>
              </thead>
              <tbody>
                {theses.map((t) => {
                  const needsPm = t.status === "stop_hit" && !t.post_mortem;
                  return (
                    <React.Fragment key={t.id}>
                      <tr style={{
                        borderBottom: closingId === t.id || pmId === t.id ? "none" : `1px solid ${C.border}`,
                        background: needsPm ? `${C.neg}08` : "transparent",
                      }}>
                        {/* Ticker */}
                        <td style={{ ...td, textAlign: "left", paddingLeft: 16 }}>
                          <div style={{ color: C.accent, fontWeight: 700 }}>{t.ticker}</div>
                          {t.sector && <div style={{ fontSize: 9, color: C.muted }}>{t.sector}</div>}
                        </td>
                        {/* Modo */}
                        <td style={{ ...td, textAlign: "left", fontSize: 10, color: C.muted }}>
                          {t.thesis_mode}
                        </td>
                        {/* Fecha */}
                        <td style={{ ...td, fontSize: 10, color: C.muted }}>
                          {t.entry_date}
                        </td>
                        {/* Entry */}
                        <td style={td}>{fmtMoney(t.entry)}</td>
                        {/* Stop */}
                        <td style={{ ...td, color: C.neg }}>{fmtMoney(t.stop)}</td>
                        {/* Target 3m */}
                        <td style={{ ...td, color: C.pos }}>{t.target_3m ? fmtMoney(t.target_3m) : "—"}</td>
                        {/* Target 12m */}
                        <td style={{ ...td, color: C.pos }}>{t.target_12m ? fmtMoney(t.target_12m) : "—"}</td>
                        {/* Conviction */}
                        <td style={{ ...td, fontSize: 10 }}>
                          {convLabel[t.conviction] ?? t.conviction ?? "—"}
                        </td>
                        {/* Status */}
                        <td style={td}>
                          <StatusBadge status={t.status} />
                          {needsPm && <span style={{ fontSize: 9, color: C.neg, display: "block" }}>post-mortem !</span>}
                        </td>
                        {/* Returns */}
                        <td style={{ ...td, color: retColor(t.return_30d)  }}>{fmtRet(t.return_30d)}</td>
                        <td style={{ ...td, color: retColor(t.return_90d)  }}>{fmtRet(t.return_90d)}</td>
                        <td style={{ ...td, color: retColor(t.return_180d) }}>{fmtRet(t.return_180d)}</td>
                        {/* Acciones */}
                        <td style={{ ...td, paddingRight: 16 }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {t.status === "open" && (
                              <span className="dione-hover"
                                onClick={() => { setClosingId(t.id); setClosePrice(""); setPmId(null); }}
                                style={{ fontSize: 10, color: C.muted, cursor: "pointer" }}>Cerrar</span>
                            )}
                            {needsPm && (
                              <span className="dione-hover"
                                onClick={() => { setPmId(t.id); setPmText(t.post_mortem || ""); setClosingId(null); }}
                                style={{ fontSize: 10, color: C.neg, cursor: "pointer" }}>Post-mortem</span>
                            )}
                            <span className="dione-hover"
                              onClick={() => handleDelete(t.id)}
                              style={{ fontSize: 14, color: C.neg, cursor: "pointer", opacity: 0.6 }}>×</span>
                          </div>
                        </td>
                      </tr>

                      {/* Fila de cierre inline */}
                      {closingId === t.id && (
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: `${C.panel2}` }}>
                          <td colSpan={13} style={{ padding: "10px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                              <span style={{ color: C.muted }}>Precio de cierre:</span>
                              <input
                                type="number" step="0.01"
                                value={closePrice}
                                onChange={(e) => setClosePrice(e.target.value)}
                                placeholder="ej: 2250.50"
                                style={{ ...input, width: 120 }}
                                autoFocus
                              />
                              {closePrice && !isNaN(parseFloat(closePrice)) && (
                                <span style={{ color: retColor((parseFloat(closePrice)/t.entry-1)*100) }}>
                                  {fmtRet((parseFloat(closePrice)/t.entry-1)*100)}
                                </span>
                              )}
                              <button className="dione-hover" onClick={() => handleClose(t)}
                                style={{ ...btn, fontSize: 10, color: C.pos, borderColor: C.pos, padding: "3px 10px" }}>
                                Confirmar cierre
                              </button>
                              <span className="dione-hover" onClick={() => setClosingId(null)}
                                style={{ color: C.muted, cursor: "pointer", fontSize: 11 }}>Cancelar</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Fila de post-mortem inline */}
                      {pmId === t.id && (
                        <tr style={{ borderBottom: `1px solid ${C.border}`, background: `${C.panel2}` }}>
                          <td colSpan={13} style={{ padding: "10px 16px" }}>
                            <div style={{ fontSize: 10, color: C.neg, marginBottom: 6 }}>
                              POST-MORTEM — ¿Qué salió mal? ¿Se invalidó la tesis? ¿Error de proceso o de análisis?
                            </div>
                            <textarea
                              value={pmText}
                              onChange={(e) => setPmText(e.target.value)}
                              placeholder="El stop fue alcanzado porque..."
                              style={{ ...input, width: "100%", height: 80, textAlign: "left",
                                resize: "vertical", fontSize: 11.5, padding: 8, lineHeight: 1.5 }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              <button className="dione-hover" onClick={() => handlePm(t.id)} disabled={savingPm}
                                style={{ ...btn, fontSize: 10, color: C.pos, borderColor: C.pos, padding: "3px 10px" }}>
                                {savingPm ? "Guardando…" : "Guardar post-mortem"}
                              </button>
                              <span className="dione-hover" onClick={() => setPmId(null)}
                                style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>Cancelar</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* LEYENDA */}
      {theses.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
          <b style={{ color: C.text }}>Checkpoints R30d/R90d/R180d</b> se actualizan automáticamente la primera vez que abrís
          la app después de que se cumple el plazo (requiere Finnhub configurado).
          <b style={{ color: C.text }}> Post-mortem</b> es obligatorio para tesis con stop tocado.
        </div>
      )}
    </div>
  );
}
