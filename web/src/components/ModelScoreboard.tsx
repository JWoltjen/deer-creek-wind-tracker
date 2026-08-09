import { scoreboard } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ModelScoreboard({ observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }) {
  const rows = scoreboard(observations, forecasts);
  if (rows.length === 0) return <section className="panel model-scoreboard"><span className="section-title">Which forecast to trust</span><p>No overlapping days yet</p></section>;
  return (
    <section className="panel model-scoreboard">
      <span className="section-title">Which forecast to trust</span>
      <div className="board">
        {rows.map((r, i) => (
          <div className="board-row" key={r.key}>
            <span>{r.key}</span>
            <span style={{ color: i === 0 ? "var(--accent)" : "var(--muted)" }}>±{r.mae.toFixed(1)} mph{i === 0 ? " · most accurate" : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
