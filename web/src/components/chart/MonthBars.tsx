import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceArea, Cell, CartesianGrid } from "recharts";
import { categoryColor } from "../../theme";
import { fiveTicks, type DailyBar } from "../../chartData";
import { useThresholds } from "../../ThresholdsContext";

export function MonthBars({ bars }: { bars: DailyBar[] }) {
  const t = useThresholds();
  if (bars.length === 0) return <div className="month-bars"><p>No history yet</p></div>;
  const data = bars.map((b) => ({ ...b, base: b.minLull, span: b.maxGust - b.minLull }));
  const yTicks = fiveTicks(Math.max(0, ...bars.map((b) => b.maxGust)));
  return (
    <div className="month-bars">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: -18 }}>
          <CartesianGrid stroke="#16213a" vertical={false} />
          <ReferenceArea y1={t.goodLowMph} y2={t.goodHighMph} fill="#22d3ee" fillOpacity={0.07} />
          <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
          <YAxis width={34} ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            formatter={(_, __, item) => {
              const p = item.payload as DailyBar & { span: number };
              return [`${p.minLull}–${p.maxGust} mph`, "lull–gust"];
            }} />
          <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="a" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={categoryColor[d.category]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
