# WATCHLIST — Tesis activas + cantera dinámica (reestructurado)

> CAMBIO DE CONCEPTO: el watchlist ya NO es una lista escrita a mano. Una lista
> manual siempre refleja el círculo conocido (sesgo #2 y #3 del MANDATE). Ahora
> tiene dos capas: lo que seguís de verdad (tesis activas) y lo que descubre el
> Hunter (la cantera, alimentada por el snapshot de gems, NO por vos).

---

## REGLA MADRE

Un nombre entra a "Tesis Activas" SOLO por:
- (a) un hit del Hunter (gems snapshot / scan técnico), o
- (b) un `/deep` deliberado que generó convicción.

**Nunca por costumbre.** Si no podés escribir una tesis 1-3-1 con invalidación, no entra.

---

## CAPA 1 — TESIS ACTIVAS (máx 8-10; rota sola)

Solo lo que tenés en cartera o tiene tesis viva con invalidación. Sale automáticamente
cuando: stop ejecutado, target alcanzado, tesis invalidada, o aparece algo mejor.

### ALLY — Ally Financial · LONG · Conviction 4/5 · BUY (entrada condicional)
- Sector: Financials (auto + banco digital). Cap ~$13B.
- Tesis: banco a ~1.04× tangible book con ROTCE inflexionando 11%→mid-teens; Buffett 9.4% estable.
- Entrada: breakout squeeze >$44.50 (RVOL>1.5) o pullback $40.50-41. Stop $39.50.
- Targets: $47 (3m) / $52 (12m). Invalidación: <$39.50 sem + charge-offs >2.0% + NIM <3.50%.
- Riesgo macro: régimen reflation-shock = consumidor exprimido → vigilar empleo + autos usados.

### NOW — ServiceNow · LONG · Conviction 3/5 · WATCH (no perseguir)
- Sector: Tech (SaaS). Cap ~$130B. **Split 5:1 en 2025; cayó −62% en la SaaSpocalypse.**
- Tesis: compounder elite repriceado de ~20× a ~8× ventas; Q1'26 refuta la tesis de disrupción-IA.
- NO entrar acá (rebote +67%, RSI 79, Fase A). Esperar ST a $100-110 o reclaim SMA200 c/ volumen.
- Targets: $145 (3m) / $158 (12m). Invalidación: <$81 sem + subs <15% cc.

### MELI — MercadoLibre · (re-verificar)
- Pendiente: el bias del archivo viejo asumía precios desactualizados. Correr `/quote MELI`
  y `/deep MELI` para confirmar tesis y niveles antes de tratarla como activa.

---

## CAPA 2 — LA CANTERA (NO se escribe a mano)

Esto se llena del **snapshot de gems** (cron diario, ~6,000 filers EDGAR) y, cuando
exista, del **snapshot técnico** (Fase 2). El usuario pega el JSON; DIONE rankea,
corre `/deep` sobre el top, y promueve los ganadores a Capa 1.

**Workflow semanal (lunes):**
1. Usuario pega `[DIONE GEMS JSON]` (o DIONE llama `/api/screener`).
2. DIONE toma top 5-10 por preScore → recalcula Altman/Piotroski/Beneish/sector.
3. `/deep` sobre los 2-3 mejores.
4. Los que pasan → suben a Tesis Activas con 1-3-1.
5. Los que no → se descartan (no se acumulan en una lista).

La cantera NO se guarda como lista fija. Es un flujo: entra del snapshot, sale a tesis
o a la basura. Así nunca se vuelve "los mismos nombres".

---

## BENCHMARK / REFERENCIA (NO son targets del Hunter)

Estos NO se escanean ni entran a tesis por estar acá. Son contexto/benchmark:
- Megacaps conocidos: AAPL, MSFT, NVDA, GOOG, AMZN, META, TSLA — referencia, no target.
- ETFs core (construcción de portafolio, no Hunter): VOO, VT, VWO, EWZ, ILF, AGG, GLD.
- ETFs sectoriales (táctico por Macro Atlas): XLE, XLF, XLK, XLV, SMH, KWEB, etc.

> SNDK queda como nota educativa (el multi-bagger que se perdió), NO como target.

---

## REGLAS

1. Máx 8-10 en Tesis Activas. Más es ruido.
2. Toda tesis activa tiene 1-3-1 con invalidación cuantitativa explícita.
3. Re-evaluación quincenal: ¿sigue válida? ¿hay algo mejor en la cantera?
4. Salida automática al invalidarse. No "hold and hope".
5. El descubrimiento viene del snapshot, no de tu memoria.
