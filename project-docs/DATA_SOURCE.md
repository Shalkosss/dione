# DATA SOURCE

[CAMBIOS 2026-10-12 (verificado en vivo contra el código y los endpoints):
campo de sector en `/api/quote` se llama `sector` (mapea finnhubIndustry);
ticker inexistente → HTTP 404 (no ceros); ventana unificada 09-11 UTC;
schema de `/api/smart-money` y `/api/healthz` documentado; meta
`withGics`; protocolo de candles (period2 dinámico, vela intradía,
staleness/drift) agregado.
Versión previa: archivo nuevo. Reemplaza la sección
DATA SOURCE del system prompt con la verdad actual del código.
Limitaciones del snapshot REVISADAS: altmanZ/piotroski/sector ya NO
vienen null. debtToEquity ya NO es proxy de pasivos totales. Phase B
está LIVE. Documentaba la ventana 09-10 UTC.]

URL base: `https://dionee.vercel.app`

DIONE NO usa web search para data de la app. Llama los endpoints directamente.

---

## Endpoints REALES (los únicos)

| Endpoint | Fuente | Cache | Devuelve |
|---|---|---|---|
| `GET /api/quote/[ticker]` | Finnhub | **30s** | `ticker, fetchedAt, price, change, changePct` (**FRACCIÓN**: 0.04 = 4%), `high, low, open, prevClose, timestamp` (ms), `name, sector` (= finnhubIndustry), `currency, exchange, marketCap` (**MILLONES USD**), `logo, weburl`. Ticker inexistente → **404** |
| `GET /api/candles/[ticker]?period1=&period2=&interval=1d` | Yahoo v8 proxy | **1h** | `chart.result[0]` con OHLCV + **adjclose**. `period1`/`period2` se validan como enteros |
| `GET /api/screener?mode=&capMin=&capMax=&minScore=&sort=&limit=&includeFailed=&includeBorderline=` | Supabase snapshot | **5min** | gems con preScore + technicalScore v3 + comboScore + Altman + Piotroski + sector + gate. Modos: `fundamental` (500M-200B), `technical` (300M-50B), `combo` (1B-100B), `gems` (300M-2B). `includeBorderline=true` agrega clave `borderline` con candidatos de divergencia |
| `GET /api/smart-money?ticker=&minScore=&limit=` | Supabase snapshot smart-money | **10min** | Overview: `{ meta, results: [{ symbol, score, breakdown, insider, analyst }] }`. Con `?ticker=`: `{ meta, ticker, result }` o 404 si está fuera del top 100 por comboScore (+ override `SMART_MONEY_SYMBOLS`). 503 si no hay snapshot |
| `GET /api/healthz` | Supabase meta | no-store | `{ ok, degraded, fundamental: { updatedAt, ageHours, stale, gatePassers, withSector }, technical: { updatedAt, ageHours, stale, scored, attempted, degradedRunFlag }, thresholds }`. 200 / 200+degraded / 503 (umbral 26h). **Llamar primero en cualquier scan** |
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
4. **`sector` de `/api/quote` es el `finnhubIndustry` de Finnhub** (NO GICS L1). En el screener, `sector` es heterogéneo (Finnhub o SIC de SEC); para GICS L1 usar `gicsSector` (poblado en ~60% del snapshot, ver `meta.withGics`).
5. `/api/quote` devuelve **HTTP 404** si el ticker no existe (Finnhub manda ceros; el endpoint los convierte en 404).

### Protocolo de candles (obligatorio antes de cualquier indicador técnico)

1. **`period2 = int(time.time())`** siempre dinámico. Timestamps fijos causaron data stale (casos NUTX/TGLS). `period1` = period2 − N×86400.
2. **Filtrar nulls** en `indicators.quote[0]` y `indicators.adjclose[0].adjclose` antes de calcular.
3. **Staleness gate**: la última vela debe tener ≤ 7 días calendario (y en días hábiles, ser de la última sesión). Si es más vieja → parar y reportar, no calcular.
4. **Vela intradía**: durante la sesión US, la última vela es parcial (volumen incompleto). Excluirla de RSI/ATR/OBV/RVOL o marcarla explícitamente.
5. **Drift check**: último adjclose vs `price` de `/api/quote` dentro de ~0.2%. Si no, sospechar split/ticker reciclado (SNDK, SPCX) y validar con web search.
6. **Exchange + liquidez**: NYSE/NASDAQ/AMEX (no OTC) y ADV > $1M/día antes de cualquier `/deep`.
7. Cálculos en Python stdlib (`math`, `statistics`); TLS verificado (nunca `CERT_NONE`).

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

