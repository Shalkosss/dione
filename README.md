# DIONE WEB — Equity Research & Asset Management

App de portfolio management de DIONE v3. Optimizador de portafolio
(Markowitz + Black-Litterman), risk engine, y la base para el thesis log.

**Estado actual: Fase 1** — Optimizer + Risk Engine funcionando. 100%
client-side, sin necesidad de API ni base de datos.

---

## QUÉ INCLUYE LA FASE 1

| Módulo | Estado |
|---|---|
| Portfolio Optimizer (Markowitz, frontera eficiente) | ✅ Funcionando |
| Black-Litterman (equilibrio de mercado + tus views) | ✅ Funcionando |
| Risk Engine (VaR, ES, stress tests, descomposición) | ✅ Funcionando |
| Chequeo de restricciones del mandato | ✅ Funcionando |
| Thesis Log | Fase 3 |
| Screener | Fase 4 |
| Watchlist con precios automáticos | Fase 2 |

Tu portafolio se guarda solo en el navegador (localStorage). Persiste
entre sesiones sin configurar nada.

---

## REQUISITOS

- **Node.js 18 o superior** — descargar de https://nodejs.org
- **Cuenta de GitHub** (gratis) — https://github.com
- **Cuenta de Vercel** (gratis) — https://vercel.com

---

## PASO 1 — PROBAR LOCALMENTE (opcional pero recomendado)

Abrí una terminal dentro de la carpeta `dione-web` y ejecutá:

```bash
npm install
npm run dev
```

Abrí http://localhost:5173 en el navegador. Deberías ver DIONE
funcionando. Cuando termines de probar, cortá con Ctrl+C.

---

## PASO 2 — SUBIR A GITHUB

1. En GitHub, creá un repositorio nuevo (botón **New**). Nombre
   sugerido: `dione-web`. Dejalo **vacío** (sin README, sin .gitignore —
   este proyecto ya los trae).

2. En la terminal, dentro de la carpeta `dione-web`:

```bash
git init
git add .
git commit -m "DIONE web — Fase 1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/dione-web.git
git push -u origin main
```

Reemplazá `TU_USUARIO` por tu usuario de GitHub.

---

## PASO 3 — DEPLOY A VERCEL

1. Entrá a https://vercel.com y hacé **Sign in with GitHub**.

2. Clic en **Add New… → Project**.

3. En la lista de repositorios, buscá `dione-web` y clic en **Import**.

4. Vercel detecta automáticamente que es un proyecto Vite. No tenés que
   cambiar nada:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. Clic en **Deploy**. Esperá ~1 minuto.

6. Listo. Vercel te da una URL tipo `https://dione-web.vercel.app`.
   Esa es tu app, accesible desde cualquier dispositivo.

A partir de ahora, **cada vez que hagas `git push`**, Vercel
redespliega solo. No tenés que repetir nada.

---

## PASO 4 — ACTUALIZAR EL PROJECT DE CLAUDE

Una vez tengas la URL, agregala al archivo de instrucciones de tu
Project DIONE (sección DATA SOURCE de `SETUP_GUIDE.md`):

```
## DATA SOURCE — Dione App
URL: https://tu-app.vercel.app
```

---

## FASES SIGUIENTES (roadmap)

- **Fase 2 — Watchlist + datos automáticos.** La app baja precios sola
  vía Finnhub (API gratuita). Calcula vol y beta históricas.
  Requiere registrarse en https://finnhub.io y poner la key en Vercel
  (Settings → Environment Variables → `VITE_FINNHUB_KEY`).

- **Fase 3 — Thesis Log + Performance.** Base de datos Supabase.
  Importás el JSON que genera DIONE en el chat. La app trackea el
  outcome de cada tesis a 30/90/180 días.

- **Fase 4 — Screener.** Escaneo del universo curado con el composite
  scoring de los 3 modos del Hunter.

Ver `.env.example` para las variables de cada fase.

---

## ESTRUCTURA DEL PROYECTO

```
dione-web/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── src/
    ├── main.jsx              entry point
    ├── App.jsx               rutas
    ├── index.css             estilos globales
    ├── theme.js              design tokens
    ├── lib/
    │   ├── finance.js        motor cuantitativo (Markowitz, BL, VaR)
    │   └── format.js         helpers de formato
    ├── store/
    │   └── PortfolioContext.jsx   estado global + persistencia
    ├── components/
    │   ├── Layout.jsx        sidebar + header
    │   └── Panel.jsx         UI reutilizable
    └── pages/
        ├── Optimizer.jsx     Markowitz + Black-Litterman
        ├── Risk.jsx          VaR, stress, descomposición
        └── Placeholder.jsx   módulos de fases futuras
```

---

## NOTAS IMPORTANTES

- **Los inputs son supuestos.** E[R], Vol y β están precargados con
  valores de ejemplo marcados `[Inferencia]`. Reemplazalos con tus
  views o data de Bloomberg (`BEst`, `GP` para β histórica). El
  optimizador es tan bueno como los inputs: garbage in, garbage out.

- **El modelo de covarianza es single-index** (market model). Suficiente
  para portafolios chicos. Fase 2+ puede agregar covarianza histórica
  real desde precios.

- **Black-Litterman** parte del equilibrio implícito en tus pesos
  actuales (prior) y lo combina con tus views, ponderados por
  confianza. No es un promedio simple — es actualización bayesiana.

- Esto **no es asesoría de inversión**. Es una herramienta de cálculo
  para tu propio proceso de decisión.
