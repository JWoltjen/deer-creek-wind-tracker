import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid,
} from "recharts";
import { config } from "../config";
import type { Observation } from "../types";

export function HistoryChart({ observations }: { observations: Observation[] }) {
  if (observations.length === 0) return <section><h2>Last 7 Days</h2><p>No history yet</p></section>;
  const cutoff = Date.now() - 7 * 864e5;
  const data = observations
    .filter((o) => new Date(o.time).getTime() >= cutoff)
    .map((o) => ({ t: new Date(o.time).getTime(), mid: (o.low + o.high) / 2 }));
  return (
    <section className="history-chart">
      <h2>Last 7 Days</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <ReferenceArea y1={config.goodLowMph} y2={config.goodHighMph} fillOpacity={0.15} fill="green" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]}
                 tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { weekday: "short" })} />
          <YAxis unit=" mph" />
          <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString()} />
          <Line type="monotone" dataKey="mid" dot={false} stroke="#0369a1" />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