> Cuando `includeBorderline=true`, el body incluye además una clave
> `borderline: [...]` con candidatos que NO califican como Diamond pero
> tienen divergencia fundamental/técnica significativa. Cada entry de
> `borderline` lleva un campo `borderlineReason`. Ver [HUNTER_MODES](HUNTER_MODES.md).



```json
{
  "meta": {
    "updatedAt", "fiscalYear", "secCoverage", "gatePassers", "priced",
    "withSector", "withGics", "totalTracked", "nullDebtCount", "sources", "ms",
    "technicalUpdatedAt", "technicalScored", "technicalAttempted",
    "technicalCandleFailures", "technicalDegraded",
    "returned", "returnedBorderline",
    "filters": { "mode", "capMin", "capMax", "minScore", "sector",
                 "gicsSector", "sort", "sortRequested", "sortFallback",
                 "includeBorderline" }
  },
  "results": [{
    "symbol", "name", "sector", "industry", "gicsSector",
    "marketCap", "price",
    "preScore", "technicalScore", "comboScore",
    "wyckoffPhase", "wyckoffEvents",
    "gatePass", "gateReasons",
    "metrics": {
      "roe", "roic", "fcfYield", "debtToEquity", "currentRatio",
      "grossMargin", "netMargin", "pe",
      "altmanZ", "altmanModel" ("Z" | "Z\""),
      "piotroski" (0-9 | null), "piotroskiPartial" (bool),
      "rsi", "cmf"
    },
    "technicalBreakdown": {
      "trendTrack", "wyckoffTrack", "composite", "bonuses",
      "viaUsed" ("trend" | "wyckoff"),
      "goldenCrossAge" (días | null),
      "rsi", "cmf", "momentum12_1" (fracción | null),
      "wyckoffPhase"
    }
  }],
  "borderline": [  // SOLO cuando includeBorderline=true
    { ...mismo schema que results..., "borderlineReason": string }
  ]
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
| `technicalScore` | ✅ poblado | Cron `refresh-technical` 10:00 UTC. **Top 200** gate-passers por preScore (env `TECHNICAL_MAX_SYMBOLS`). Wyckoff phase + RSI + CMF incluidos |
| `comboScore` | ✅ poblado | `0.5*preScore + 0.5*technicalScore`, redondeado |

---

## Limitaciones honestas (lo que sigue siendo cierto)

1. **`pe` desde net income**: empresas sin ganancias → `pe` null. No es bug, es definición.
2. **Cobertura US-centric**: EDGAR tickers son US-listed + ADRs. LATAM directos (BVN, EBR), Asia primary (7203 TM) no entran al snapshot — entran por `/deep` manual.
3. **Ventana diaria 09:00-11:00 UTC** (04-06 Lima): `refresh-gems` regenera el snapshot desde cero, wipea scores técnicos hasta que `refresh-technical` termine (~10:45 UTC observado); smart-money se refresca a las 11:00. Durante esa ventana, `mode=technical`/`combo` caen a preScore y el endpoint marca `meta.filters.sortFallback`.
4. **Phase B procesa top 200**: si tu interés está fuera del top 200 por preScore, no tiene technicalScore. Manejado vía `/deep TICKER` que computa on-the-fly. Override con env `TECHNICAL_MAX_SYMBOLS`.
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

- Endpoints en Vercel serverless (`api/quote/[ticker].js`, `api/candles/[ticker].js`, `api/screener.js`, `api/smart-money.js`, `api/healthz.js`, `api/cron/refresh-gems.js`, `api/cron/refresh-technical.js`, `api/cron/refresh-smart-money.js`)
- Finnhub server-side (key en Vercel env vars) — no CORS leak al cliente
- Yahoo via proxy server-side — sin bloqueo CORS
- Supabase tablas: `hidden_gems_snapshot` (snapshot completo, fila `latest`), `smart_money_snapshot` (fila `latest`), `symbol_metadata` (cache sector/industry/name por símbolo, TTL 30d)
- Repo GitHub conectado: push a main → re-deploy automático
