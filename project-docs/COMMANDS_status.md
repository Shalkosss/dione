# COMMANDS STATUS

[CAMBIOS vs versión anterior: reescrito al estado REAL del código.
Phase B del scoring técnico está LIVE (cron refresh-technical agendado
10:00 UTC diario). Sector enrichment está LIVE (Finnhub + SEC fallback,
cache 30d). Altman Z y Z" + Piotroski computados en lib/edgar.js.
Ventana diaria 09:00-10:00 UTC documentada como degradación esperada.]

Estado real de cada comando, basado en el código fuente actual del repo,
no en aspiraciones.

## LEYENDA
- ✅ **AUTO** — DIONE lo corre solo llamando endpoints reales.
- 🟡 **PASTE** — necesita que pegues data (Bloomberg) o se hace manual.
- 🌐 **WEB-APP** — vive en la UI de dionee.vercel.app.
- 🔴 **NO EXISTE** — documentado pero sin backing.
- ⏱ **WINDOW** — funciona, con ventana conocida de degradación.

---

## ANÁLISIS DE TICKERS

| Comando | Estado | Nota |
|---|---|---|
| `/deep TICKER` | ✅ AUTO | quote + candles(adjclose) + Finnhub metric/insider/recs + razonamiento Wyckoff |
| `/quick TICKER` | ✅ AUTO | igual, más corto |
| `/wyckoff TICKER` | ✅ AUTO | candles + `lib/wyckoff.js` + `lib/technicalScore.js` |
| `/bull` `/bear` `/fundamental` `/valuation TICKER` | ✅ AUTO | razonamiento sobre data real |

---

## HUNTER

| Comando | Estado | Cómo lo ejecuta DIONE |
|---|---|---|
| `/scan-fundamental [limit=N]` | ✅ AUTO | `GET /api/screener?mode=fundamental&limit=N` — rankea por preScore |
| `/scan-technical [limit=N]` | ✅ AUTO ⏱ | `GET /api/screener?mode=technical&limit=N` — rankea por technicalScore (precomputado por cron refresh-technical). **Ventana**: 09:00-10:00 UTC los scores se regeneran, durante esa hora el endpoint cae a preScore con `meta.filters.sortFallback` poblado |
| `/scan-combo [limit=N]` | ✅ AUTO ⏱ | `GET /api/screener?mode=combo&limit=N&includeBorderline=true` — rankea por comboScore (0.5·pre + 0.5·tech v3). **DIONE debe pasar `includeBorderline=true` siempre**. Response trae `results` (Diamond, max 8) + `borderline` (divergencias, max 5, con `borderlineReason`). Misma ventana 09-10 UTC |
| `/scan-divergence` | 🟡 PARCIAL | DIONE cruza Fund vs Tech scores del snapshot. Funciona dentro de la ventana técnica |
| `/hidden-gems` | ✅ AUTO | `GET /api/screener?mode=gems` — cap $300M-$2B |

**Defaults**: `limit=25`, `minScore=60` (fundamental/gems) / `0` (technical/combo).

---

## SMART MONEY

| Comando | Estado | Nota |
|---|---|---|
| `/smart-money TICKER` | ✅ AUTO | `GET /api/smart-money?ticker=TICKER` — devuelve insider + analyst drift del snapshot precomputado. 404 si está fuera del top N (config `SMART_MONEY_SYMBOLS`). 13F y dark pool: paste Bloomberg |
| `/smart-money` (overview) | ✅ AUTO | `GET /api/smart-money?limit=10` — top N por score. Cron `refresh-smart-money` 11:00 UTC sobre top 100 gate-passers |

---

## SHORT

| Comando | Estado | Nota |
|---|---|---|
| `/scan-short [limit=N]` | 🟡 MANUAL | NO existe `/api/screener?mode=short`. DIONE razona sobre watchlist + megacaps en deterioro + paste Bloomberg |
| `/short TICKER` | ✅ AUTO | razonamiento sobre data real |
| `/distribution TICKER` | ✅ AUTO | Wyckoff distribución vía `lib/wyckoff.js` |

---

## MACRO / SECTORES

