import { config } from "./config";
import { parseNdjson } from "./ndjson";
import type { Observation, Forecast } from "./types";

async function loadFile<T>(name: string, fetchFn: typeof fetch): Promise<T[]> {
  try {
    const res = await fetchFn(`${config.dataBaseUrl}/${name}`, { cache: "no-store" });
    if (!res.ok) return [];
    return parseNdjson<T>(await res.text());
  } catch {
    return [];
  }
}

export async function loadData(fetchFn: typeof fetch = fetch) {
  const [observations, forecasts] = await Promise.all([
    loadFile<Observation>("observations.ndjson", fetchFn),
    loadFile<Forecast>("forecasts.ndjson", fetchFn),
  ]);
  return { observations, forecasts };
}
