# COMMANDS — v4.1 (14-nov-2026)

Reemplaza a `COMMANDS_status.md` y a la versión anterior del repo. Estados: AUTO (DIONE lo corre con los endpoints), CALC (DIONE lo calcula desde candles hasta que el backend lo traiga), BBG (mejora con data pegada de Bloomberg), WEB (vive en la app).

## Rutina

| Cuándo | Qué |
|---|---|
| Diario, 5 minutos | `/tracker` |
| Semanal | `/macro` si tiene más de 14 días, luego `/scan` |
| En temporada de resultados | `/scan-eventos` (papel) |
| Por candidato | `/deep TICKER` (se registra solo) |
| Mensual | `/performance` y `/portfolio` |

## Descubrimiento

| Comando | Qué hace | Estado |
|---|---|---|
| `/scan [sector=XLV] [cap=small] [limit=N]` | Régimen, tablero sectorial, 12 candidatos de los 11 sectores con máximo 3 por sector, tablero de megacaps, hasta 3 propuestas para `/deep` de sectores distintos | AUTO + CALC |
| `/scan-eventos` | Reportes de los últimos 5 días con sorpresa positiva, guía al alza y precio que se sostiene. Hipótesis en prueba, solo papel | CALC (EDGAR 8-K + candles) |
| `/scan-pullback` | Etiquetas RETROCESO y EN ZONA, máximo 3 por sector | CALC |
| `/scan-fundamental` | Ranking por calidad para el núcleo de largo plazo | AUTO |
| `/scan-divergence` | Calidad alta dentro de su sector con tendencia rota. Va a `SIN_ORDEN` | CALC |
| `/megacaps` | Tablero de las ~35 empresas de más de $200B | CALC |
| `/scan-short` | Candidatos a short, solo papel | Manual |

`/scan-combo`, `/scan-technical` y `/hidden-gems` quedan como alias de `/scan` (`/hidden-gems` equivale a `/scan cap=small`).

## Análisis

| Comando | Qué hace | Estado |
|---|---|---|
| `/deep TICKER` | Formato completo de `INSTRUCTIONS.md`. Termina en ORDEN con stop y registro en el log | AUTO, BBG |
| `/quick TICKER` | Versión corta con orden y registro | AUTO |
| `/bull TICKER`, `/bear TICKER` | Un lado del adversarial | AUTO |
| `/valuation TICKER` | Reverse DCF, escenarios, múltiplos | AUTO, BBG |
| `/short TICKER`, `/distribution TICKER` | Tesis bajista, solo papel | AUTO |
| `/smart-money [TICKER]` | `/api/smart-money`. 13F y dark pool por Bloomberg | AUTO, BBG |
| `/catalysts [TICKER]` | Calendario de 12 semanas | AUTO, BBG |

## Seguimiento

| Comando | Qué hace | Estado |
|---|---|---|
| `/tracker` | Actualiza el estado de cada tesis, marca órdenes límite ejecutadas, levanta banderas de vigencia, avisa si el pool supera 40% en un sector o tema | CALC hasta la Fase 1 de la web |
| `/log-thesis TICKER` | Registra a mano una tesis ya discutida. Normalmente no hace falta | AUTO con escritura al proyecto |
| `/review TICKER` | Rehace el veredicto de una tesis con bandera `REVISAR` | AUTO |
| `/performance` | Métricas de eficiencia de los deeps. Línea base: `DEEPS_BACKFILL_2026-11.md` | CALC |
| `/portfolio` | Cuenta real contra SPY, pesos por sector contra el índice, estructura núcleo-satélite, límites | Requiere que Rodrigo pegue posiciones hasta la Fase 2 |
| `/ai-compare` | Posiciones de portafolios de IA públicos contra las propias | Pendiente de definir la fuente |

## Macro

| Comando | Qué hace | Estado |
|---|---|---|
| `/macro` | Régimen, curva, inflación, Fed, sentimiento. Termina con 3 sectores sobreponderados y 2 infraponderados, con fecha. Esa vista define los ETFs del núcleo táctico | AUTO (web), BBG |
| `/sector-atlas`, `/sector NOMBRE` | Mapa sectorial con fuerza relativa | CALC, BBG |
| `/news` | Noticias que afectan a tesis activas | AUTO |

## Utilidades

`/glossary`, `/explain`, `/help`, `/conclave TEMA`.

## Si algo falla

| Síntoma | Causa probable | Qué mirar |
|---|---|---|
| Scores técnicos del snapshot en `null` | Ventana 09:00-11:00 UTC o cron caído | `/api/healthz` |
| `gicsSector` `null` | Limitación conocida (42% de los nombres) | Usar el campo `sector` |
| Megacap ausente del snapshot | No pasa el gate o falta data | Calcular desde `/api/quote` y `/api/candles` |
| `/api/quote` devuelve ceros | Ticker inexistente o key caída | Probar con AAPL, o usar Yahoo chart v8 directo |
