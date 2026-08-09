import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { hourPattern } from "../analytics";
import { ridingHoursFilter } from "../chartData";
import { classify } from "../classify";
import { categoryColor } from "../theme";
import type { Observation } from "../types";

export function HourPattern({ observations }: { observations: Observation[] }) {
  const data = hourPattern(ridingHoursFilter(observations, "riding"));
  if (data.length === 0) return <section className="panel"><span className="section-title">When it's usually good</span><p>Not enough data yet</p></section>;
  return (
    <section className="panel hour-pattern">
      <span className="section-title">When it's usually good</span>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 10, right: 6, bottom: 2, left: -18 }}>
          <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(h) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`} />
          <YAxis width={34} tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#0e1729", border: "1px solid #1e293b", borderRadius: 8, color: "#e6edf6" }}
            formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)} mph avg` : "", ""]} labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="avgMid" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={categoryColor[classify(d.avgMid - 2, d.avgMid + 2)]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
