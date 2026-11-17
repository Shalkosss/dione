import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, mono } from "../../theme.js";
import { buildCommands, filterCommands } from "../../lib/commands.js";
import { NAV_ITEMS } from "../nav.js";

const KIND_TAG = { page: "IR", ticker: "CHART", order: "ORDEN" };

// Línea de comandos siempre visible. Acepta el nombre de un módulo, un ticker
// ("nvda") o una orden rápida ("buy nu 100", "v mu 5"). Ctrl+K la enfoca.
export default function CommandLine({ focusSignal }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => filterCommands(query, buildCommands(NAV_ITEMS, query)), [query]);

  useEffect(() => {
    if (!focusSignal) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSignal]);

  useEffect(() => setCursor(0), [query]);

  function run(cmd) {
    if (!cmd) return;
    navigate(cmd.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") run(results[cursor]);
  }

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 120, maxWidth: 620 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", background: C.panel2, border: `1px solid ${open ? C.accent : C.border}`, borderRadius: 2 }}>
        <span style={{ color: C.accent, fontFamily: mono, fontWeight: 700 }}>&gt;</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="módulo, ticker u orden: nvda · buy nu 100 · v mu 5"
          spellCheck={false}
          aria-label="Línea de comandos"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", boxShadow: "none", color: C.text, fontFamily: mono, fontSize: 12.5 }}
        />
        <span className="dione-kbd dione-hide-narrow">Ctrl K</span>
      </div>

      {open && (
        <div className="dione-pop" style={{ position: "absolute", top: 34, left: 0, right: 0, zIndex: 60, background: C.panel, border: `1px solid ${C.borderStrong}`, borderRadius: 2, boxShadow: "0 18px 40px -12px rgba(0,0,0,0.75)" }}>
          {results.length === 0 && <div style={{ padding: "12px 12px", color: C.muted, fontFamily: mono, fontSize: 11.5 }}>Sin coincidencias para “{query}”.</div>}
          {results.map((cmd, i) => (
            <div
              key={cmd.to}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => { e.preventDefault(); run(cmd); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer", background: i === cursor ? C.accentSoft : "transparent", fontFamily: mono, fontSize: 12 }}
            >
              <span style={{ width: 48, fontSize: 9.5, letterSpacing: "0.08em", color: cmd.kind === "order" ? C.amber : cmd.kind === "ticker" ? C.blue : C.muted }}>{KIND_TAG[cmd.kind]}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{cmd.label}</span>
              <span style={{ flex: 1, color: C.muted, fontFamily: "Inter, sans-serif", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cmd.hint}</span>
              {cmd.key && <span className="dione-kbd">Alt {cmd.key}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
