export interface Observation {
  time: string; tempF: number; dir: string; low: number; high: number;
}
export interface Forecast {
  fetchedAt: string; source: string; model: string; validTime: string;
  windMph: number; gustMph: number | null; dirDeg: number | null;
}
