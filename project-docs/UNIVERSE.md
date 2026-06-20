# UNIVERSE

[CAMBIOS vs versión anterior: eliminado el sistema de Tiers basado en rank
(Russell 1000/2000/3000, FTSE 350, STOXX 600, etc.). Sustituido por
filtros funcionales aplicados sobre el universo EDGAR completo. El size
emerge endógeno (~6,000 filers escaneados → ~300 pasan gate). Mantenidas
las excepciones BVL Lima y la asignación de cap range por modo del Hunter.]

Define qué tickers entran al pipeline de DIONE en cualquier modo del
Hunter. NO hay tiers Russell ni listas curadas a mano: el universo es
todo filer SEC que sobrevive los filtros funcionales abajo.

---

## 1 — UNIVERSO BASE

Punto de partida: **todos los filers SEC con datos XBRL en EDGAR** (~6,000).
El cron diario (`/api/cron/refresh-gems`) los baja, los pasa por el gate
de calidad, y guarda un snapshot en Supabase. DIONE lee ese snapshot vía
`/api/screener`.

No hay "Tier 1 / Tier 2 / Tier 3" basado en market cap rank. El tier
emerge del cap range que pidas en el query.

---

## 2 — FILTROS DUROS (eliminatorios)

Todo ticker que falle uno queda fuera del snapshot, sin excepción.

| Filtro | Criterio | Razón |
|---|---|---|
| Precio | > $3 USD | Anti-penny stock |
| Volumen × Precio (ADV 30d) | > $1M USD/día | Liquidez mínima: entrás/salís con $5K sin mover el book |
| Listing venue | NYSE, NASDAQ, AMEX | No OTC, no pink sheets |
| Auditor change | NO cambios últimos 12 meses | Red flag de fraud |
| Going concern | NO qualification en último 10-K | Bankruptcy risk |
| SPAC status | Solo post-merger completed | Pre-merger = especulación pura |
| Trading status | Activo (no suspendido) | — |

---

## 3 — QUALITY GATE (funcional, cap-independiente)

Aplicado en el cron sobre el universo base. Es el corazón del filtro y
**reemplaza la jerarquía Russell**.

| Métrica | Umbral | Por qué |
|---|---|---|
| ROE TTM | > 10% | Calidad mínima de retorno sobre equity |
| FCF TTM | > 0 | Empresa genera caja, no la quema |
| debtToEquity (proxy: pasivos totales / equity) | < 2 | Solidez razonable |
| Altman Z-Score | si presente, ≥ 1.81 | No distress zone |

El gate es **deliberadamente conservador y barato**. No mide moat, no mide
crecimiento, no mide setup técnico. Su único trabajo: limpiar basura
estructural antes de que DIONE razone.

> **Falsos negativos conocidos**: el proxy de D/E rechaza injustamente
> SaaS, aseguradoras, bancos. Quedan fuera del snapshot — entran por
> `/deep TICKER` manual.

---

## 4 — SIZE EMERGE ENDÓGENO

Sobre ~6,000 filers escaneados, típicamente:
- ~1,500 tienen precio + shares limpios (priced)
- ~300 pasan el gate (gatePassers)

Esa cifra fluctúa con el régimen de earnings. No es un target.

---

## 5 — ASIGNACIÓN DE CAP RANGE POR MODO DEL HUNTER

El cap range no define qué tickers existen, define qué slice del snapshot
querés mirar:

| Modo | Cap range típico | Query |
|---|---|---|
| Fundamental puro | $500M – $200B | `capMin=500M&capMax=200B` |
| Técnico-Wyckoff puro | $300M – $50B | `capMin=300M&capMax=50B` |
| Combinado (Diamond) | $1B – $100B | `capMin=1B&capMax=100B` |
| Hidden Gems (opt-in) | $300M – $2B | `capMin=300M&capMax=2B` |

---

## 6 — EXCEPCIONES DE COBERTURA

### BVL Lima
Permitido solo en cuenta real con cap < 10% del portafolio. SCCO, BAP,
FERREYC son los líquidos. Resto: volúmenes muy bajos para entrar/salir.
**No están en el snapshot** (EDGAR no los cubre): se analizan vía `/deep`
con paste manual de fundamentales.

### ADRs y empresas extranjeras con filing SEC
Si filan 20-F en EDGAR, entran al gate como cualquier US listed. Si no
filan, quedan fuera del snapshot — vía `/deep` manual.

### Override manual
`/deep TICKER` funciona sobre cualquier ticker válido aunque no esté en
el snapshot. El universo define el scan sistemático, no el research
on-demand.

---

## 7 — LO QUE NO ENTRA (ni con override)

- Crypto-equity sin fundamentals (gestionado aparte)
- OTC, pink sheets, Level 1 ADRs
- SPACs pre-merger
- Empresas con auditor changed last 12m
- Empresas con going-concern qualification
- Tickers suspendidos

---

## 8 — EXPANSIÓN FUTURA

Si la infra escala (Fase 3+):
- Smart money cron sobre el snapshot
- Phase B del scoring técnico computado en Supabase
- Sector tagging (hoy `sector` viene null del cron)
- Cobertura de mercados no-EDGAR (UK, Europa continental, Japan) vía
  data source separado — costo no-zero, discutir antes.
