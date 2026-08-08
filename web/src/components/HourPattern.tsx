import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { hourPattern } from "../analytics";
import type { Observation } from "../types";

export function HourPattern({ observations }: { observations: Observation[] }) {
  const data = hourPattern(observations);
  if (data.length === 0) return <section><h2>When Is It Usually Good?</h2><p>Not enough data yet</p></section>;
  return (
    <section className="hour-pattern">
      <h2>When Is It Usually Good?</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
          <YAxis unit=" mph" />
          <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(1)} mph` : ""} labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="avgMid" fill="#0369a1" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
