/* DIONE · theme.js — design tokens (terminal oscura) */

export const C = {
  bg: "#0d0e11",
  panel: "#15171c",
  panel2: "#1b1e25",
  border: "#262a33",
  text: "#dfe1e6",
  muted: "#7d818c",
  accent: "#f4b740",
  pos: "#4ec9a3",
  neg: "#e5634d",
  blue: "#5aa0e8",
};

export const mono =
  "'JetBrains Mono','SF Mono','Cascadia Code',ui-monospace,Menlo,monospace";

export const panel = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: 16,
};

export const input = {
  width: "100%",
  background: C.panel2,
  border: `1px solid ${C.border}`,
  color: C.text,
  fontFamily: mono,
  fontSize: 12.5,
  padding: "4px 6px",
  borderRadius: 4,
  textAlign: "right",
  boxSizing: "border-box",
};

export const btn = {
  background: C.panel2,
  border: `1px solid ${C.border}`,
  color: C.text,
  fontFamily: mono,
  fontSize: 11,
  padding: "6px 13px",
  borderRadius: 4,
  cursor: "pointer",
};

export const th = {
  color: C.muted,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "right",
  padding: "6px 8px",
};

export const td = {
  fontSize: 12.5,
  padding: "5px 8px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
