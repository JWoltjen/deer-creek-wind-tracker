import { scoreboard } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ModelScoreboard({ observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }) {
  const rows = scoreboard(observations, forecasts);
  if (rows.length === 0) return <div className="model-scoreboard"><p>No overlapping days yet</p></div>;
  return (
    <div className="model-scoreboard">
      <div className="board">
        {rows.map((r, i) => (
          <div className="board-row" key={r.key}>
            <span>{r.key}</span>
            <span style={{ color: i === 0 ? "var(--accent)" : "var(--muted)" }}>±{r.mae.toFixed(1)} mph{i === 0 ? " · most accurate" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
