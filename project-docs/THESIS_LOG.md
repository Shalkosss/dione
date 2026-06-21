# THESIS LOG — Registro de tesis para self-improving

Cada tesis de inversión generada por DIONE se loguea aquí. Esto permite calcular hit rate y mejorar el sistema con uso real.

---

## CÓMO USAR ESTE LOG

Cuando DIONE genera una tesis (cualquier rating BUY o STRONG BUY), usar comando `/log-thesis TICKER` y DIONE actualizará este archivo con el formato standard.

Cada entry incluye:
- Date issued
- Ticker
- Hunter mode usado (Fundamental, Técnico-Wyckoff, Combinado, Divergence)
- Conviction (1-5)
- Bias (long/short)
- Entry price
- Targets (3m, 12m)
- Stop loss
- Invalidation criteria (cuantitativos)
- Thesis 1-3-1 resumida

Y se completa con el tracking real:
- Price at +30d, +90d, +180d
- Outcome: hit target / hit stop / open
- Lessons learned

---

## ENTRIES

(Aquí van las tesis. Al inicio está vacío. Se llena con uso.)

---

## TEMPLATE PARA NUEVAS ENTRIES

```markdown
### [FECHA] — [TICKER] — [LONG/SHORT]

**Hunter mode**: [Fundamental / Técnico-Wyckoff / Combinado / Divergence / Manual]
**Conviction**: [1-5]
**Bias**: [long / short]
**Entry price**: $X
**Target 3m**: $X (prob Y%)
**Target 12m**: $X (prob Y%)
**Stop loss**: $X (-Y% from entry)
**Invalidación**: [precio + condición técnica + condición fundamental]

**Tesis 1-3-1**:
- [1 frase central]
- Catalysts:
  1. [...]
  2. [...]
  3. [...]

**Smart Money signal**: [Score X/100 — qué generó el score]
**Wyckoff phase**: [A/B/C/D/E]
**Régimen macro vigente**: [Goldilocks/Reflation/Stagflation/Deflation]
**Sector context**: [Hot/Warming/Cooling/Cold según Macro Atlas]

---

**TRACKING**:
- +30d: $X | Δ% | [comentario]
- +90d: $X | Δ% | [comentario]
- +180d: $X | Δ% | [comentario]
- **Outcome**: [Target hit / Stop hit / Open / Closed early — razón]

**Post-mortem (si aplica)**:
- Qué funcionó / qué falló:
- Lesson learned:
- Implication para sistema:
```

---

## PERFORMANCE METRICS

Cuando hay suficientes entries (n ≥ 10 por categoría), DIONE calcula automáticamente con `/performance`:

### Por Hunter Mode
| Modo | n | Win rate | Avg return | Avg drawdown | Sharpe approx |
|---|---|---|---|---|---|
| Fundamental | - | - | - | - | - |
| Técnico-Wyckoff | - | - | - | - | - |
| Combinado (Diamond) | - | - | - | - | - |
| Divergence | - | - | - | - | - |

### Por Sector GICS
| Sector | n | Win rate | Avg return |
|---|---|---|---|
| Technology | - | - | - |
| Healthcare | - | - | - |
| Financials | - | - | - |
| ... | - | - | - |

### Por Market Cap Range
| Cap | n | Win rate | Avg return |
|---|---|---|---|
| Large ($10B+) | - | - | - |
| Mid ($2B-$10B) | - | - | - |
| Small ($300M-$2B) | - | - | - |

### Por Régimen Macro Vigente al Issuance
| Régimen | n | Win rate | Avg return |
|---|---|---|---|
| Goldilocks | - | - | - |
| Reflation | - | - | - |
| Stagflation | - | - | - |
| Deflation | - | - | - |

### Por Conviction Score
| Conviction | n | Win rate | Avg return |
|---|---|---|---|
| 5/5 | - | - | - |
| 4/5 | - | - | - |
| 3/5 | - | - | - |

---

## SELF-IMPROVING TRIGGERS

DIONE sugiere ajustes automáticamente cuando:

1. **Hit rate < 50% sostenido (n ≥ 20)** en alguna categoría → revisar composite scoring weights
2. **Avg return < 0 sostenido** en alguna categoría → suspender ese modo/sector hasta análisis profundo
3. **Conviction-return correlation negativa** (5/5 ≤ 3/5 en returns) → revisar calibración de conviction
4. **Hit rate por modo diverge >20pp** (ej Modo Técnico 75% vs Modo Fundamental 45%) → sugerir reweighting

Ejemplo de output post-revisión:
> "DIONE performance review — Q3:
> - Modo Combinado (Diamond): 70% win rate (n=20), avg +18%, Sharpe approx 1.3. Mantener como modo principal.
> - Modo Técnico-Wyckoff puro: 50% win rate (n=10), avg +6%, demasiado dispersión.
> - **Sugerencia**: subir filtro mínimo Fundamental Score de 0 a 40 en Modo Técnico para excluir empresas zombi.
> - Mejor sector: Technology 75% (n=12). Peor: Consumer Discretionary 35% (n=8). Considerar reducir exposición a Consumer hasta nuevo signal macro."

---

## REGLAS DE LOGGING

1. **Toda tesis BUY o STRONG BUY se loguea automáticamente** al ejecutar Deep Research
2. **WATCH tickers se loguean cuando entrás efectivamente** (si entrás)
3. **NO se loguean ideas exploratorias sin entrada real**
4. **Post-mortems son obligatorios** para tesis que fallan (target no alcanzado en 6 meses o stop hit)
5. **Re-evaluation cada 90 días** de tesis abiertas: ¿sigue válida? ¿algo cambió?

El valor del log crece con tiempo. Año 1: n~30, son patrones tentativos. Año 2: n~60, patrones más sólidos. Año 3+: alpha de proceso compounded.
