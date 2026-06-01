import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { C, mono } from "../theme.js";

const NAV = [
  { to: "/", label: "Optimizer", phase: 1 },
  { to: "/risk", label: "Risk Engine", phase: 1 },
  { to: "/chart", label: "Chart", phase: 1 },
  { to: "/watchlist", label: "Watchlist", phase: 1 },
  { to: "/thesis", label: "Thesis Log", phase: 1 },
  { to: "/screener", label: "Screener", phase: 1 },
  { to: "/hidden-gems", label: "Hidden Gems", phase: 1 },
];

export default function Layout({ children }) {
  const loc = useLocation();
  const current =
    NAV.find((n) => n.to === loc.pathname)?.label || "DIONE";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: 196,
          flexShrink: 0,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 18px 16px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: "0.16em",
              color: C.accent,
            }}
          >
            DIONE
          </div>
          <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.06em" }}>
            ASSET MANAGEMENT v3
          </div>
        </div>

        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "9px 12px",
                margin: "2px 0",
                borderRadius: 4,
                fontSize: 12.5,
                background: isActive ? C.panel2 : "transparent",
                color: isActive ? C.accent : C.muted,
                borderLeft: isActive
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              })}
            >
              <span>{n.label}</span>
              {n.phase > 1 && (
                <span
                  style={{
                    fontSize: 8.5,
                    color: C.muted,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    padding: "1px 4px",
                  }}
                >
                  F{n.phase}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            padding: "12px 14px",
            borderTop: `1px solid ${C.border}`,
            fontSize: 9.5,
            color: C.muted,
            lineHeight: 1.6,
          }}
        >
          Fase 1 activa.
          <br />
          F2-F4 en construcción.
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            height: 46,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 22px",
            fontSize: 12,
            color: C.muted,
            letterSpacing: "0.06em",
          }}
        >
          DIONE / <span style={{ color: C.text, marginLeft: 6 }}>{current}</span>
        </header>
        <div style={{ padding: "20px 22px 48px" }}>{children}</div>
      </main>
    </div>
  );
}
