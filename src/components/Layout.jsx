import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { C, mono } from "../theme.js";
import { NAV_ITEMS, findNavItem } from "./nav.js";
import { useMarketClock, useTheme } from "../lib/useShell.js";
import { useLedger, ACCOUNTS } from "../store/LedgerContext.jsx";
import CommandLine from "./shell/CommandLine.jsx";
import TickerTape from "./shell/TickerTape.jsx";
import Icon from "./icons.jsx";

function AccountSwitch() {
  const { activeId, setActive } = useLedger();
  return (
    <div style={{ display: "inline-flex" }} title="Cuenta activa: cada una tiene su propio libro de órdenes">
      {Object.entries(ACCOUNTS).map(([id, acc]) => (
        <button key={id} className="dione-chip" data-active={activeId === id} onClick={() => setActive(id)} style={{ marginLeft: -1 }}>
          {acc.label.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function MarketClock({ status }) {
  const color = status.open ? C.pos : C.muted;
  return (
    <div className="dione-hide-narrow" title="Sesión regular de NYSE (no considera feriados)" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
      <span className={status.open ? "dione-live-dot" : undefined} style={{ width: 7, height: 7, background: color }} />
      <span style={{ color }}>{status.label.toUpperCase()}</span>
      <span>NY {status.time}</span>
    </div>
  );
}

// Armazón de terminal: barra de comandos, módulos numerados, cinta de precios
// y barra de estado. Alt+1…7 cambia de módulo; Ctrl+K enfoca la línea de comandos.
export default function Layout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const status = useMarketClock();
  const { activeId, account } = useLedger();
  const [focusSignal, setFocusSignal] = useState(0);

  const onKey = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setFocusSignal((n) => n + 1);
      return;
    }
    const target = e.altKey && NAV_ITEMS.find((n) => n.key === e.key);
    if (target) { e.preventDefault(); navigate(target.to); }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const page = findNavItem(pathname);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: C.bg }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "7px 14px", borderBottom: `1px solid ${C.border}`, background: C.panel }}>
          <NavLink to="/" style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: mono }}>
            <span style={{ background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12.5, letterSpacing: "0.16em", padding: "3px 8px 3px 10px" }}>DIONE</span>
            <span className="dione-hide-narrow" style={{ fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>TERMINAL</span>
          </NavLink>
          <CommandLine focusSignal={focusSignal} />
          <span style={{ flex: 1 }} />
          <MarketClock status={status} />
          <AccountSwitch />
          <button className="dione-chip" onClick={toggleTheme} aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} title={theme === "dark" ? "Tema claro" : "Tema oscuro"} style={{ padding: "0 8px" }}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
          </button>
        </header>

        <nav className="dione-scroll-x" style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.panel }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end className="dione-tab" title={`${item.hint} (Alt+${item.key})`}>
              <span className="dione-tab-key">{item.key}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <TickerTape />
      </div>

      <main key={pathname} className="dione-page dione-content" style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: 1760, margin: "0 auto", padding: "12px 14px 44px" }}>
        {children}
      </main>

      <footer style={{ position: "sticky", bottom: 0, zIndex: 20, display: "flex", gap: 18, alignItems: "center", padding: "4px 14px", borderTop: `1px solid ${C.border}`, background: C.panel, fontFamily: mono, fontSize: 10.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ color: C.accent }}>{page ? `${page.key} ${page.label.toUpperCase()}` : "DIONE"}</span>
        <span>CUENTA {ACCOUNTS[activeId].label.toUpperCase()} · {account.transactions.length} órdenes · ficticia</span>
        <span className="dione-hide-narrow">{page?.hint}</span>
        <span style={{ flex: 1 }} />
        <span className="dione-hide-narrow">Alt+1…7 módulos · Ctrl+K comando</span>
      </footer>
    </div>
  );
}
