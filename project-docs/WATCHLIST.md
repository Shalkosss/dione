# WATCHLIST — v4.1 (14-nov-2026)

[CAMBIOS: las tres tesis de junio (ALLY, NOW, MELI) se archivan porque tenían cinco meses sin revisión. La watchlist deja de mantenerse a mano y pasa a ser una vista del `THESIS_LOG.md`. El scan busca en todos los sectores.]

## Regla

Un nombre está en la watchlist si tiene una tesis en estado `SIN_ORDEN`, `ARMADA` o `ABIERTA` en el log. No hay otra forma de entrar. Sale cuando la tesis llega a un estado final.

`/tracker` muestra la lista al día. Este archivo solo guarda el contexto que no cabe en el log.

## Tesis activas

Ninguna registrada bajo v4 al 14-nov-2026. La medición de los deeps anteriores está en `DEEPS_BACKFILL_2026-11.md`.

## Vista sectorial vigente

Qué es: después de cada `/macro`, DIONE elige hasta 3 sectores en los que conviene tener más peso que el S&P 500 y hasta 2 en los que conviene tener menos. Eso se llama sobreponderar e infraponderar.

Para qué sirve: decide qué ETFs sectoriales van en el tramo táctico de la cuenta (10% a 20%, ver `MANDATE.md`). Por ejemplo, si salud es favorito, se compra XLV.

Para qué no sirve: no limita el scan de acciones. `/scan` busca en los 11 sectores con máximo 3 nombres por sector. La vista sectorial solo desempata entre dos acciones con puntaje parecido.

Vista actual: pendiente. Se llena al correr `/macro`, con fecha y una línea de motivo por sector.

## Foto del mercado al cierre del 13-nov-2026

[Yahoo, precios ajustados]. Es dato, no vista.

| Activo | Contra máximo de 52 semanas | 1 mes | Contra SMA200 |
|---|---|---|---|
| SPY | −3.2% | −2.3% | +3.4% |
| QQQ | −10.5% | −6.6% | −0.2% |
| NVDA | −31.9% | −25.0% | −20.1% |
| MU | −35.8% | −16.4% | +1.7% |
| ORCL | −49.1% | −6.8% | −18.2% |
| AVGO | −27.7% | +0.8% | −5.3% |
| LLY | 0.0% | +15.5% | +30.5% |

SPY sigue sobre su SMA200 y QQQ está justo en la suya. La corrección está concentrada en la cadena de IA. De las 20 acciones del S&P 500 con mejor momentum, 10 son de salud (MRNA, CRL, RVTY, HUM, VEEV, TECH, TMO, MTD, IQV, A) y 3 son refinadoras (MPC, VLO, PSX).

## Referencias fijas

- Núcleo estratégico: VOO, VT, QQQ.
- ETFs sectoriales para el tramo táctico: XLK, XLV, XLF, XLE, XLI, XLY, XLP, XLU, XLB, XLRE, XLC, más SMH e IBB como sub-sectores.
- Liquidez: SHY, BIL.

## Archivo (tesis de junio 2026)

| Ticker | Lo que decía | Qué pasó |
|---|---|---|
| ALLY | Límite en $41, stop $39.50, objetivo $47 | La orden se habría ejecutado al día siguiente y llegó al objetivo en 10 sesiones |
| NOW | WATCH, esperar $100-108 | Se habría ejecutado en 4 sesiones y llegó a $130 en 50 |
| MELI | BUY, objetivo $1,850 a 3 meses | +12% sobre SPY a 60 días, −7% a hoy |
