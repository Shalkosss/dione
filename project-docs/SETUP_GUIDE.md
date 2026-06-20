# SETUP GUIDE

[CAMBIOS vs versión anterior: Phase B del scoring técnico marcado como
LIVE (no pendiente). Sector tagging marcado como LIVE (Finnhub +
fallback SEC). Solo quedan pendientes: poblar THESIS_LOG, /smart-money
overview cron, monitoreo de fallos del cron. Inventario expandido para
incluir DATA_SOURCE.md.]

---

## ESTADO ACTUAL

App live: **https://dionee.vercel.app**
Endpoints en producción ([DATA_SOURCE.md](DATA_SOURCE.md) para schema completo):
- `GET /api/quote/[ticker]` — Finnhub, cache 30s
- `GET /api/candles/[ticker]?period1=&period2=&interval=1d` — Yahoo proxy, cache 1h
- `GET /api/screener?mode=&capMin=&capMax=&...` — Supabase snapshot, cache 5min
- `GET /api/cron/refresh-gems` — cron diario 09:00 UTC (CRON_SECRET)
- `GET /api/cron/refresh-technical` — cron diario 10:00 UTC (CRON_SECRET)

Pages live: Optimizer, Risk, Hidden Gems table, Screener (browser-side
parallel), Thesis (local, paste manual).

Backends del Hunter:
- Fundamental: ✅ LIVE (preScore + Altman + Piotroski + sector)
- Técnico (Phase B): ✅ LIVE (technicalScore + Wyckoff + comboScore para top 150)

**No hay pasos pendientes de despliegue.** Los pendientes son operativos
y de monitoreo.

---

## FASE 1 — Configurar el Claude Project (10 min)

### 1.1 Crear Project
1. [claude.ai](https://claude.ai) → Projects → Create Project
2. Nombre: `Dione v3 — Equity Research`
3. Descripción: `Senior PM nivel JPM AM. Equity research multi-lente, smart money tracking, portafolio óptimo.`

### 1.2 Pegar custom instructions
El system prompt de DIONE (lo que antes se llamaba "INSTRUCTIONS.md")
va en el campo **Custom instructions** del Project. NO es un archivo
del knowledge base.

### 1.3 Subir Project Knowledge
Los 20 archivos del [INDEX](INDEX.md). Esperar a que se procesen.

### 1.4 Test
```
/help
/quick MELI
/scan-combo limit=5
```
Si responde con la lista de comandos, un análisis estructurado, y un
top 5 con `meta.filters.mode="combo"`, OK.

---

## FASE 2 — Pendientes operativos (no despliegue)

### A. Poblar THESIS_LOG
Hoy está vacío. Cada `/deep` con conviction ≥ 3 debe gatillar
`/log-thesis TICKER`. Mínimo n=10 antes de que `/performance` tenga
señal estadística.

### B. `/smart-money` overview (cron dedicado)
Hoy `/smart-money TICKER` funciona (insider + recs vía Finnhub). El
overview sin ticker (top semanal) requiere cron que agregue señales por
ticker en Supabase. Equivalente a `refresh-gems` pero para 13F + Form 4.
**No implementado.**

### C. Monitoreo de fallos de cron
Hoy `console.error` en serverless ≠ alerta. Si `refresh-technical`
falla un día (Yahoo bloquea, EDGAR rate-limit), nadie se entera salvo
inspeccionar Vercel logs. Roadmap:
- Healthcheck endpoint que devuelva 503 si `meta.technicalUpdatedAt > 26h`
- Alerta opcional vía webhook (Discord/Telegram) cuando se cae

### D. Yahoo fallback para Phase B
Si Yahoo bloquea IPs Vercel, `refresh-technical` muere. Stooq diario
tiene OHLC histórico — puede ser fallback con menos resolución intraday
pero suficiente para Wyckoff diario.

### E. Sector mapping a GICS L1
Finnhub devuelve `finnhubIndustry` + a veces `gicsSector`; SEC fallback
da `sicDescription`. El campo `sector` del snapshot es heterogéneo.
Mapeo a GICS L1 estándar (11 categorías) permitiría filtro/heatmap
consistente. **No bloqueante.**

---

## FASE 3 — Workflow diario perpetuo

### Mañana (15 min) — fuera de la ventana 09-10 UTC (Lima: 04-05 AM)
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

### `/scan-combo` devuelve todos los `technicalScore` en null
- Probablemente estás en la ventana 09:00-10:00 UTC. Esperá 15 min y reintentá.
- Si fuera de esa ventana: `meta.technicalUpdatedAt` >26h → `refresh-technical` cayó. Reintento manual con CRON_SECRET.

### Sector siempre null
- Solo pasa si `enrichSectors` cayó dos veces consecutivas (Finnhub + SEC submissions). Ver `meta.withSector / meta.gatePassers`.
- Si <50%, hay problema upstream. Si ~80-90%, es la cobertura normal.

### Memoria entre sesiones
- No persiste. Al inicio de cada sesión pegá el último THESIS_LOG.md si
  trabajás sobre tesis abiertas.

### Key Finnhub que termina en `nag`
- Es corrupción de un copy/paste viejo. La key real termina en `q420`.
  Ver [KEYS](KEYS.md).

---

## EVOLUCIÓN DEL PROJECT

| Cadencia | Qué tocar |
|---|---|
| Semanal | WATCHLIST, THESIS_LOG |
| Mensual | MANDATE (si cambió capital/horizonte), ajustes sugeridos por `/performance` |
| Trimestral | Frameworks no usados, capacidades faltantes, revisar limitaciones del snapshot |
| Anual | Setup completo, backtest formal por modo |

---

## INVENTARIO

Ver [INDEX.md](INDEX.md). Son 20 archivos. Si encontrás un nombre fuera
de ese índice, está deprecated.
