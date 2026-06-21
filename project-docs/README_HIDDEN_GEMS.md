# README HIDDEN GEMS

[CAMBIOS vs versión anterior: limitaciones revisadas al estado real del
código. altmanZ/piotroski/sector YA están poblados. debtToEquity es real,
no proxy. Phase B (technical scoring) documentado como LIVE con su cron
dedicado refresh-technical a las 10:00 UTC.
2026-06: Stooq removido (anti-bot challenge mid-2026), reemplazado por
Finnhub primary + Yahoo fallback. Top de Phase B bumped 150 → 200. Doc
realineada al refactor.]

`/hidden-gems` y los `/scan-*` — Arquitectura real del screener.

## QUÉ HACE

Dos crons diarios precomputan un universo amplio de filers SEC + scoring
fundamental y técnico, y guardan todo en un snapshot Supabase. DIONE lee
ese snapshot vía `/api/screener` y rankea según el modo pedido.

**Es la fuente de descubrimiento de nombres NUEVOS** — escanea ~6,000
filers EDGAR, por definición fuera del círculo conocido del usuario.

---

## ARQUITECTURA REAL

```
Vercel Cron #1 — 09:00 UTC diario
   └─► /api/cron/refresh-gems         (CRON_SECRET)
         ├─ SEC EDGAR (XBRL frames)   → universo + fundamentales
         ├─ quality gate (ROE, FCF, D/E real, Altman si computable)
         ├─ Finnhub /quote + Yahoo /v8/chart → precio + marketCap
         ├─ Finnhub /stock/profile2   → sector/industry (cache 30d en symbol_metadata)
         ├─ SEC submissions fallback  → sicDescription cuando Finnhub no cubre
         ├─ preScore() + Altman Z/Z" + Piotroski F-Score
         └─ writeSnapshot()           → Supabase hidden_gems_snapshot

Vercel Cron #2 — 10:00 UTC diario
   └─► /api/cron/refresh-technical    (CRON_SECRET)
         ├─ readSnapshot()
         ├─ top 200 gate-passers por preScore (TECHNICAL_MAX_SYMBOLS)
         ├─ Yahoo candles batch (400 días)
         ├─ computeTechnicalScore() v3 → composite + Wyckoff phase + RSI + CMF
         ├─ comboScore = 0.5·pre + 0.5·tech
         └─ writeSnapshot() (merge)

Vercel Cron #3 — 11:00 UTC diario
   └─► /api/cron/refresh-smart-money  (CRON_SECRET)
         ├─ top 100 gate-passers por comboScore
         ├─ Finnhub /insider-transactions + /recommendation
         └─ writeSnapshot() (smart-money slice)

DIONE ── GET /api/screener?mode=... ◄── readSnapshot() ── filtra + rankea
```

---

## POR QUÉ EDGAR FRAMES

Un "frame" trae UN concepto (ej. `NetIncomeLoss`) de TODAS las empresas
en UNA llamada. Con ~20 llamadas se computan los ratios de ~6,000
empresas en <60s. Por eso NO necesita rotación por chunks.

## POR QUÉ FINNHUB + YAHOO PARA PRECIO

`api.nasdaq.com` bloquea IPs de datacenter (Vercel). Stooq sí servía CSV
plano, pero mid-2026 sumó un anti-bot JS challenge (SHA-256 PoW + POST
`/__verify`) que los crons serverless no pueden resolver. Ahora:
- **Finnhub `/quote`** primario — rápido, batch throttle 25/s, devuelve close.
- **Yahoo `/v8/finance/chart`** fallback — para los símbolos que Finnhub
  no resolvió. Usa el último close del rango 7d.

`marketCap = price × shares` con `EntityCommonStockSharesOutstanding` de
EDGAR.

## POR QUÉ DOS CRONS SEPARADOS

- `refresh-gems` es rápido (~30-60s) y cap-independiente.
- `refresh-technical` es lento (~40s-3min para 200 símbolos × 400 días de
  candles cada uno) y depende de Yahoo, que es más frágil.

