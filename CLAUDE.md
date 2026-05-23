# CLAUDE.md — Contexto del proyecto DIONE WEB

Este archivo es el brief para Claude Code. Lo lee automáticamente al
abrir el proyecto. Mantenelo actualizado cuando cambien decisiones.

---

## QUÉ ES ESTO

DIONE WEB es la app de portfolio management de "DIONE v3", un sistema
de equity research. El usuario es un estudiante de finanzas (Lima,
Perú) con dos cuentas: real USD 5.000 y paper trading USD 1.000.000.

La app NO hace research (eso vive en un Claude Project aparte). La app
es la capa cuantitativa: optimización de portafolio, métricas de
riesgo, y a futuro thesis log y screener.

---

## STACK

- React 18 + Vite 5
- react-router-dom 6 (routing SPA)
- recharts 2 (gráficos)
- Sin backend en Fase 1. Estado en localStorage.
- Deploy: Vercel (auto-deploy desde GitHub en cada push)

NO agregar TypeScript, Redux, Next.js, Tailwind ni otras dependencias
sin discutirlo antes. El proyecto es deliberadamente minimalista.

---

## ESTADO ACTUAL — FASE 1 COMPLETA

Funcionando:
- `src/pages/Optimizer.jsx` — Markowitz + Black-Litterman, frontera
  eficiente, rebalanceo, chequeo de mandato.
- `src/pages/Risk.jsx` — VaR, Expected Shortfall, stress tests,
  descomposición de riesgo, exposición sectorial.
- `src/lib/finance.js` — motor cuantitativo. Verificado numéricamente.
- `src/store/PortfolioContext.jsx` — estado global, persiste en
  localStorage.

Placeholders honestos (NO construidos aún):
- `/thesis` — Thesis Log (Fase 3)
- `/screener` — Screener (Fase 4)
- `/watchlist` — Watchlist con precios automáticos (Fase 2)

---

## ROADMAP — PRÓXIMAS FASES

### Fase 2 — Watchlist + datos automáticos
- Integrar Finnhub API (free tier). Key en env var `VITE_FINNHUB_KEY`.
- Crear `src/lib/marketData.js` para fetch de precios e históricos.
- Página Watchlist: precios diarios automáticos.
- Calcular vol y beta históricas desde precios reales y poder
  inyectarlas al Optimizer (reemplazando los supuestos manuales).

### Fase 3 — Thesis Log + Performance
- Base de datos: Supabase Postgres. Keys en `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY`.
- Importador de JSON: el usuario pega el JSON que DIONE genera en el
  chat (formato de tesis: ticker, entry, targets 3m/12m, stop,
  conviction, invalidación, escenarios bear/base/bull).
- Tracking automático de outcome a 30/90/180 días.
- Cálculo de hit rate por modo / sector / cap.

### Fase 4 — Screener
- Escaneo del universo curado (watchlist Tier 1, ~100-150 tickers).
- Composite scoring fundamental + técnico.
- NO intentar escanear 3.000 tickers: la infra gratuita no lo soporta.

---

## DECISIONES DE DISEÑO YA TOMADAS (no revertir sin discutir)

1. **Modelo de covarianza single-index** (market model): la diagonal
   es la varianza total; fuera de diagonal, beta_i·beta_j·var_mercado.
   Fase 2+ puede sumar covarianza histórica real como opción.
2. **Optimización long-only** por Monte Carlo + hill-climbing. No hay
   solver de QP — es deliberado, mantiene cero dependencias pesadas.
3. **Black-Litterman**: el prior es el equilibrio implícito en los
   pesos actuales del usuario (no el market cap real). Los views salen
   del E[R] de cada activo, ponderados por confianza (low/med/high).
4. **Restricciones del mandato** hardcodeadas: cap 15%/posición real
   (25% paper), máx 8 posiciones reales, cap 35%/sector GICS.
5. **Diseño**: terminal oscura. Tokens en `src/theme.js`. JetBrains
   Mono. No cambiar la identidad visual sin pedirlo.

---

## CONVENCIONES

- Comentarios y UI en español.
- Toda la matemática nueva va en `src/lib/`, nunca dentro de un .jsx.
- Componentes UI reutilizables en `src/components/`.
- Antes de dar por terminada cualquier tarea: correr `npm run build`
  y confirmar que compila sin errores.
- El usuario está aprendiendo. Explicá los cambios de forma breve.

---

## PRIMERA TAREA SUGERIDA

Correr `npm install` y `npm run build`. Confirmar que el proyecto
compila limpio en este entorno. Si hay algún warning o error, arreglarlo.
