# UNIVERSE — v4.1 (14-nov-2026)

[CAMBIOS: corregidas las partes viejas (el D/E ya no es proxy de pasivos totales y el sector ya no viene nulo en todos). Tramos por capitalización y tablero de megacaps. Sin techo de capitalización. El scan busca en los 11 sectores.]

## 1. Base

Todos los filers SEC con datos XBRL (6,356 al 14-nov-2026). El cron `refresh-gems` los filtra y guarda el snapshot. Detalle técnico en `DATA_SOURCE.md` y `README_HIDDEN_GEMS.md`.

## 2. Filtros duros

| Filtro | Criterio |
|---|---|
| Precio | Mayor a $3 |
| Liquidez (ADV 30 días) | Mayor a $1M para aparecer. Mayor a $5M para la cuenta real |
| Bolsa | NYSE, NASDAQ, AMEX |
| Auditor | Sin cambio en 12 meses |
| Going concern | Sin calificación |
| SPAC | Solo con fusión cerrada |

## 3. Quality gate del snapshot

ROE TTM mayor a 10%, FCF TTM positivo, `(deuda de largo + deuda de corto) / patrimonio` menor a 2, Altman fuera de zona de quiebra cuando se puede calcular. Pasan unos 500.

Límites conocidos del gate:

1. Rechaza a las empresas con `debtToEquity` nulo, y ahí caen muchas sin deuda.
2. Deja fuera por construcción a bancos, aseguradoras y REITs, y a empresas con patrimonio reducido por recompras o deuda alta (ORCL y LLY, por ejemplo).
3. Varios megacaps no aparecen en el snapshot sin que la causa esté identificada (GOOGL, META, AVGO, AMD, TSLA, V, MA al 14-nov-2026). Revisar en la Fase 3 del roadmap.
4. Solo los 200 mejores por preScore reciben cálculo técnico en el backend.
5. `gicsSector` falta en cerca del 42% de los nombres con score.

El gate es un pre-filtro barato. No es una opinión sobre la empresa.

## 4. Tramos por capitalización

| Tramo | Rango | Cómo entra al análisis |
|---|---|---|
| Megacaps | Más de $200B | Tablero de megacaps de `/scan`, pasen o no el gate |
| Descubrimiento | $2B a $200B | Ranking de `/scan` en los 11 sectores, máximo 3 nombres por sector |
| Small caps | $300M a $2B | `/scan cap=small`. Solo papel o tamaño mínimo en real, por liquidez |

## 5. Lo que entra por `/deep` directo

Financieras, REITs, ADRs que no reportan en formato US GAAP (TSM), acciones de la BVL y cualquier ticker que Rodrigo pida. El universo define el scan, no limita el research.

## 6. Excluidos siempre

OTC y pink sheets, SPAC sin fusión, tickers suspendidos, empresas con cambio de auditor reciente o going concern, cripto.
