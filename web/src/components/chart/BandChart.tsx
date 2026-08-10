import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, CartesianGrid,
} from "recharts";
import { dayBoundaries, primeRanges, hourTicks, dayHourTicks, fiveTicks, type BandPoint } from "../../chartData";
import { hourDecimal } from "../../analytics";
import { steadiness } from "../../classify";
import { useThresholds } from "../../ThresholdsContext";
import { config } from "../../config";

export function BandChart({ points, showDayLabels, inWindow = false, dayWindow }: {
  points: BandPoint[]; showDayLabels: boolean; inWindow?: boolean;
  dayWindow?: { startHour: number; endHour: number };
}) {
  const t = useThresholds();
  if (points.length === 0 && !dayWindow) return <div className="band-chart"><p>No history yet</p></div>;
  const boundaries = dayWindow ? [] : dayBoundaries(points);
  const primes = dayWindow ? [] : primeRanges(points);
  const dayTicks = dayWindow
    ? dayHourTicks(dayWindow.startHour, dayWindow.endHour, dayWindow.endHour - dayWindow.startHour > 12 ? 3 : 1)
    : [];
  const xTicks = hourTicks(points, showDayLabels, config.weekMarkerHours);
  const yTicks = fiveTicks(Math.max(0, ...points.map((p) => p.high)));
  const data = points.map((p) => {
    const mid = (p.low + p.high) / 2;
    const inW = mid >= t.goodLowMph && mid <= t.goodHighMph;
    return {
      ...p, x: hourDecimal(p.time),
      highIn: inW ? p.high : null, highOut: inW ? null : p.high, lowIn: inW ? p.low : null, lowOut: inW ? null : p.low,
    };
  });
  const dayLabel = (i: number) =>
    new Date(points.find((p) => p.i === i)!.time).toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div className="band-chart">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
          <CartesianGrid stroke="#16213a" vertical={false} />
          <ReferenceArea y1={t.goodLowMph} y2={t.goodHighMph} fill="#22d3ee" fillOpacity={0.07} />
          {primes.map(([a, b], k) => (
            <ReferenceArea key={k} x1={a} x2={b} fill="#0ea5b7" fillOpacity={0.05} />
          ))}
          {boundaries.map((i) => (
            <ReferenceLine key={i} x={i} stroke="#1e293b"
              label={showDayLabels ? { value: dayLabel(i), position: "insideTop", fill: "#64748b", fontSize: 9 } : undefined} />
          ))}
          {dayWindow ? (
            <XAxis
              dataKey="x" type="number" domain={[dayWindow.startHour, dayWindow.endHour]} allowDataOverflow
              ticks={dayTicks.map((x) => x.i)} interval={0} tickMargin={4}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => dayTicks.find((x) => x.i === v)?.label ?? ""}
            />
          ) : (
            <XAxis
              dataKey="i" type="number" domain={["dataMin", "dataMax"]}
              ticks={xTicks.map((x) => x.i)} interval={0} tickMargin={4}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(i) => xTicks.find((x) => x.i === i)?.label ?? ""}
            />
          )}
          <YAxis width={34} ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip cursor={{ stroke: "#334155" }} content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const p = payload[0].payload as BandPoint;
            const spread = p.high - p.low;
            const row = { display: "flex", justifyContent: "space-between", gap: 16 } as const;
            return (
              <div style={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6", fontSize: 12, padding: "6px 10px" }}>
                <div style={{ color: "#94a3b8", marginBottom: 4 }}>{new Date(p.time).toLocaleString()}</div>
                <div style={row}><span style={{ color: "#64748b" }}>gust</span><b style={{ color: "#22d3ee" }}>{p.high} mph</b></div>
                <div style={row}><span style={{ color: "#64748b" }}>lull</span><b>{p.low} mph</b></div>
                <div style={row}><span style={{ color: "#64748b" }}>spread</span><span>{spread} mph · {steadiness(p.low, p.high, t)}</span></div>
              </div>
            );
          }} />
          <Area dataKey="range" stroke="none" fill="#22d3ee" fillOpacity={0.16} isAnimationActive={false} />
          {inWindow ? (
            <>
              <Line dataKey="highOut" dot={false} stroke="#334155" strokeWidth={1.8} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="lowOut" dot={false} stroke="#334155" strokeWidth={1.4} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="highIn" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="lowIn" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} connectNulls={false} />
            </>
          ) : (
            <>
              <Line dataKey="high" dot={false} stroke="#22d3ee" strokeWidth={1.8} isAnimationActive={false} />
              <Line dataKey="low" dot={false} stroke="#0e7490" strokeWidth={1.4} isAnimationActive={false} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
