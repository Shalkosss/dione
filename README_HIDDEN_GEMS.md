# `/hidden-gems` — Screener Tier-3 para Dione v3

Hace que `/hidden-gems` exista de verdad: un cron precomputa el universo small-cap
filtrado por calidad y guarda un snapshot; `/api/screener` lo lee y rankea en <200ms.
DIONE consume ese endpoint, toma el top y corre `/deep` sobre las mejores.

## Arquitectura (y por qué)

```
Vercel Cron (1x/día)  ──► /api/cron/refresh-gems ──► FMP screener + ratios ──► scoring ──► Blob snapshot
                                                                                              │
DIONE  ── GET /api/screener?... ◄── lee + filtra + rankea (snapshot) ◄─────────────────────────┘
```

- **No se itera el universo en vivo.** 700 nombres × fetch de fundamentales = timeout
  (Hobby corta a 60s) y rate limit quemado. Por eso: precompute + snapshot.
- **Refresco rotatorio.** FMP free ~250 req/día → el cron procesa un chunk (`GEMS_CHUNK`)
  de los símbolos más viejos y completa la vuelta en pocos días. Tier 3 es mensual igual.
- **División de trabajo.** El screener da gate + pre-score barato (rankear). El composite
  completo (Beneish, Piotroski-9, Graham, 7 Powers, DCF) lo hace DIONE en `/deep` sobre el
  shortlist. No tiene sentido computar Beneish para 2,000 nombres.

## Archivos (dropear en el repo, misma raíz que `api/quote/[ticker].js`)

```
api/screener.js            ← endpoint que llama /hidden-gems
api/cron/refresh-gems.js   ← cron precompute (GET, protegido por CRON_SECRET)
lib/fmp.js                 ← cliente FMP (screener + ratios) + concurrency limiter
lib/scoring.js             ← quality gate + pre-score (puro, testeable)
lib/store.js               ← snapshot en Vercel Blob
vercel.json                ← cron diario + maxDuration (mergealo con tu vercel.json)
```

> Si tu repo usa `import`, ya está en ESM. Si usás CommonJS, agregá `"type":"module"`
> en `package.json` o convertí los `import/export` a `require/module.exports`.

## Setup (10 min)

1. `npm i @vercel/blob`
2. En Vercel → Storage → **crear un Blob store** y conectarlo al proyecto. Esto inyecta
   `BLOB_READ_WRITE_TOKEN` automáticamente.
3. Variables de entorno (Project → Settings → Environment Variables):

   | Var | Valor | Nota |
   |---|---|---|
   | `FMP_API_KEY` | tu key de Financial Modeling Prep | gate/score necesita fundamentales |
   | `CRON_SECRET` | string random largo | Vercel lo manda como `Bearer` al cron |
   | `GEMS_CHUNK` | `200` | tickers por corrida (subí con plan pago) |
   | `GEMS_CONCURRENCY` | `5` | requests paralelos a FMP |
   | `GEMS_USE_SCORE` | `0` | `1` para enriquecer con Altman/Piotroski (+1 call/ticker) |

4. (Opcional pero recomendado) Activá **Fluid Compute** en Settings → Functions, y subí
   `maxDuration` del cron a `300` en `vercel.json`. Permite chunks más grandes.
5. Deploy. El cron queda registrado solo.
6. **Verificá los nombres de campo de FMP** (varían por versión/plan): la primera vez,
   abrí los logs del cron o pegá en el navegador
   `https://financialmodelingprep.com/api/v3/ratios-ttm/AAPL?apikey=TU_KEY`
   y confirmá que existen `returnOnEquityTTM`, `debtEquityRatioTTM`,
   `freeCashFlowPerShareTTM`. Si cambian, ajustá las claves en `lib/fmp.js` (`pick(...)`).

## Disparo manual (antes del primer cron)

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" \
  https://dionee.vercel.app/api/cron/refresh-gems
# → { ok:true, totalTracked, refreshedThisRun, passingThisRun, ... }
```

Repetí unas veces (o esperá unos días de cron) hasta que `totalTracked` cubra el universo.

## Consumir

```bash
curl "https://dionee.vercel.app/api/screener?capMin=300000000&capMax=2000000000&minScore=60&limit=25"
```

Respuesta: `{ meta, results:[{ symbol, name, sector, marketCap, preScore, gatePass, metrics:{...} }] }`.

## Snippet para las instrucciones del Project (que DIONE lo use)

Pegá esto en el campo de instrucciones, sección DATA SOURCE:

```
/api/screener  — Hidden Gems Tier-3 (precomputado, snapshot diario)
  GET /api/screener?capMin=&capMax=&minScore=&sector=&sort=&limit=
  Devuelve small caps ($300M–$2B) que pasan el quality gate (ROE>10%, FCF+, D/E<2)
  rankeadas por pre-score. Para /hidden-gems: llamar este endpoint, tomar el top,
  y correr /deep sobre las 2-3 de mayor pre-score (ahí aplicar Beneish, Piotroski-9,
  Graham, 7 Powers, DCF, Wyckoff con /api/candles). El pre-score NO es el composite
  final: es solo para rankear el shortlist.
```

## Free vs pago (decisión tuya)

| | FMP Free | FMP pago + bulk |
|---|---|---|
| Universo/corrida | chunk ~200, vuelta completa en ~2-4 días | todo en 1 corrida |
| Llamadas | ratios-ttm por ticker | `ratios-ttm-bulk` (1 call = mercado entero) |
| Costo | $0 | ~USD 20-30/mes |
| Snapshot | "rolling" (mezcla días) | foto fresca diaria |

Como PM: con $5k reales, el free rotatorio alcanza para un scan mensual de Tier 3.
Si el paper de $1M te justifica sofisticación, el plan bulk hace todo más limpio —
reescribís `fetchFundamentals` para que lea del bulk y subís `GEMS_CHUNK` al tamaño del universo.

## Límites que NO te puedo ocultar

- **Cron Hobby = 1x/día** y dispara en cualquier minuto de la hora elegida. Para refresco
  intradía necesitás Pro o un cron externo (cron-job.org) pegándole al endpoint.
- **Sin retries** en cron de Vercel: si una corrida falla, espera al día siguiente. El chunk
  rotatorio mitiga esto (no perdés todo, solo ese chunk).
- El gate usa **FCF TTM** como proxy de "FCF+ en los 4 últimos Q". El chequeo Q-a-Q exacto
  necesita el cashflow trimestral → lo valido en `/deep`.
