import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid,
} from "recharts";
import { config } from "../../config";
import { dayBoundaries, primeRanges, type BandPoint } from "../../chartData";
import { formatHourShort } from "../../format";
import { localHour } from "../../analytics";

export function BandChart({ points, showDayLabels }: { points: BandPoint[]; showDayLabels: boolean }) {
  if (points.length === 0) return <div className="band-chart"><p>No history yet</p></div>;
  const boundaries = dayBoundaries(points);
  const primes = primeRanges(points);
  const dayLabel = (i: number) =>
    new Date(points.find((p) => p.i === i)!.time).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div className="band-chart">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={points} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
          <CartesianGrid stroke="#16213a" vertical={false} />
          <ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph} fill="#22d3ee" fillOpacity={0.07} />
          {primes.map(([a, b], k) => (
            <ReferenceArea key={k} x1={a} x2={b} fill="#0ea5b7" fillOpacity={0.05} />
          ))}
          {boundaries.map((i) => (
            <ReferenceLine key={i} x={i} stroke="#1e293b"
              label={showDayLabels ? { value: dayLabel(i), position: "insideTop", fill: "#64748b", fontSize: 9 } : undefined} />
          ))}
          <XAxis
            dataKey="i"
            hide={showDayLabels}
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#64748b", fontSize: 10 }}
            minTickGap={44}
            tickFormatter={(i) => {
              const p = points.find((q) => q.i === i);
              return p ? formatHourShort(localHour(p.time)) : "";
            }}
          />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} unit=" " domain={[0, "dataMax + 4"]} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            labelFormatter={(_, p) => (p && p[0] ? new Date((p[0].payload as BandPoint).time).toLocaleString() : "")}
            formatter={(v, name) => [`${v} mph`, name === "high" ? "gust" : name === "low" ? "lull" : name]} />
          <Area dataKey="range" stroke="none" fill="#22d3ee" fillOpacity={0.16} isAnimationActive={false} />
          <Line dataKey="high" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} />
          <Line dataKey="low" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
