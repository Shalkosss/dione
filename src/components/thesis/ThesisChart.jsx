import React, { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { C, mono } from "../../theme.js";
import { buildChartSeries, chartDomains, closeTarget } from "../../lib/thesisView.js";

const tick = { fill: C.muted, fontSize: 10, fontFamily: mono };
const label = (value, fill, position = "insideTopRight") => ({ value, fill, fontSize: 10, fontFamily: mono, position });

// Precio de la tesis con sus niveles (eje izquierdo) y SPY / ETF sectorial
// rebasados a 100 en la emisión (eje derecho, alineado para que 100 = ref_price).
export default function ThesisChart({ thesis, marks }) {
  const series = useMemo(() => buildChartSeries(thesis, marks), [thesis, marks]);
  const domains = useMemo(() => chartDomains(thesis, series), [thesis, series]);
  const dates = useMemo(() => new Set(series.map((p) => p.date)), [series]);

  if (!series.length) {
    return <div style={{ fontSize: 11, color: C.muted, padding: "24px 0" }}>Sin marcas todavía. El cron las genera a las 22:00 UTC.</div>;
  }

  const target = closeTarget(thesis);
  const hLines = [
    [thesis.entry, C.accent, "Entrada"],
    [thesis.stop, C.neg, "Stop"],
    [thesis.tp1 !== target ? thesis.tp1 : null, C.pos, "TP1"],
    [target, C.pos, "Objetivo"],
  ].filter(([v]) => v != null);
  const vLines = [
    [thesis.entry_date, C.muted, "Emisión", "insideBottomLeft"],
    [thesis.filled_at !== thesis.entry_date ? thesis.filled_at : null, C.accent, "Ejecución", "insideTopLeft"],
    [thesis.closed_at, C.text, "Cierre", "insideTopLeft"],
  ].filter(([d]) => d && dates.has(d));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.border} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="date" tick={tick} tickFormatter={(d) => d.slice(5)} minTickGap={40} stroke={C.border} />
          <YAxis yAxisId="price" domain={domains.price} tick={tick} stroke={C.border} width={56}
            tickFormatter={(v) => v.toFixed(v >= 100 ? 0 : 2)} />
          <YAxis yAxisId="index" orientation="right" domain={domains.index} tick={tick} stroke={C.border} width={44}
            tickFormatter={(v) => v.toFixed(0)} />
          <Tooltip
            contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 11 }}
            labelStyle={{ color: C.muted }}
            formatter={(v, name) => [v == null ? "—" : Number(v).toFixed(2), name]}
          />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: mono }} />
          {hLines.map(([y, color, text]) => (
            <ReferenceLine key={text} yAxisId="price" y={y} stroke={color} strokeDasharray="4 3" label={label(`${text} ${y}`, color)} />
          ))}
          {vLines.map(([x, color, text, position]) => (
            <ReferenceLine key={text} yAxisId="price" x={x} stroke={color} strokeDasharray="1 3" label={label(text, color, position)} />
          ))}
          <Line yAxisId="price" type="linear" dataKey="close" name={thesis.ticker} stroke={C.text} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          <Line yAxisId="index" type="linear" dataKey="spy100" name="SPY (base 100)" stroke={C.blue} strokeWidth={1.2} dot={false} connectNulls isAnimationActive={false} />
          {thesis.sector_etf && (
            <Line yAxisId="index" type="linear" dataKey="etf100" name={`${thesis.sector_etf} (base 100)`} stroke={C.muted} strokeWidth={1.2} dot={false} connectNulls isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
