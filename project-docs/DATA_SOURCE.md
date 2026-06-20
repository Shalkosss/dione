# DATA SOURCE

[CAMBIOS vs versión anterior: archivo nuevo. Reemplaza la sección
DATA SOURCE del system prompt con la verdad actual del código.
Limitaciones del snapshot REVISADAS: altmanZ/piotroski/sector ya NO
vienen null. debtToEquity ya NO es proxy de pasivos totales. Phase B
está LIVE. Documenta la ventana 09-10 UTC.]

URL base: `https://dionee.vercel.app`

DIONE NO usa web search para data de la app. Llama los endpoints directamente.

---

## Endpoints REALES (los únicos)

| Endpoint | Fuente | Cache | Devuelve |
|---|---|---|---|
| `GET /api/quote/[ticker]` | Finnhub | **30s** | precio, OHLC, prevClose, name, finnhubIndustry, marketCap (en **MILLONES USD**), changePct (**FRACCIÓN**: 0.04 = 4%), logo |
| `GET /api/candles/[ticker]?period1=&period2=&interval=1d` | Yahoo v8 proxy | **1h** | `chart.result[0]` con OHLCV + **adjclose**. `period1`/`period2` se validan como enteros |
| `GET /api/screener?mode=&capMin=&capMax=&minScore=&sort=&limit=&includeFailed=` | Supabase snapshot | **5min** | gems con preScore + technicalScore + comboScore + Altman + Piotroski + sector + gate. Modos: `fundamental` (500M-200B), `technical` (300M-50B), `combo` (1B-100B), `gems` (300M-2B) |
| `GET /api/smart-money?ticker=&minScore=&limit=` | Supabase snapshot smart-money | **10min** | top N por score (insider clusters + analyst drift). Top 100 gate-passers + override `SMART_MONEY_SYMBOLS` |
| `GET /api/healthz` | Supabase meta | no-store | status del snapshot. 200/200-degraded/503 según frescura |
| `GET /api/cron/refresh-gems` | EDGAR + Finnhub → Supabase | — | cron 09:00 UTC, `CRON_SECRET` |
| `GET /api/cron/refresh-technical` | Yahoo candles → Supabase merge | — | cron 10:00 UTC, `CRON_SECRET` |
| `GET /api/cron/refresh-smart-money` | Finnhub insider+recs → Supabase | — | cron 11:00 UTC, `CRON_SECRET` |

### NO EXISTEN (documentados en versiones viejas, no llamar):
`/api/portfolio`, `/api/log-thesis`, `/api/get-performance`, `/api/forward-portfolio`, `/api/risk`, `/api/screener?mode=short`.

---

## Convenciones de data

1. **`adjclose` SIEMPRE, `close` NUNCA** para cálculos multi-mes.
2. **Market cap viene en DOS unidades distintas**:
   - `/api/quote` → **MILLONES de USD**
   - `/api/screener` → dólares absolutos
3. **`changePct` viene en FRACCIÓN** (0.04 = 4%, NO 4.0).
4. **`sector` de `/api/quote` = `finnhubIndustry`** (NO GICS L1).
5. `/api/quote` devuelve 0 en todos los campos si el ticker no existe.

---

## Finnhub directo (key válida termina en `q420` — NO en "nag")

Para data que la app no expone:
- `/quote` — precio
- `/stock/metric?metric=all` — fundamentales, beta, 52w
- `/stock/insider-transactions` — Form 4
- `/stock/recommendation` — drift de analistas
- `/stock/profile2` — sector/industry (ya usado por el cron)

> Si en cualquier parte la key aparece terminando en `nag`, es corrupción
> de un copy/paste viejo. La key real termina en `q420`.

---

## Universo del snapshot

~6,000 filers SEC EDGAR escaneados diariamente.

### Filtros duros + quality gate
- Precio > $3, ADV > $1M/día (programáticos en el cron)
- ROE TTM > 10%, FCF TTM > 0
- `debtToEquity = (LongTermDebt + ShortTermDebt) / Equity` < 2 (cálculo real, NO proxy de pasivos totales)
- Altman Z ≥ 1.81 si está presente
- No auditor change 12m, no going-concern

Típicamente ~300 pasan el gate. **No hay tiers Russell**. El size emerge endógeno.

