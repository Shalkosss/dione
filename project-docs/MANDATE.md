# MANDATE — v4 (14-nov-2026)

[CAMBIOS v4: estructura núcleo-satélite con un tramo táctico de ETFs sectoriales. El tamaño de cada posición sale de un presupuesto de riesgo y deja de salir de Markowitz. Se levantan las exclusiones de salud, megacaps y financieras (cada una con su regla en `SECTOR_PLAYBOOK.md`). R:R mínimo unificado en 2:1. Regla de earnings acotada. El satélite crece solo si el THESIS_LOG demuestra alfa. Este archivo manda sobre cualquier otra fuente en reglas de inversión, incluida la memoria.]

---

## 1. Cuentas

| Cuenta | Monto | Uso |
|---|---|---|
| Real | USD 5,000 | Error irreversible pesa más que oportunidad perdida |
| Papel / competencias | USD 1,000,000 nocional | Laboratorio. Toda tesis de DIONE corre aquí aunque no entre a la real |

Las reglas de cada concurso (benchmark, universo, lock-ups, métrica de ranking) mandan sobre este mandato dentro del concurso. Primer paso siempre: leer las reglas de la plataforma (lección Tandem).

## 2. Estructura de la cuenta real

| Tramo | Peso | Contenido | Función |
|---|---|---|---|
| Núcleo estratégico | 35% a 45% | VOO o VT, opcional QQQ | Capturar el retorno del mercado mientras el satélite espera |
| Núcleo táctico | 10% a 20% | 1 a 3 ETFs de los sectores sobreponderados en `/macro` | Expresar la vista sectorial sin depender de elegir la acción correcta |
| Satélite | 25% a 40% | 4 a 8 acciones con tesis en el log | Buscar alfa de selección |
| Liquidez | 5% a 10% | Efectivo o SHY/BIL | Munición para órdenes LIMIT |

Razones:

1. El backtest no encontró ventaja de selección técnica en large caps. Hasta que el log demuestre que `/deep` la tiene, la mayor parte del capital debe estar en el mercado y no esperando un setup.
2. La vista sectorial fue lo que funcionó en los concursos. Un ETF sectorial la captura completa.
3. Sobre el 60/40: a los 21 años, con horizonte de décadas y aportes futuros, la renta fija cumple papel de liquidez y no de motor de retorno. Por eso el tramo de bonos se limita a la liquidez. Esto cambia si el capital pasa a ser necesario en menos de 3 años.

**Regla de crecimiento del satélite**: tope de 40% hasta que el THESIS_LOG tenga 30 tesis cerradas con alfa neto positivo contra SPY. Cumplido eso, el tope sube a 60% y el núcleo táctico puede bajar a 10%.

## 3. Tamaño de posición

Presupuesto de riesgo por posición: 1% de la cuenta (USD 50 con la cuenta actual).

```
tamaño = riesgo por posición / distancia porcentual al stop
```

Ejemplo: stop a 10% de la entrada → posición de USD 500 (10% de la cuenta).

| Límite | Real | Papel |
|---|---|---|
| Máximo por acción, contando lo que ya trae el núcleo | 15% | 25% |
| Convicción 3 | medio presupuesto (0.5%) | 3% a 5% |
| Convicción 4 | presupuesto completo | 8% a 15% |
| Convicción 5 | 1.25% de riesgo | 15% a 25% |
| Régimen de riesgo reducido (SPY bajo SMA200) | mitad de lo anterior | igual |
| Máximo por sector GICS, núcleo táctico incluido | 35% | según concurso |
| Opciones | 5% del capital, solo riesgo definido | libre |

Markowitz y Black-Litterman de la web quedan como diagnóstico: concentración, contribución marginal al riesgo, correlaciones. No fijan los pesos. Con 4 a 8 acciones y retornos esperados estimados a mano, la optimización media-varianza amplifica el error de estimación (DeMiguel, Garlappi y Uppal, 2009, muestran que 1/N le gana fuera de muestra).

## 4. Universo permitido

| Tema | Regla v4 |
|---|---|
| Capitalización | Piso por liquidez: ADV mayor a $5M en real. Sin techo |
| Megacaps (más de $200B) | Permitidos. Entran por el tablero de megacaps, y solo si la tesis dice por qué tenerlos por encima del peso que ya dan VOO o QQQ |
| Salud | Permitido con valuación por sub-industria. Fuera de la cuenta real: biotech sin ingresos y eventos binarios (FDA) a menos de 60 días |
| Financieras | Permitidas con métricas propias (P/TBV, ROTCE, CET1). No pasan por el gate de D/E |
| FCF positivo | Se mantiene como requisito en real, salvo financieras y REITs, que usan su métrica equivalente |
| Excluidos | OTC, acciones bajo $3, SPAC sin fusión cerrada, cambio de auditor en 12 meses, going concern, cripto |
| Shorts direccionales | Solo papel. En real, put spreads |
| Perú (BVL) | Máximo 10% |

## 5. Horizonte y reglas de operación

| Regla | Valor |
|---|---|
| Horizonte del satélite | 3 a 6 meses. Estratégico de 12 a 24 meses en el núcleo |
| Operaciones de menos de 3 semanas | Fuera del mandato |
| R:R mínimo | 2:1 contra el objetivo base de valuación |
| Stop | Definido al entrar. Entre −7% y −12% según ATR y estructura |
| Earnings | Sin posiciones nuevas a tamaño completo en las 3 sesiones previas. Medio tamaño si la tesis no depende del reporte |
| Entradas por semana | Máximo 2 nuevas en real |
| Revisión por tiempo | 60 sesiones sin +1R |
| Salidas | Stop, invalidación de tesis, objetivo, tiempo, o una idea mejor con el satélite lleno |

## 6. Rebalanceo

- Núcleo estratégico: una vez por trimestre o si se desvía más de 5 puntos.
- Núcleo táctico: cuando cambia la lista de sectores sobreponderados en `/macro`. Como mucho una vez al mes.
- Satélite: lo gobiernan el tracker y las reglas de salida.

## 7. Sesgos que DIONE debe señalar

Sesgo local hacia Perú y LatAm. Concentración en nombres conocidos. Anclaje a tickers populares. Tesis apoyadas en noticias de menos de 30 días. Buscar solo confirmación. FOMO en momentum tardío. Aversión a realizar pérdidas. Vender ganadores pronto y aguantar perdedores. Se agrega uno: juzgar una tesis de 3 a 6 meses por su primer mes.

## 8. Medición

- `/tracker` diario (automático cuando la web lo soporte).
- Mensual: alfa de la cuenta real contra SPY y contra el benchmark 100% núcleo. Si el satélite resta, se dice sin suavizar.
- Trimestral: revisión de este mandato con las métricas del log.

## 9. Escalas de capital

- Hasta USD 25,000: esta estructura.
- USD 25,000 a 100,000: coberturas con opciones, hasta 12 posiciones en el satélite.
- Más de USD 100,000: revisar todo el mandato.
