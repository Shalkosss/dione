# HUNTER MODES — v4.1 (14-nov-2026)

[CAMBIOS v4.1 vs v4: el scan ya no se limita a 3 sectores. Busca en los 11 con tope de 3 nombres por sector, y la vista sectorial pasa a expresarse con ETFs. Se agrega la regla de diversidad del pool y el scan por eventos como hipótesis en prueba. Motivo en `DEEPS_BACKFILL_2026-11.md`.]

[CAMBIOS v4 vs v3: el fundamental filtra y el técnico ordena. Se elimina el umbral doble del Diamond. Megacaps en tablero aparte. Cadencia semanal. Evidencia en `BACKTEST_2026-11.md`.]

---

## 1. Por qué cambió

1. preScore y technicalScore no están correlacionados (Spearman −0.02). Pedir los dos altos dejaba unos 8 nombres de 6,356.
2. Ningún score técnico probado predice retornos en large caps. Usarlo de compuerta descarta nombres sin base.
3. Las variables del scan son lentas. Correrlo a diario devuelve la misma lista. La tarea diaria es el `/tracker`.
4. Los 33 veredictos de mayo a octubre rindieron 14 puntos menos que SPY sin importar el rating, porque el pool estaba concentrado en tecnología y beta alta. El mayor riesgo medido de DIONE es la concentración temática de las ideas.
5. La cartera limitada a los 3 sectores con mejor momentum tuvo peor Sharpe (0.63) que la que reparte con tope por sector (0.71) y más drawdown.

## 2. `/scan`

Cadencia semanal, o cuando cambie la vista de `/macro`.

**Paso 0. Régimen.** Una línea: SPY contra su SMA200, porcentaje del universo sobre su SMA200, VIX. Define el tamaño de las entradas (`TECHNICAL_VALIDATED.md`, sección 3).

**Paso 1. Tablero sectorial.** Los 11 sectores GICS con retorno a 1, 3, 6 y 12 meses de su ETF y la vista vigente de `/macro` (3 sobreponderados, 2 infraponderados). La vista sectorial decide qué ETFs van en el núcleo táctico del `MANDATE.md`. En el scan de acciones funciona como desempate y nunca como filtro.

**Paso 2. Descubrimiento en los 11 sectores.**

1. `GET /api/screener?mode=fundamental&limit=100`. Mientras `gicsSector` venga `null` en parte del snapshot, completar con el campo `sector`.
2. Filtro: pasar el gate, capitalización entre $2B y $200B, ADV mayor a $5M.
3. Calidad relativa: mitad superior del preScore dentro de su sector.
4. Score de estado de tendencia v4 calculado desde `/api/candles`.
5. Salida: 12 nombres, máximo 3 por sector, ordenados por score. A igualdad, primero los de sectores sobreponderados. Cada uno con etiqueta de tendencia, orden sugerida y marca de novedad.

**Paso 3. Tablero de megacaps.** Las ~35 empresas de más de $200B, pasen o no el gate: etiqueta de tendencia, distancia a la SMA50, fuerza relativa contra SPY a 63 días y cambio respecto al scan anterior.

**Paso 4. Propuesta para `/deep`.** Máximo 3 nombres, de sectores distintos, con el motivo.

### Regla de diversidad del pool

No más del 40% de las tesis vivas (`SIN_ORDEN`, `ARMADA`, `ABIERTA`) en un mismo sector o tema. Si Rodrigo pide un `/deep` que rompe ese tope, DIONE lo hace y lo avisa en la primera línea. "Tema" incluye cadenas que cruzan sectores: IA y data centers agrupa semiconductores, memoria, energía para data centers y neoclouds.

### Marcas de novedad

| Marca | Significado |
|---|---|
| NUEVO | No estaba en el scan anterior |
| SUBE / BAJA | Cambió 3 o más puestos |
| EN LOG | Tiene tesis activa. Se lista al pie con su estado |

Un nombre con `/deep` en los últimos 30 días y sin cambio de etiqueta no vuelve a proponerse.

### Parámetros

| Parámetro | Efecto |
|---|---|
| `sector=XLV` | Un solo sector, 10 nombres |
| `cap=small` | Rango $300M a $2B, ADV mayor a $1M |
| `limit=N` | Tamaño de la lista |

## 3. `/scan-eventos` (hipótesis en prueba, solo papel)

El scan por niveles devuelve siempre lo mismo porque mira variables lentas. Un scan por eventos devuelve nombres nuevos cada día porque lo dispara algo que ocurrió.

Disparador: empresa que reportó en las últimas 5 sesiones y cumple las tres condiciones:

1. Sorpresa positiva en la métrica que el mercado venía castigando.
2. Guía al alza o reafirmada por encima del consenso.
3. Reacción de precio que se sostiene: cierre del día 1 en el tercio superior de su rango y sin perder el mínimo de ese día en las sesiones siguientes.

Fuente de fechas y documentos: 8-K ítem 2.02 en SEC EDGAR, sin key. DIONE lee el comunicado y clasifica. Entrada preferida en el primer retroceso posterior al reporte, nunca antes del reporte.

Respaldo: el drift post-earnings es la anomalía mejor documentada a 1-3 meses, y es el patrón que ya funcionó en los concursos (beat con guía al alza funcionó, beat con guía cauta no). Falta el test propio con universo point-in-time. Hasta tenerlo, las ideas de este modo van al log marcadas `thesis_mode: "eventos"` y solo en papel. Con 30 registros se decide si pasa a ser el scan principal.

## 4. Otros modos

| Modo | Uso | Estado |
|---|---|---|
| `/scan-fundamental` | Ranking por calidad para el núcleo de 12-24 meses | Funciona con el snapshot |
| `/scan-pullback` | Etiquetas RETROCESO y EN ZONA en todos los sectores, máximo 3 por sector | DIONE lo calcula |
| `/scan-divergence` | Calidad alta en su sector con etiqueta ROTA o RECUPERANDO. Va a `SIN_ORDEN` | DIONE lo calcula |
| `/megacaps` | Solo el tablero del paso 3 | DIONE lo calcula |
| `/scan-short` | Ver `SHORT_FRAMEWORK.md`. Solo papel | Manual |

Se retiran `/scan-technical`, los niveles Diamond, Wait y Trader Play, y la prioridad de fases Wyckoff en scans.

## 5. Qué decide cada capa

| Capa | Decide | Herramienta |
|---|---|---|
| Régimen | Cuánto riesgo | SPY contra SMA200, amplitud |
| Sector | Qué ETFs van en el núcleo táctico. Desempate en el scan | Vista de `/macro`, registrada |
| Gate y calidad relativa | Qué queda fuera | Snapshot fundamental |
| Estado de tendencia | En qué orden mirar y qué tipo de orden | Score v4 |
| `/deep` | Tesis, objetivo, orden con stop | Valuación, adversarial, pre-mortem |
| `/tracker` | Si lo anterior funcionó | THESIS_LOG |

## 6. Backend

Crons, ventana 09:00-11:00 UTC y schema en `DATA_SOURCE.md`. Los campos `technicalScore`, `comboScore`, `wyckoffPhase` y `borderline` del snapshot son v3 y no deciden.
