import { scoreboard } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ModelScoreboard(
  { observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }
) {
  const rows = scoreboard(observations, forecasts);
  if (rows.length === 0)
    return <section className="model-scoreboard"><h2>Model Scoreboard</h2><p>No overlapping days yet</p></section>;
  return (
    <section className="model-scoreboard">
      <h2>Model Scoreboard</h2>
      <table>
        <thead><tr><th>Source/Model</th><th>Avg error (mph)</th><th>Days</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}><td>{r.key}</td><td>{r.mae.toFixed(1)}</td><td>{r.days}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
