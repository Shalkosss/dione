# DIONE WEB

Terminal cuantitativa de DIONE: mide una cartera ficticia contra el S&P 500,
lee el mercado, sigue resultados trimestrales y registra las tesis que emite
el research.

Desplegada en https://dionee.vercel.app (Vercel despliega `main`).

## Módulos

| Atajo | Módulo | Qué hace |
|---|---|---|
| Alt+1 | Portafolio | Cartera contra benchmarks, sectores, mandato, boleta de orden |
| Alt+2 | Performance | Alfa, information ratio, máxima caída, captura |
| Alt+3 | Mercado | Régimen y tablero de los 11 sectores |
| Alt+4 | Scan | Universo precalculado (snapshot diario) |
| Alt+5 | Earnings | Fechas de resultados (SEC EDGAR) y reacción del precio |
| Alt+6 | Tesis | Tracker de tesis |
| Alt+7 | Chart | Precio con indicadores |

Ctrl+K abre la línea de comandos: acepta un módulo, un ticker (`nvda`) o una
orden rápida (`buy nu 100`).

## Desarrollo

```bash
npm install
npm run dev
```

Antes de commitear: `npm test` y `npm run build`.

El contexto completo del proyecto (stack, endpoints, crons, tablas, decisiones)
está en [CLAUDE.md](CLAUDE.md). Los documentos del método están en
[project-docs/](project-docs/INDEX.md).