Si `refresh-technical` falla, `refresh-gems` no se contamina. El endpoint
`/api/screener` detecta scores técnicos ausentes y cae a preScore con
`meta.filters.sortFallback` poblado.

---

## FUENTES Y COSTO

| Pieza | Fuente | Costo | Nota |
|---|---|---|---|
| Fundamentales + shares | SEC EDGAR XBRL | $0 | UA con email real, ~9 req/s |
| Precio | Finnhub `/quote` + Yahoo `/v8/chart` fallback | $0 free tier | Stooq removido (anti-bot) |
| Sector / industry | Finnhub /stock/profile2 + SEC sicDescription fallback | $0 free tier | cache 30d |
| Candles (Phase B) | Yahoo v8 | $0 | proxy server-side, 2 hosts con failover |
| Storage del snapshot | Supabase Postgres (JSONB) | $0 free tier | tablas `hidden_gems_snapshot`, `symbol_metadata` |
| Quote en vivo | Finnhub | $0 free tier | `/api/quote` |

---

## SCHEMA QUE DEVUELVE `/api/screener`

```json
{
  "meta": {
    "updatedAt", "fiscalYear", "secCoverage", "gatePassers", "priced",
    "withSector", "nullDebtCount",
    "technicalUpdatedAt", "technicalScored", "technicalAttempted",
    "technicalCandleFailures", "technicalDegraded",
    "returned", "returnedBorderline",
    "filters": { "mode", "capMin", "capMax", "minScore", "sector",
                 "gicsSector", "sort", "sortRequested", "sortFallback",
                 "includeBorderline" }
  },
  "results": [{
    "symbol", "name", "sector", "industry", "marketCap", "price",
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
    "technicalBreakdown"
  }]
}
```

Query params: `mode, capMin, capMax, minScore, sector, gateOnly, sort, limit (1-100), includeFailed, includeNoCap`.

---

## LIMITACIONES HONESTAS

1. **`pe` desde net income**: empresas sin ganancias → `pe` null. Es definición, no bug.
2. **Cobertura US-centric**: EDGAR cubre US-listed + ADRs. LATAM directos, Asia primary fuera del snapshot — entran por `/deep` manual.
3. **Ventana diaria 09:00-10:00 UTC**: scores técnicos están null mientras corre la regeneración fundamental + Phase B. `meta.filters.sortFallback` lo expone.
4. **Phase B procesa top 200 por preScore**: si un ticker pasa el gate pero tiene preScore bajo (< ~60), no se le computa technicalScore. Cubrible vía `/deep TICKER` o subiendo `TECHNICAL_MAX_SYMBOLS`.
5. **Yahoo bloqueable**: si bloquea IPs Vercel, `refresh-technical` cae. `meta.technicalUpdatedAt` viejo = señal.

---

## DISPARO MANUAL

```bash
# Regenerar snapshot fundamental
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  https://dionee.vercel.app/api/cron/refresh-gems

# Después de gems, regenerar scoring técnico (debe correrse en ese orden)
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  https://dionee.vercel.app/api/cron/refresh-technical
```

## CONSUMIR

```bash
# combo (Diamond tier)
curl "https://dionee.vercel.app/api/screener?mode=combo&limit=10"

# fundamental puro
curl "https://dionee.vercel.app/api/screener?mode=fundamental&limit=25&minScore=70"

# hidden gems small caps
curl "https://dionee.vercel.app/api/screener?mode=gems&capMax=2000000000&limit=25"
```

---

## VARIABLES DE ENTORNO (Vercel)

| Var | Para qué |
|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | escribir/leer el snapshot y el cache de sectores |
| `CRON_SECRET` | proteger los endpoints de cron |
| `SEC_USER_AGENT` | UA con email real para EDGAR |
| `FINNHUB_KEY` | quote + profile2 (sector) |
| `GEMS_YEAR` (opcional) | forzar año fiscal del snapshot |
| `TECHNICAL_MAX_SYMBOLS` (opcional) | default 200 |
