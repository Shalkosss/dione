// Módulos de la terminal, en el orden del circuito de trabajo:
// medir la cartera → leer el mercado → buscar ideas → registrar y seguir tesis.
// Lo usan las pestañas, la línea de comandos y los atajos Alt+número.
export const NAV_ITEMS = [
  { to: "/", key: "1", label: "Portafolio", icon: "optimizer", hint: "Cartera contra benchmarks, sectores y órdenes" },
  { to: "/performance", key: "2", label: "Performance", icon: "risk", hint: "Alfa, information ratio, drawdown" },
  { to: "/market", key: "3", label: "Mercado", icon: "watchlist", hint: "Régimen y tablero sectorial" },
  { to: "/scan", key: "4", label: "Scan", icon: "screener", hint: "Universo precalculado, sin gastar tokens" },
  { to: "/earnings", key: "5", label: "Earnings", icon: "gems", hint: "Resultados y reacción del precio" },
  { to: "/thesis", key: "6", label: "Tesis", icon: "thesis", hint: "Tracker de tesis y eficiencia" },
  { to: "/chart", key: "7", label: "Chart", icon: "chart", hint: "Precio, indicadores y Wyckoff" },
];

export const findNavItem = (pathname) => NAV_ITEMS.find((n) => n.to === pathname) || null;
