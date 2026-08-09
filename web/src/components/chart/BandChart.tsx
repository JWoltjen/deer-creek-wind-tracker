import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid,
} from "recharts";
import { config } from "../../config";
import { dayBoundaries, primeRanges, type BandPoint } from "../../chartData";
import { formatHourShort } from "../../format";
import { localHour } from "../../analytics";
import { steadiness } from "../../classify";

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
          <Tooltip cursor={{ stroke: "#334155" }} content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const p = payload[0].payload as BandPoint;
            const spread = p.high - p.low;
            return (
              <div style={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6", fontSize: 12, padding: "6px 10px" }}>
                <div style={{ color: "#94a3b8", marginBottom: 2 }}>{new Date(p.time).toLocaleString()}</div>
                <div><b>{spread} mph</b> spread · {steadiness(p.low, p.high)}</div>
              </div>
            );
          }} />
          <Area dataKey="range" stroke="none" fill="#22d3ee" fillOpacity={0.16} isAnimationActive={false} />
          <Line dataKey="high" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} />
          <Line dataKey="low" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
