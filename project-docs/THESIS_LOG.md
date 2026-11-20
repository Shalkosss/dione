# THESIS LOG — v2 con tracker de entradas (14-nov-2026)

[CAMBIOS v2: se registra TODO `/deep`, también los que terminan en WATCH o AVOID. Cada tesis tiene una orden con vencimiento y pasa por una máquina de estados. Nuevas métricas de eficiencia de los deeps. Reglas de vigencia. Schema JSON compatible con `src/lib/thesis.js`.]

Este archivo es el instrumento de medición de DIONE. Sin él no se puede saber si el análisis agrega algo sobre comprar SPY.

---

## 1. Qué se registra

Todo `/deep` y todo `/quick` que termine con un rating. La regla anterior ("no se loguean ideas sin entrada real") queda derogada, porque dejaba sin medir justo lo que más importa: qué pasó con las acciones que DIONE dijo que no compraras o que esperaras.

Cada registro corre en modo papel aunque no haya dinero real. La cuenta real es un subconjunto marcado con `account: "real"`.

## 2. Estados

| Estado | Significado | Cómo se sale |
|---|---|---|
| `SIN_ORDEN` | Rating WATCH o AVOID. Se sigue el precio para medir el costo de no entrar | Nueva revisión que emita orden, o cierre de medición a 120 sesiones |
| `ARMADA` | Hay una orden LIMIT esperando | Precio toca el limit → `ABIERTA`. Vence → `EXPIRADA`. Precio pierde el stop antes de ejecutarse → `INVALIDADA` |
| `ABIERTA` | Orden ejecutada (MARKET al cierre de emisión o LIMIT tocado) | Stop, objetivo, tiempo o tesis |
| `CERRADA_TP` | Llegó al objetivo base | Final |
| `CERRADA_STOP` | Tocó el stop | Final. Post-mortem obligatorio |
| `CERRADA_TIEMPO` | 60 sesiones sin llegar a +1R y se decidió cerrar | Final |
| `CERRADA_TESIS` | Se cumplió la invalidación fundamental | Final. Post-mortem obligatorio |
| `EXPIRADA` | El LIMIT no se ejecutó en 30 sesiones | Final. Se anota el retorno perdido |
| `INVALIDADA` | El precio rompió el nivel de stop antes de ejecutar | Final |

## 3. Reglas de vigencia (banderas `REVISAR`)

El tracker revisa cada tesis en `SIN_ORDEN`, `ARMADA` o `ABIERTA` todos los días y levanta bandera si se cumple alguna:

1. La empresa reportó earnings después de la fecha de emisión.
2. El régimen de mercado cambió respecto al registrado (SPY cruzó su SMA200).
3. El sector dejó de estar en la lista de sobreponderados de `/macro`.
4. Tesis `ARMADA` con el precio a más de 15% del limit.
5. Tesis `ABIERTA` con más de 60 sesiones sin llegar a +1R.
6. Cualquier tesis con más de 90 días calendario sin revisión.

Una tesis con bandera no se opera hasta rehacer el `/quick` o el `/deep`. El reporte dice qué bandera saltó y desde cuándo.

## 4. Bloque que emite cada `/deep`

```json
{
  "schema": "dione-thesis-v2",
  "id": "MU-2026-11-14",
  "ticker": "MU",
  "entry_date": "2026-11-14",
  "account": "paper",
  "rating": "BUY",
  "conviction": 4,
  "thesis_mode": "scan-v4",
  "sector": "Information Technology",
  "sector_etf": "SMH",
  "cap": "mega",
  "ref_price": 778.31,
  "spy_ref": 754.37,
  "order_type": "LIMIT",
  "entry": 720.00,
  "valid_until": "2026-12-29",
  "stop": 655.00,
  "tp1": 850.00,
  "target_3m": 900.00,
  "target_12m": 1050.00,
  "size_pct": 6,
  "time_stop": "2027-02-10",
  "status": "ARMADA",
  "trend_label": "EXTENDIDA",
  "regime": "SPY>SMA200",
  "sector_view": "OW",
  "next_earnings": "2026-12-17",
  "er_bear": -0.25, "er_base": 0.18, "er_bull": 0.45,
  "p_bear": 0.25, "p_base": 0.50, "p_bull": 0.25,
  "invalidation": "cierre semanal bajo 655 + guidance de DRAM a la baja",
  "thesis_text": "una frase"
}
```