| Comando | Estado | Nota |
|---|---|---|
| `/macro` | ✅ AUTO | via web search (Fed, CPI, curva, etc.) |
| `/sector-atlas` `/sector X` | 🟡 PASTE | mejor con Bloomberg IMAP/BI pegado |
| `/catalysts [TICKER]` | ✅/🟡 | earnings dates via web/Finnhub; calendario rico = Bloomberg |

---

## PORTAFOLIO / RIESGO

| Comando | Estado | Nota |
|---|---|---|
| `/portfolio` `/risk-check` `/rebalance` `/forward-portfolio` | 🌐 WEB-APP | viven en `src/pages/Optimizer.jsx`, `src/pages/Risk.jsx` |
| `/portfolio-input` | 🌐 WEB-APP | estado en localStorage |

---

## OPERACIÓN / LOG

| Comando | Estado | Nota |
|---|---|---|
| `/news` `/morning-brief` | ✅ AUTO | web search + watchlist |
| `/log-thesis TICKER` | 🟡 PASTE | DIONE genera el bloque; vos lo pegás (web app Thesis.jsx existe pero la persistencia a Supabase es Fase 3) |
| `/performance` | 🟡 PASTE | sobre el THESIS_LOG que pegues |
| `/glossary` `/explain` `/cheatsheet` `/help` | ✅ AUTO | razonamiento puro |

---

## FLUJO HUNTER (lo que importa)

```
Vos escribís:  /scan-combo limit=10
       ↓
DIONE llama:   GET /api/screener?mode=combo&limit=10
       ↓
Endpoint lee snapshot Supabase (precomputado por crons):
  - refresh-gems    → 09:00 UTC: preScore + Altman + Piotroski + sector + cap
  - refresh-technical → 10:00 UTC: technicalScore + Wyckoff + comboScore
       ↓
DIONE rankea por comboScore y devuelve top 10
       ↓
Vos elegís:    /deep ALLY
       ↓
DIONE llama:   GET /api/quote/ALLY + GET /api/candles/ALLY?...
       ↓
Razonamiento Wyckoff + valuación + adversarial pairing
```

Cero JSON que pegar. Los tres scans (fundamental/technical/combo) funcionan igual.

---

## HEALTHCHECK

`GET /api/healthz` devuelve el estado del snapshot.
- `200` con `degraded:false` → fundamental + técnico frescos
- `200` con `degraded:true` → fundamental fresco, técnico viejo o ausente
- `503` → fundamental viejo (>26h) o ausente

Útil para monitor externo (UptimeRobot, BetterStack) cada 15-60 min.

---

## VENTANA DIARIA 09:00-11:00 UTC

Es la única degradación conocida del Hunter:

1. **09:00 UTC** — `refresh-gems` regenera el snapshot fundamental DESDE CERO sobre los ~6,000 filers EDGAR. En ese proceso, `technicalScore`/`comboScore` quedan en null (se sobrescriben).
2. **10:00 UTC** — `refresh-technical` corre sobre el top 150 gate-passers por preScore, baja 400 días de candles de Yahoo, computa technicalScore + Wyckoff phase + comboScore.
3. **11:00 UTC** — `refresh-smart-money` computa insider + analyst drift sobre el top 100 por comboScore.
4. **Durante esa ventana**: `mode=technical` y `mode=combo` caen a preScore. El endpoint expone esto en `meta.filters.sortFallback` y en el header `X-Sort-Fallback`.

Si querés evitar la ventana, scaneá fuera de 09-11 UTC (04-06 AM Lima).

---

## SI ALGO FALLA

| Síntoma | Probable causa | Verificación |
|---|---|---|
| `/scan-combo` devuelve scores 0 o todos null en tech | `refresh-technical` falló (Yahoo bloqueó o timeout) | `meta.technicalUpdatedAt` > 26h |
| `/scan-fundamental` devuelve 503 | `refresh-gems` falló (EDGAR rate limit) | `meta.updatedAt` viejo |
| Sector siempre null en results | `enrichSectors` falló (Finnhub down + SEC submissions sin sicDescription) | `meta.withSector / meta.gatePassers` ratio |
| `/quote TICKER` 500 | Key Finnhub corrupta o expirada | revisar Vercel env. Si termina en `nag` está mal — debe terminar en `q420` |
