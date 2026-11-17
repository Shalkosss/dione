import React from "react";

// Íconos de línea propios (24x24, trazo 1.7). Sin dependencias.
const PATHS = {
  optimizer: "M4 19V5M4 19h16M8 15l3.5-4 3 2.5L19 8",
  risk: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.800-1-8-4.500-8-9V6l8-3zM12 9v4M12 16.500v.01",
  chart: "M5 4v16M5 20h15M9 14v3M13 9v8M17 12v5M9 8v2M13 5v1M17 7v2",
  watchlist: "M2.500 12s3.500-6.500 9.500-6.500S21.500 12 21.500 12s-3.500 6.500-9.500 6.500S2.500 12 2.500 12zM12 9.500a2.500 2.500 0 100 5 2.500 2.500 0 000-5z",
  thesis: "M7 3h8l4 4v14H7V3zM15 3v4h4M10 12h6M10 16h6M10 8h2",
  screener: "M4 5h16l-6 7.500V19l-4 2v-8.500L4 5z",
  gems: "M6 4h12l3.500 5L12 21 2.500 9 6 4zM2.500 9h19M9 4l-1.500 5L12 21l4.500-12L15 4",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2.500M12 19.500V22M4.200 4.200l1.800 1.800M18 18l1.800 1.800M2 12h2.500M19.500 12H22M4.200 19.800L6 18M18 6l1.800-1.800",
  moon: "M20 14.500A8.500 8.500 0 019.500 4a7 7 0 1010.500 10.500z",
  menu: "M4 7h16M4 12h16M4 17h16",
  collapse: "M4 4h16v16H4V4zM9 4v16M15 10l-2 2 2 2",
  enter: "M20 5v8H6M10 9l-4 4 4 4",
};

export default function Icon({ name, size = 16, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.700"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={PATHS[name] || ""} />
    </svg>
  );
}
