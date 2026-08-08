import type { Observation } from "./types";

export function toCsv(observations: Observation[]): string {
  const header = "time,tempF,dir,low,high";
  const rows = observations.map((o) => `${o.time},${o.tempF},${o.dir},${o.low},${o.high}`);
  return [header, ...rows].join("\n");
}
