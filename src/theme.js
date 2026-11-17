/* DIONE · theme.js — design tokens.
   Los colores son variables CSS definidas en index.css (tema oscuro y claro),
   así el cambio de tema no necesita volver a renderizar nada. */

export const C = {
  bg: "var(--bg)",
  panel: "var(--panel)",
  panel2: "var(--panel-2)",
  border: "var(--border)",
  text: "var(--text)",
  muted: "var(--muted)",
  accent: "var(--accent)",
  pos: "var(--pos)",
  neg: "var(--neg)",
  blue: "var(--blue)",
  amber: "var(--amber)",
  // Versiones translúcidas para fondos de selección y resaltado.
  accentSoft: "var(--accent-soft)",
  blueSoft: "var(--blue-soft)",
  posSoft: "var(--pos-soft)",
  negSoft: "var(--neg-soft)",
  amberSoft: "var(--amber-soft)",
  borderStrong: "var(--border-strong)",
  spy: "var(--bench-spy)",
};

export const sans =
  "'Inter','Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif";

export const mono =
  "'JetBrains Mono','SF Mono','Cascadia Code',ui-monospace,Menlo,monospace";

// Esquinas casi rectas: estética de terminal.
export const radius = { sm: 2, md: 2, lg: 3 };

export const panel = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: radius.lg,
  padding: 14,
};

export const input = {
  width: "100%",
  background: C.panel2,
  border: `1px solid ${C.border}`,
  color: C.text,
  fontFamily: mono,
  fontSize: 12.5,
  padding: "6px 9px",
  borderRadius: radius.sm,
  textAlign: "right",
  boxSizing: "border-box",
};

export const btn = {
  background: C.panel2,
  border: `1px solid ${C.border}`,
  color: C.text,
  fontFamily: mono,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.03em",
  padding: "6px 12px",
  borderRadius: radius.md,
  cursor: "pointer",
};

export const th = {
  color: C.muted,
  fontFamily: mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "right",
  padding: "7px 10px",
};

export const td = {
  fontFamily: mono,
  fontSize: 12,
  padding: "6px 10px",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
