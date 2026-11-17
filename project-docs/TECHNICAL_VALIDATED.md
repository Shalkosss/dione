# TECHNICAL VALIDATED — v4 (14-nov-2026)

[CAMBIOS v4 vs v3: el score técnico deja de presentarse como predictor de retornos. Se elimina la doble vía Trend/Wyckoff, los tramos de frescura del golden cross y el componente de volumen en rupturas. Nuevo score de estado de tendencia, más simple. Reglas de entrada reducidas a dos órdenes posibles. Tabla de tasas base para calibrar expectativas. Evidencia en `BACKTEST_2026-11.md`.]

---

## 1. Qué sabemos y qué no

Tres tests propios llegaron a la misma conclusión por caminos distintos:

| Test | Resultado |
|---|---|
| Junio 2026, 30 tickers | Ninguna estrategia técnica le ganó al buy & hold. Las de tendencia redujeron el drawdown a la mitad |
| Noviembre 2026, Springs en 60 acciones | Exceso a 20 días del Spring cercano a cero. El volumen bajo en el test dio peor resultado |
| Noviembre 2026, S&P 500 point-in-time, 15 años | Rank IC de momentum, 52 semanas, RSI, golden cross y Trend Track v3 entre −0.01 y +0.03. Ninguno significativo |

Conclusión operativa: en large caps de EE. UU. el análisis técnico no elige ganadores. Sirve para tres cosas y para eso se usa en DIONE:

1. Decidir cuánto riesgo tomar (régimen de mercado).
2. Ubicar el stop y el tamaño de la posición (estructura y ATR).
3. Evitar entrar en un precio estirado (extensión sobre la SMA50).

Queda sin probar en small y mid caps, donde la literatura reporta efectos más fuertes. Hasta tener ese test, la misma regla aplica a todo el universo.

## 2. Tasas base (para no pedirle al sistema lo que el mercado no da)

Miembros del S&P 500, 2012 a 2026:

| Dato | Valor |
|---|---|
| Retorno mediano de una acción en un mes | cerca de +1% |
| Entradas que tocan un stop de 2 ATR antes de un objetivo de 2.5R (60 sesiones) | 57% a 64%, según el setup |
| Entradas que llegan primero al objetivo de 2.5R | 29% a 33% |
| Expectativa por trade con ese plan | +0.14R a +0.34R |
| Diferencia de exceso a 60 días entre el mejor y el peor tipo de entrada | menos de 0.4 puntos |

Una posición que sube 3% en su primer mes va por encima de la mediana. Juzgar una tesis de 3 a 6 meses por su primer mes es ruido. La comparación correcta es contra SPY y contra el ETF del sector en el mismo periodo, y eso lo calcula el tracker.

## 3. Régimen de mercado (cuánto riesgo)

Se evalúa al inicio de cada `/scan` y cada `/deep`:

| Condición | Lectura | Efecto sobre el satélite |
|---|---|---|
| SPY sobre SMA200 y más de 50% del universo sobre su SMA200 | Riesgo normal | Entradas a tamaño completo |
| SPY sobre SMA200 con amplitud menor a 50% | Mercado estrecho | Tamaño completo, máximo 2 entradas nuevas por semana |
| SPY bajo SMA200 | Riesgo reducido | Entradas nuevas a medio tamaño, sin promediar a la baja |

El núcleo de ETFs no se toca por régimen. Evidencia: aplicar 50% de exposición con SPY bajo SMA200 bajó el drawdown máximo de −26.9% a −18.7% y costó unos 2 puntos de CAGR.

Freno de Daniel-Moskowitz, que se mantiene: con retorno de 12 meses del mercado menor a −5% y volatilidad realizada mayor a 20%, no se abren posiciones cuyo argumento principal sea el momentum.

## 4. Score de estado de tendencia v4 (0 a 100)

Describe el estado y ordena la lista del scan. No tiene umbral de compra.

| Componente | Puntos | Regla |
|---|---|---|
| Precio sobre SMA200 | 20 | Sí = 20 |
| SMA200 con pendiente positiva (contra 20 sesiones atrás) | 15 | Sí = 15 |
| SMA50 sobre SMA200 | 10 | Sí = 10. La antigüedad del cruce no importa |
| Momentum (promedio de 12-1 y 6-1), percentil en el universo | 25 | 25 × percentil |
| Fuerza relativa a 63 días contra el ETF de su sector | 15 | Supera por más de 5 pts = 15. Supera = 10. Rezaga por menos de 5 pts = 5. Resto = 0 |
| Zona de entrada | 15 | Entre −3% y +5% de la SMA50 con RSI de 40 a 60 = 15. Hasta +10% de la SMA50 = 8. Más de +10% o RSI sobre 75 = 0. Bajo la SMA50 por más de 3% = 5 |

