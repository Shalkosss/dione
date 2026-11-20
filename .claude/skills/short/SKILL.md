---
name: short
description: /short TICKER — deep research bajista de DIONE (espejo de /deep) para confirmar o descartar un corto antes de abrirlo. Usar cuando el usuario pide "deep short", "/short NBIS", "confirmar el short" o quiere validar un candidato del scan short.
---

# /short TICKER (deep short)

Procedimiento de `project-docs/SHORT_FRAMEWORK.md` (sección `/short`). Un corto solo se
confirma si sobrevive a un abogado del diablo que intenta romperlo.

1. Punto de partida: `npm run scan:short -- --json` (score, banderas y plan de
   `lib/shortTiming.js`: entrada en resistencia o a mercado, stop, soporte donde cubrir).
2. Tres investigaciones, en paralelo si se puede (workflow o subagentes):
   - **Fundamental**: calidad de earnings (accruals, FCF contra utilidad), deuda y
     vencimientos, dilución, erosión del moat, valuación inversa (qué crecimiento descuenta el precio).
   - **Shortability y catalizadores**: short interest % del float, días para cubrir,
     costo de préstamo, opciones; próximos resultados y eventos binarios a 30 días,
     recompras, M&A, activistas; insiders y analistas; noticias recientes.
   - **Técnico Wyckoff de distribución** (`project-docs/WYCKOFF_FRAMEWORK.md`): fase,
     UTAD, SOW, LPSY, volumen; verificar con velas que la resistencia del plan existe y
     que no hay acumulación activa (Spring con el mínimo intacto o clímax reciente).
3. **Abogado del diablo**: con las tres investigaciones, listar cómo se rompe el corto
   (squeeze, catalizador alcista, rebote técnico) y revisar los 9 anti-traps del framework.
   Si se cumple uno duro (SI > 15%, días para cubrir > 5, binario < 30 días, recompra > 10%
   de la cap, M&A o activista), el corto no se abre.
4. **Veredicto** con la estructura del framework: TL;DR, tesis 1-3-1, bull y bear case,
   pre-mortem (3 formas concretas de perder), plan (entrada, stop, cubrir en, R:R ≥ 3),
   tamaño (1% de riesgo de la cuenta; mitad con VIX > 25) y vehículo. En la cuenta real no
   hay cortos: put spread o ETF inverso.
5. Si se confirma y el usuario lo ejecuta, registrarlo con el skill `orden` (venta en corto
   todavía no existe en el libro: anotarlo en la nota hasta que el libro soporte cortos).
