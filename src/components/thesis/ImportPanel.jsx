import React, { useMemo, useState } from "react";
import { C, panel, btn, input, mono } from "../../theme.js";
import { extractBlocks, normalizeThesis } from "../../../lib/thesisSchema.js";
import { importTheses, loadToken, saveToken } from "../../lib/thesisApi.js";

const PLACEHOLDER = `Pegá acá el bloque (o varios) que emite DIONE al final de un /deep:

{
  "schema": "dione-thesis-v2",
  "ticker": "MU", "entry_date": "2026-11-14", "rating": "BUY",
  "ref_price": 778.31, "order_type": "LIMIT", "entry": 720, "stop": 655, ...
}`;

const field = { ...input, textAlign: "left", padding: "7px 9px" };

// Importador de bloques dione-thesis-v2. Valida en el navegador con el mismo
// parser del servidor y envía por POST /api/theses con el token de escritura.
export default function ImportPanel({ onImported }) {
  const [text, setText] = useState("");
  const [token, setToken] = useState(loadToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const preview = useMemo(
    () => extractBlocks(text).map((raw) => ({ ticker: raw?.ticker, ...normalizeThesis(raw) })),
    [text],
  );
  const valid = preview.filter((p) => p.ok);

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      saveToken(token.trim());
      const data = await importTheses(valid.map((p) => p.row.raw_json), token.trim());
      setResult(data);
      setText("");
      onImported();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ ...panel, borderColor: C.accent, marginBottom: 16 }}>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        style={{ ...field, height: 170, resize: "vertical", fontFamily: mono, fontSize: 11.5, lineHeight: 1.5 }}
      />

      {preview.length > 0 && (
        <div style={{ margin: "10px 0", fontSize: 11, lineHeight: 1.8 }}>
          {preview.map((p, i) => (
            <div key={i} style={{ color: p.ok ? C.pos : C.neg }}>
              {p.ok
                ? `✓ ${p.row.id} · ${p.row.rating} · ${p.row.order_type === "SIN_ORDEN" ? "sin orden" : `${p.row.order_type} ${p.row.entry} / stop ${p.row.stop}`}`
                : `✗ ${p.ticker || `bloque ${i + 1}`}: ${p.errors.join(" · ")}`}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Token de escritura (THESES_TOKEN)"
          autoComplete="off"
          style={{ ...field, width: 280 }}
        />
        <button
          className="dione-hover"
          onClick={handleImport}
          disabled={busy || !valid.length || !token.trim()}
          style={{ ...btn, color: C.bg, background: C.accent, borderColor: C.accent, opacity: busy || !valid.length || !token.trim() ? 0.4 : 1 }}
        >
          {busy ? "Importando…" : `Importar ${valid.length || ""} tesis`}
        </button>
        {error && <span style={{ fontSize: 11, color: C.neg }}>{error}</span>}
        {result && (
          <span style={{ fontSize: 11, color: C.pos }}>
            {result.imported.length} guardadas
            {result.refresh?.changed?.length ? ` · ${result.refresh.changed.map((c) => `${c.id} → ${c.to}`).join(", ")}` : ""}
            {result.refresh?.error ? ` · ${result.refresh.error}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
