# SETUP GUIDE

[CAMBIOS vs versión anterior: borrada la Fase 2 con endpoints fantasma
(/api/portfolio, /api/smart-money, /api/log-thesis, /api/get-performance,
/api/forward-portfolio — no existen). La app ya está live en
https://dionee.vercel.app sin pasos pendientes de despliegue. Los
pendientes son operativos. INSTRUCTIONS.md eliminado del inventario (es
el system prompt del Project, no un .md). Inventario actualizado a 19
archivos reales — ver INDEX.md.]

---

## ESTADO ACTUAL

App live: **https://dionee.vercel.app**
Endpoints reales en producción:
- `GET /api/quote/[ticker]` — Finnhub, cache 30s
- `GET /api/candles/[ticker]?period1=&period2=&interval=1d` — Yahoo proxy, cache 1h
- `GET /api/screener?mode=&capMin=&capMax=&minScore=&sector=&gicsSector=&sort=&limit=&includeFailed=&includeNoCap=&includeBorderline=` — Supabase snapshot, cache 5min
- `GET /api/smart-money?ticker=&minScore=&limit=` — Supabase snapshot smart-money, cache 10min
- `GET /api/healthz` — status del snapshot, no-store
- `GET /api/cron/refresh-gems` — cron 09:00 UTC (CRON_SECRET)
- `GET /api/cron/refresh-technical` — cron 10:00 UTC (CRON_SECRET)
- `GET /api/cron/refresh-smart-money` — cron 11:00 UTC (CRON_SECRET)

Pages live: Optimizer, Risk, Hidden Gems table, Thesis.

**No hay pasos pendientes de despliegue.** Los pendientes son operativos.

---

## FASE 1 — Configurar el Claude Project (10 min)

### 1.1 Crear Project
1. [claude.ai](https://claude.ai) → Projects → Create Project
2. Nombre: `Dione v3 — Equity Research`
3. Descripción: `Senior PM nivel JPM AM. Equity research multi-lente, smart money tracking, portafolio óptimo.`

### 1.2 Pegar custom instructions
El system prompt del DIONE (lo que antes se llamaba "INSTRUCTIONS.md")
va en el campo **Custom instructions** del Project. NO es un archivo
del knowledge base.

### 1.3 Subir Project Knowledge
Los 20 archivos del [INDEX](INDEX.md). Esperar a que se procesen.

### 1.4 Test
```
/help
/quick MELI
```
Si responde con la lista de comandos y un análisis estructurado, OK.

---

## FASE 2 — Pendientes operativos (no despliegue)

### A. Poblar THESIS_LOG
Hoy está vacío. Cada `/deep` con conviction ≥ 3 debe gatillar
`/log-thesis TICKER`. Mínimo n=10 antes de que `/performance` tenga señal.

### B. ~~Activar Phase B del scoring técnico~~ ✅ LIVE
`refresh-technical` corre 10:00 UTC sobre top 200 gate-passers, computa
technicalScore v3 (doble vía Trend/Wyckoff) + comboScore y los mergea
al snapshot. Ver [HUNTER_MODES](HUNTER_MODES.md) y
[COMMANDS_status](COMMANDS_status.md).

### C. ~~Tagging de sector~~ ✅ LIVE
Sector poblado vía Finnhub `/stock/profile2` con fallback SEC
`submissions/sicDescription`, cache 30d en tabla `symbol_metadata`.
El filtro `sector=` del screener opera case-insensitive contains.
Coverage típica: 100% del snapshot.

### D. ~~/smart-money overview~~ ✅ LIVE
Cron `refresh-smart-money` 11:00 UTC corre sobre top 100 por comboScore
y computa insider clusters + analyst drift. Endpoint
`/api/smart-money?limit=10` devuelve el overview.

### E. Operación diaria (real pending)
- Monitorear `meta.technicalDegraded` y `/api/healthz` después de
  ventanas de mantenimiento de Yahoo/Finnhub.
- Backtest formal por modo en `n ≥ 15` tesis del THESIS_LOG.

---

## FASE 3 — Workflow diario perpetuo

### Mañana (15 min)
- Chat nuevo en Project
- `/macro` — régimen
- `/scan-combo` — top oportunidades

### Bloomberg (2 hrs, en universidad)
- Seguir [BLOOMBERG_WORKFLOW](BLOOMBERG_WORKFLOW.md)
- Pegar data al Project

### Tarde (30 min)
- `/deep TICKER` sobre el mejor candidato
- `/log-thesis TICKER` si hay convicción real

### Cierre (10 min)
- `/news`

---

## TROUBLESHOOTING

### DIONE responde formato inesperado a un comando
- Re-subir el .md correspondiente al Project knowledge
- Chat nuevo

### DIONE inventa precios
- Está usando training data. Forzá: "llamá `/api/quote/TICKER` antes de responder"

### Respuestas cortas / no consulta archivos
- Pedirlo explícito: "Consultando [WYCKOFF_FRAMEWORK.md](WYCKOFF_FRAMEWORK.md), analizá NOW"

### Memoria entre sesiones
- No persiste. Al inicio de cada sesión pegá el último THESIS_LOG.md
  si trabajás sobre tesis abiertas.

### Key Finnhub que termina en `nag`
- Es corrupción de un copy/paste viejo. La key real termina en `q420`.
  Ver [KEYS](KEYS.md).

---

## EVOLUCIÓN DEL PROJECT

| Cadencia | Qué tocar |
|---|---|
| Semanal | WATCHLIST, THESIS_LOG |
| Mensual | MANDATE (si cambió capital/horizonte), ajustes sugeridos por `/performance` |
| Trimestral | Frameworks no usados, capacidades faltantes |
| Anual | Setup completo, backtest formal por modo |

---

## INVENTARIO

Ver [INDEX.md](INDEX.md). Son 20 archivos. Si encontrás un nombre fuera
de ese índice, está deprecated.
