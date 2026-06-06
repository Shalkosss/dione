# Phase B — Screener scoring (technical + sector + balance-sheet fix)

Cierre de Phase B: ahora el snapshot lleva preScore (fundamental), technicalScore (Wyckoff/momentum/volume), comboScore (50/50), sector via Finnhub, debtToEquity con deuda real (no pasivos totales), Altman Z y Piotroski F-Score.

## Archivos

- `lib/wyckoff.js` — indicadores puros (SMA/RSI/ATR/OBV/A-D/CMF) + `detectWyckoffPhase`.
- `lib/technicalScore.js` — score 0-100 (trend 30 + momentum 20 + volume 25 + wyckoff 25).
- `lib/yahoo.js` — bajada de candles en batch desde Yahoo Finance (sin key).
- `lib/finnhub.js` — enriquecimiento sector/industry con cache 30d en Supabase.
- `lib/edgar.js` — extendido: FY-1 para Piotroski, LongTermDebt + ShortTermDebt para D/E, RetainedEarnings para Altman.
- `api/cron/refresh-technical.js` — cron nuevo, corre 10:00 UTC.
- `api/cron/refresh-gems.js` — ahora también enriquece sector y propaga altmanZ + piotroski.
- `api/screener.js` — modes `gems` / `fundamental` / `technical` / `combo` con sort por defecto correcto.
- `migrations/001_symbol_metadata.sql` — tabla cache de sector.
- `tests/wyckoff.test.js` — sanity checks de indicadores + fixture SC/Spring.

## Setup (una vez)

1. Aplicar la migration en Supabase:

   ```
   Supabase → SQL editor → pegar contents de migrations/001_symbol_metadata.sql → Run
   ```

2. Verificar env vars en Vercel (Settings → Environment Variables):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
   - `SEC_USER_AGENT` (con email real)
   - `FINNHUB_KEY` — si termina en `...nag` está corrupta, debe terminar en `...q420`.

3. `npm install` para bajar `vitest`.

## Correr los crons manualmente

```bash
# Fundamental (~120s en cold start, levanta 4-5k symbols, filtra a ~300-500 passers)
curl -H "Authorization: Bearer $CRON_SECRET" https://dionee.vercel.app/api/cron/refresh-gems

# Technical — corre DESPUÉS del fundamental (necesita el snapshot existente)
# Procesa MAX_SYMBOLS=150 top-preScore por defecto (~60-90s con Yahoo a 5 req/s)
curl -H "Authorization: Bearer $CRON_SECRET" https://dionee.vercel.app/api/cron/refresh-technical
```

## Verificar el snapshot

```bash
# 10 mejores comboScore con todos los campos nuevos
curl "https://dionee.vercel.app/api/screener?mode=combo&limit=10" | jq '.results[] | {symbol, sector, preScore, technicalScore, comboScore, wyckoffPhase, altmanZ: .metrics.altmanZ, piotroski: .metrics.piotroski, debtToEquity: .metrics.debtToEquity}'

# Top 10 técnico puro
curl "https://dionee.vercel.app/api/screener?mode=technical&limit=10"

# Filtrar por sector
curl "https://dionee.vercel.app/api/screener?mode=combo&sector=Technology&limit=10"

# Meta del snapshot (cuántas tienen sector / cuántas con technicalScore)
curl "https://dionee.vercel.app/api/screener?mode=combo&limit=1" | jq .meta
```

## Tests

```bash
npm test
```

## Criterios de aceptación (mode=combo&limit=10)

- comboScore presente y >0 en cada result.
- technicalScore presente.
- wyckoffPhase presente (puede ser null si chop — el campo existe).
- sector presente (string) en ≥80% de results.
- altmanZ presente en ≥70%.
- piotroski presente en ≥70%.
- debtToEquity con (LongTermDebt+ShortTermDebt)/Equity, no liab total.

## Notas

- `MAX_SYMBOLS=150` en refresh-technical es configurable via env var `TECHNICAL_MAX_SYMBOLS`.
- El cache de Finnhub tiene TTL 30 días; sectores ya cacheados no consumen API.
- Si Yahoo bloquea (raro pero pasa), los símbolos quedan con `technicalScore=null`; el snapshot fundamental sigue intacto.
