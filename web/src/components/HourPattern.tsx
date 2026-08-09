import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { hourPattern } from "../analytics";
import { ridingHoursFilter } from "../chartData";
import { classify } from "../classify";
import { categoryColor } from "../theme";
import { formatHourShort, formatHour12 } from "../format";
import type { Observation } from "../types";

export function HourPattern({ observations }: { observations: Observation[] }) {
  const data = hourPattern(ridingHoursFilter(observations, "riding"));
  if (data.length === 0) return <div className="hour-pattern"><p>Not enough data yet</p></div>;
  return (
    <div className="hour-pattern">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 10, right: 6, bottom: 2, left: -18 }}>
          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(h) => formatHourShort(h)} />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)} mph avg` : "", ""]} labelFormatter={(h) => formatHour12(Number(h))} />
          <Bar dataKey="avgMid" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={categoryColor[classify(d.avgMid - 2, d.avgMid + 2)]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