---

## Schema que devuelve `/api/screener`

```json
{
  "meta": {
    "updatedAt", "fiscalYear", "secCoverage", "gatePassers", "priced",
    "withSector", "technicalUpdatedAt", "technicalScored",
    "filters": { "mode", "capMin", "capMax", "sort", "sortRequested", "sortFallback" }
  },
  "results": [{
    "symbol", "name", "sector", "industry", "marketCap", "price",
    "preScore", "technicalScore", "comboScore",
    "wyckoffPhase", "wyckoffEvents",
    "gatePass", "gateReasons",
    "metrics": {
      "roe", "roic", "fcfYield", "debtToEquity", "currentRatio",
      "grossMargin", "netMargin", "pe",
      "altmanZ", "altmanModel" ("Z" o "Z\""),
      "piotroski" (0-9), "piotroskiPartial" (bool),
      "rsi", "cmf"
    },
    "technicalBreakdown"
  }]
}
```

---

## Lo que SÍ está poblado (revisión 2026-06)

| Campo | Status real | Notas |
|---|---|---|
| `altmanZ` | ✅ poblado | Z manufacturera por default; Z" como fallback para financieras/sin marketCap. Campo `altmanModel` indica cuál se usó |
| `piotroski` | ✅ poblado | 0-9. Si faltan 1-2 checks, devuelve score con `piotroskiPartial=true`. Si faltan >2, `null` |
| `debtToEquity` | ✅ correcto | `(LongTermDebt + ShortTermDebt) / Equity` real. El bug de "pasivos totales / equity" fue corregido |
| `sector` / `industry` | ✅ mayormente poblado | Finnhub `/stock/profile2` (cache 30d en `symbol_metadata`) + fallback SEC `sicDescription`. **Filtro `sector=` ahora opera** |
| `technicalScore` | ✅ poblado | Cron `refresh-technical` 10:00 UTC. Top 150 gate-passers por preScore. Wyckoff phase + RSI + CMF incluidos |
| `comboScore` | ✅ poblado | `0.5*preScore + 0.5*technicalScore`, redondeado |

---

## Limitaciones honestas (lo que sigue siendo cierto)

1. **`pe` desde net income**: empresas sin ganancias → `pe` null. No es bug, es definición.
2. **Cobertura US-centric**: EDGAR tickers son US-listed + ADRs. LATAM directos (BVN, EBR), Asia primary (7203 TM) no entran al snapshot — entran por `/deep` manual.
3. **Ventana diaria 09:00-10:00 UTC**: `refresh-gems` regenera el snapshot desde cero, wipea scores técnicos hasta que `refresh-technical` corra. Durante esa hora, `mode=technical`/`combo` caen a preScore y el endpoint marca `meta.filters.sortFallback`.
4. **Phase B procesa top 150**: si tu interés está fuera del top 150 por preScore, no tiene technicalScore. Manejado vía `/deep TICKER` que computa on-the-fly.
5. **Yahoo bloqueable**: si Yahoo bloquea IPs Vercel, `refresh-technical` cae y `meta.technicalUpdatedAt` queda viejo. Monitoreable.

---

## Flujo típico en `/deep TICKER`

1. `GET /api/quote/TICKER` → precio actual + meta
2. `GET /api/candles/TICKER?period1=[~250d atrás]&period2=[hoy]&interval=1d` → histórico
3. DIONE calcula on-the-fly cuando hace falta: Vol/Beta 90d, RSI, ATR, Bollinger, OBV, A/D Line, Wyckoff phase, Spring/UTAD detection
4. Finnhub directo para insider transactions + recommendation drift
5. Output con formato Deep Research

---

## Notas técnicas

- Endpoints en Vercel serverless (`api/quote/[ticker].js`, `api/candles/[ticker].js`, `api/screener.js`, `api/cron/refresh-gems.js`, `api/cron/refresh-technical.js`)
- Finnhub server-side (key en Vercel env vars) — no CORS leak al cliente
- Yahoo via proxy server-side — sin bloqueo CORS
- Supabase tablas: `hidden_gems_snapshot` (snapshot completo, fila `latest`), `symbol_metadata` (cache sector/industry/name por símbolo, TTL 30d)
- Repo GitHub conectado: push a main → re-deploy automático
