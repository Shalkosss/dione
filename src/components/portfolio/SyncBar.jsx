import React, { useState } from "react";
import { C, mono, btn, input } from "../../theme.js";
import { useLedger, ACCOUNTS } from "../../store/LedgerContext.jsx";
import { saveToken } from "../../lib/thesisApi.js";

const TONE = { invalid: C.neg, synced: C.pos, syncing: C.accent, pending: C.amber, conflict: C.neg, needToken: C.amber, unavailable: C.amber, local: C.muted };

// Línea de estado de la sincronización con Supabase, con el token y la
// resolución de conflictos (cuando este navegador y el servidor no coinciden).
export default function SyncBar() {
  const { sync, transactionCount } = useLedger();
  const account = (id) => transactionCount(id);
  const [token, setToken] = useState("");
  const askToken = sync.status === "local" || sync.status === "needToken";

  function submit(e) {
    e.preventDefault();
    if (!token.trim()) return;
    saveToken(token.trim());
    setToken("");
    sync.retry();
  }

  const small = { ...btn, padding: "3px 9px", fontSize: 10 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, fontFamily: mono, fontSize: 11, color: C.muted }}>
      <span style={{ width: 7, height: 7, background: TONE[sync.status] || C.muted, display: "inline-block" }} />
      <span style={{ color: TONE[sync.status] || C.muted }}>{sync.message}</span>

      {Object.entries(sync.conflicts).map(([accountId, remote]) => (
        <span key={accountId} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span>· {ACCOUNTS[accountId]?.label}: aquí {account(accountId)} movimientos, en Supabase {remote.transactions.length}</span>
          <button onClick={() => sync.resolve(accountId, "server")} style={{ ...small, color: C.accent, borderColor: C.accent }}>USAR SUPABASE</button>
          <button onClick={() => sync.resolve(accountId, "local")} style={small}>SUBIR ESTE NAVEGADOR</button>
        </span>
      ))}

      {askToken && (
        <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="THESES_TOKEN" autoComplete="off" style={{ ...input, textAlign: "left", width: 170, padding: "4px 8px", fontSize: 11 }} />
          <button type="submit" disabled={!token.trim()} style={small}>CONECTAR</button>
        </form>
      )}

      {(sync.status === "pending" || sync.status === "unavailable" || sync.status === "invalid") && (
        <button onClick={sync.retry} style={small}>REINTENTAR</button>
      )}
    </div>
  );
}