Los valores del ejemplo son ilustrativos y no constituyen una tesis vigente. Notas de formato:

- `entry` es el precio de la orden. En MARKET coincide con `ref_price`. En `SIN_ORDEN` va el precio al que DIONE entraría si cambiara de opinión, o `null`.
- `ref_price` y `spy_ref` son los cierres del día de emisión y permiten calcular el alfa aunque la orden nunca se ejecute.
- `theme` es opcional: texto o lista con el tema que cruza sectores (por ejemplo `"IA y data centers"`). La web lo usa, junto con `sector`, para la regla de diversidad del pool (no más del 40% de las tesis vivas en un mismo sector o tema).
- `conviction` de 1 a 5. Los campos `ticker`, `entry`, `stop`, `target_3m`, `target_12m`, `conviction`, `invalidation`, `thesis_text`, `er_*` ya los lee el parser de la web.

**Persistencia**: en una sesión con acceso de escritura al proyecto, DIONE agrega la entrada a este archivo al terminar el `/deep`, sin que se lo pidan, y lo dice en una línea. Desde Claude Code, el skill `deep` guarda el bloque en `research/theses/` y lo sube solo con `npm run thesis:import` (valida en local antes de mandar; `--check` solo valida). La página Thesis ya no importa ni exporta (20-nov-2026): un `/deep` hecho en otro lado se guarda como archivo y se sube con el mismo comando. Cuando exista la tabla `theses` con su cron (ver `ROADMAP_CLAUDE_CODE.md`), la web pasa a ser la fuente y este archivo queda como espejo legible.

## 5. Comando `/tracker`

DIONE lee este archivo, pide `/api/quote` y `/api/candles` de cada tesis no finalizada, aplica la máquina de estados con máximos y mínimos diarios desde la última revisión y devuelve:

1. Tabla de tesis con estado, precio actual, distancia a la entrada, al stop y al objetivo, días transcurridos y banderas.
2. Cambios de estado detectados desde la última corrida.
3. Lista de tesis que hay que revisar.
4. Métricas agregadas si hay al menos 10 registros.

Después actualiza este archivo.

## 6. Métricas de eficiencia de los deeps

| Métrica | Pregunta que responde |
|---|---|
| Tasa de ejecución de órdenes LIMIT | ¿Los puntos de entrada de DIONE se alcanzan? |
| Días medianos hasta ejecutar | ¿Cuánto hay que esperar? |
| Retorno perdido en `EXPIRADA` | ¿Cuánto costó esperar un precio que no llegó? |
| Alfa a 20, 60 y 120 sesiones contra SPY y contra el ETF del sector, medido desde `ref_price` | ¿El análisis elige mejor que el índice, sin importar el timing? |
| Alfa por rating (BUY, WATCH, AVOID) | ¿Los BUY rinden más que los WATCH? Si no, el rating no informa |
| Alfa por convicción | ¿La convicción 5 rinde más que la 3? |
| Tasa de acierto, R promedio y expectativa de las `ABIERTA` cerradas | ¿El plan de trade funciona? |
| Alfa por sector y por vista sectorial (OW o no) | ¿La vista sectorial agrega? |
| Alfa por etiqueta de tendencia al emitir | ¿Importa el estado técnico de entrada? |

Umbrales de decisión:

- Con 30 registros: primera lectura. Si el alfa de los BUY a 60 sesiones no supera al de los WATCH, se revisa el criterio de rating.
- Con 30 tesis cerradas y alfa positivo neto: el satélite puede subir de tamaño (ver `MANDATE.md`).
- Si la tasa de ejecución de LIMIT es menor a 40%: los limits están demasiado lejos y se acercan a la zona de la SMA50.

## 7. Post-mortem

Obligatorio en `CERRADA_STOP` y `CERRADA_TESIS`. Tres líneas: qué supuesto falló, si era detectable al emitir, qué cambia en el sistema.

---

## ENTRADAS

Ninguna registrada bajo v4 al 16-nov-2026. La medición de los 33 veredictos de mayo a octubre de 2026 está en `DEEPS_BACKFILL_2026-11.md` y sirve de línea base.
