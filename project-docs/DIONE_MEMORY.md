# DIONE_MEMORY — Gates operativos y lecciones (v4, 14-nov-2026)

[CAMBIOS v4: se rectifica la lección de momentum, se deroga la prioridad Wyckoff en scans y se agregan las lecciones del backtest de noviembre, de la medición de los deeps y del Tandem.]

Si algo de aquí contradice a `MANDATE.md`, gana el mandato. Para endpoints gana `DATA_SOURCE.md`.

---

## 1. Gates antes de calcular cualquier indicador

1. **Frescura**: la última vela de `/api/candles` debe tener 7 días calendario o menos. Si no, parar y avisar.
2. **Deriva**: el último `adjclose` debe estar a menos de 0.2% del precio de `/api/quote`.
3. **`period2` dinámico**: `int(time.time())`. Un timestamp fijo corrompe todo en silencio (casos NUTX y TGLS).
4. **Bolsa y liquidez**: NYSE, NASDAQ o AMEX. ADV mayor a $5M para la cuenta real, $1M para papel.
5. **Market cap tras un split**: el del screener puede estar mal (caso KLAC, 10 veces). Cruzar con `/api/quote`.
6. **Vela intradía**: en horario de mercado la última vela es parcial. Excluirla de RSI, ATR y volumen.
7. **Tickers reciclados** (SNDK, SPCX): validar la fecha de inicio de las velas.
8. **TLS**: los endpoints funcionan con verificación normal. No desactivar certificados.

## 2. Lecciones de método

**Sobre backtests**

- Un backtest sobre los tickers de hoy mira el futuro. El top 20 por momentum pasó de 32.9% a 16.1% de CAGR al usar membresía histórica del índice. Todo test nuevo usa universo point-in-time o declara el sesgo en la primera línea.
- Los scripts de un backtest se guardan en el repo. Los de junio se perdieron con el sandbox.
- Con varias variantes probadas, un t de 2 aislado no alcanza. Se anota como hipótesis.

**Sobre el técnico**

- En large caps ninguna señal de precio simple ordenó los retornos entre 2012 y 2026. La afirmación anterior ("momentum 12-1 es el único predictor robusto, rho +0.115") venía de una muestra chica y queda rectificada: sin evidencia en large caps, pendiente de probar en small y mid caps.
- Las reglas de tendencia son un seguro contra drawdown con costo en retorno. Tres tests coinciden.
- Soporte contra SMA200: sin diferencia medible. Preferencia por el retroceso dentro de tendencia alcista.
- Wyckoff: los Springs no mostraron exceso a 20 días y más de la mitad pierde su mínimo antes del test. Queda como lenguaje descriptivo.
- Un filtro que combina dos scores sin correlación por encima de un umbral alto casi no deja pasar nada. Antes de agregar una condición, contar cuántos nombres sobreviven.

**Sobre el scan**

- Las variables del scan son lentas. Correrlo a diario devuelve la misma lista. Scan semanal, tracker diario.
- Los megacaps van en tablero aparte para que no tapen el descubrimiento.
- La calidad se compara dentro del sector.
- El pool de ideas se diversifica: los 33 veredictos de mayo a octubre perdieron 14 puntos contra SPY por estar concentrados en un tema.

**Sobre tesis y expectativas**

- Tesis sin registro es opinión sin medir. Se registra todo `/deep`, incluidos WATCH y AVOID.
- Una tesis de 3 a 6 meses no se juzga por su primer mes. El retorno mediano mensual de una acción ronda +1%.
- Los puntos de entrada de DIONE sí se alcanzaban (7 de 7 órdenes límite). Faltaba vigilarlos.
- Respetar el stop aportó más que el rating: mismos nombres, +0.7R por plan.
- Lección QTEX: antes de tratar una noticia como catalizador pendiente, revisar si el precio ya la descontó.
- Riesgo binario de earnings: antes del reporte el pago es adverso. Las entradas posteriores a un buen reporte son la hipótesis con mejor respaldo académico a 1-3 meses (falta probarla aquí).
- Salud: fallaba por sesgo de escala en el preScore y por comprar un sector rezagado. Ver `SECTOR_PLAYBOOK.md`.

**Sobre fundamentales**

- La rentabilidad bruta sobre activos (Novy-Marx) es mejor métrica de screener que el ROE, que se contamina con apalancamiento.
- El gate rechaza empresas con deuda nula por falta de tag, y a financieras por definición. Son límites del pre-filtro, no opiniones sobre la empresa.
- Sin flujos de caja reales no se inventa un DCF. Reverse DCF o tabla de escenarios.

**Sobre portafolio**

- Timing agresivo de factores pierde contra pesos fijos en horizontes largos. Excepción que se mantiene: el freno de Daniel-Moskowitz.
- Markowitz con pocas acciones y retornos estimados a mano amplifica el error. Sirve de diagnóstico.
- ETFs apalancados: arrastre aproximado de `(N² − 1)/2 × σ²`.

**Sobre concursos** (detalle en `TANDEM_2026_LECCIONES.md`, en el proyecto de Claude)

- Leer las reglas de la plataforma antes que el PDF.
- El benchmark define el campo de juego: cada clase de activo del benchmark es una palanca.
- En torneos por ranking el tamaño de la apuesta depende de la posición.
- Toda orden queda registrada con motivo.

## 3. Insiders

Filtrar por `transactionCode`: P es compra en mercado abierto y es señal. S es venta y solo cuenta si es discrecional. F y M son vesting y ejercicio, ruido. El grupo de varios insiders vendiendo por encima del precio actual es la señal negativa más fuerte.

## 4. Bloomberg

Dos horas al día. Usarlas en lo que no existe gratis: `INSI`, `OMON`, `SI`, `EE`, `HDS`, `HOLD`, `EVTS`, `ANR`, `FA`, `WIRP`, `WB`. Las series propietarias de Bloomberg Intelligence y los índices macro compuestos están restringidos en la licencia universitaria.

## 5. Portafolios de IA públicos

Rodrigo quiere comparar su posicionamiento con el de modelos que operan en público. Regla: una compra de esos portafolios es una idea que entra por `/quick`, igual que cualquier otra. No se replica sin tesis propia. En las pruebas públicas conocidas la mayoría de los modelos pierde contra el índice, así que sirven como fuente de ideas y de contraste, no como señal.

## 6. Arquitectura

- No construir sistemas paralelos si la infraestructura existente lo resuelve.
- Fuente única de los documentos: `project-docs/` en el repo, copiada al proyecto de Claude. Tres copias divergentes (instrucciones, proyecto, repo) fue la causa de que DIONE trabajara con un mapa viejo.
- Claude Code en local no puede leer los documentos del proyecto de Claude. Lo que deba leer tiene que estar en el repo.
