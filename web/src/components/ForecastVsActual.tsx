import { actualDailyPeak, forecastDailyPeak } from "../analytics";
import type { Observation, Forecast } from "../types";

export function ForecastVsActual(
  { observations, forecasts }: { observations: Observation[]; forecasts: Forecast[] }
) {
  const actual = actualDailyPeak(observations);
  const fpeak = forecastDailyPeak(forecasts);
  const days = [...actual.keys()].filter((d) => fpeak.has(d)).sort().reverse();
  if (days.length === 0)
    return <section className="panel forecast-actual"><span className="section-title">Forecast vs actual</span><p>No evaluated days yet</p></section>;
  const keys = [...new Set(days.flatMap((d) => [...(fpeak.get(d)?.keys() ?? [])]))].sort();
  return (
    <section className="panel forecast-actual">
      <span className="section-title">Forecast vs actual</span>
      <table>
        <thead>
          <tr><th>Day</th><th>Actual peak</th>{keys.map((k) => <th key={k}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const a = actual.get(d)!;
            const models = fpeak.get(d)!;
            return (
              <tr key={d}>
                <td>{d}</td><td>{a.toFixed(0)}</td>
                {keys.map((k) => {
                  const v = models.get(k);
                  const miss = v !== undefined && isFinite(v) && Math.abs(v - a) >= 8;
                  return <td key={k} className={miss ? "miss" : ""}>{v !== undefined && isFinite(v) ? v.toFixed(0) : "–"}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