Etiquetas que acompañan al score:

| Etiqueta | Condición | Orden sugerida |
|---|---|---|
| EN ZONA | Sobre SMA200 y a menos de 5% de la SMA50 | Compra a mercado |
| EXTENDIDA | Más de 10% sobre la SMA50 o RSI sobre 75 | Limit en la zona de la SMA50 |
| RETROCESO | Sobre SMA200 con RSI menor a 40 | Compra a mercado. Es el único evento con algo de respaldo (exceso +0.31% a 20 días, t 2.0) |
| RECUPERANDO | Bajo SMA200 con precio sobre SMA50 | Solo con tesis fundamental fuerte, a medio tamaño |
| ROTA | Bajo SMA200 y bajo SMA50 | Sin orden. Se registra y se revisa al recuperar la SMA50 |

El cron `refresh-technical` calcula este score para todo el universo (`trendScore`, `trendLabel` y `trendBreakdown` en el snapshot; código en `lib/trendScore.js`). Agrega una sexta etiqueta, ALCISTA, para el caso que la tabla no cubre: sobre SMA200, entre +5% y +10% de la SMA50 y RSI entre 40 y 75 (sin orden sugerida propia). El campo `technicalScore` del snapshot corresponde a v3 y no se usa para decidir.

## 5. Reglas de entrada

Cada `/deep` termina en una sola orden, de uno de estos tres tipos:

1. **MARKET**: comprar en la próxima sesión. Aplica a EN ZONA y RETROCESO.
2. **LIMIT con vencimiento**: precio en la zona de la SMA50 o en el soporte por confluencia más cercano, válido 30 sesiones. Aplica a EXTENDIDA. Si no se ejecuta, el tracker la marca EXPIRADA y calcula cuánto se movió el precio sin nosotros.
3. **SIN ORDEN**: con motivo explícito y condición de reactivación.

Quedan prohibidas las entradas con varias condiciones encadenadas ("cierra sobre X con RVOL mayor a 1.5 y después retesta"). Casi nunca se cumplen completas y nadie las vigilaba.

Sobre comprar en soporte o sobre la SMA200: el test no encontró diferencia. La regla de DIONE combina las dos ideas. Se prefiere comprar el retroceso dentro de una tendencia alcista: soporte de corto plazo (SMA50, mínimo de 20 sesiones) en una acción que está sobre su SMA200. Un soporte bajo la SMA200 solo se compra si la tesis fundamental lo justifica, y a medio tamaño.

## 6. Stops, objetivos y salida por tiempo

| Elemento | Regla |
|---|---|
| Stop inicial | El más lejano entre el soporte estructural menos 0.5 ATR y 2 ATR bajo la entrada. Tope de −12% |
| Objetivo | Sale de la valuación (escenario base a 3-6 meses). No se usa la resistencia más cercana como objetivo |
| R:R mínimo | 2:1 contra el objetivo base. Subirlo no mejora la expectativa y sí bloquea entradas |
| TP1 | En +2R se vende un tercio y el stop sube a la entrada |
| Trailing | Después de TP1, bajo el último mínimo relevante o bajo la SMA50, el que quede más arriba |
| Salida por tiempo | A las 60 sesiones sin haber llegado a +1R se revisa la tesis. Si el catalizador ya pasó, se cierra |

Los stops no se mueven por cruces de la SMA200 (hallazgo de junio, se mantiene).

## 7. Indicadores

**En uso**: SMA50 y SMA200, momentum 12-1 y 6-1, fuerza relativa contra el ETF sectorial, RSI 14 (solo para medir extensión o retroceso), ATR 14, mínimos y máximos por confluencia de al menos dos referencias, volume profile si viene de Bloomberg.

**Solo descriptivos**: OBV, A/D Line, CMF, RVOL, fases y eventos Wyckoff. Aparecen en la narrativa de `/deep` y ayudan a ubicar niveles. No suman puntos ni vetan.

**Descartados**: Fibonacci aislado, Elliott, velas aisladas, Gann, MACD, estocástico, Ichimoku, líneas de tendencia a ojo, SMA200 como señal de entrada o salida, antigüedad del golden cross, volumen del día de ruptura como puntaje.

## 8. Pendiente de validar

1. Repetir el estudio de señales en un universo point-in-time de small y mid caps.
2. Probar drift post-earnings y revisiones de estimados, que son la hipótesis con mejor respaldo académico a 1-3 meses.
3. Comparar el score v4 contra el v3 con datos reales del THESIS_LOG cuando haya al menos 30 tesis cerradas.
