import { config } from "./config";
import type { Observation, Forecast } from "./types";

export function localHour(iso: string): number {
  // Take the hour written in the ISO string itself (times are already Mountain).
  const m = iso.match(/T(\d{2}):/);
  return m ? Number(m[1]) : new Date(iso).getHours();
}

export function localDate(iso: string): string {
  return iso.slice(0, 10);
}

export function hourDecimal(iso: string): number {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : new Date(iso).getHours();
}

const mid = (o: Observation) => (o.low + o.high) / 2;
const inRiding = (h: number) => h >= config.ridingStartHour && h <= config.ridingEndHour;

export function hourPattern(obs: Observation[]) {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const o of obs) {
    const h = localHour(o.time);
    const b = buckets.get(h) ?? { sum: 0, count: 0 };
    b.sum += mid(o); b.count += 1;
    buckets.set(h, b);
  }
  return [...buckets.entries()]
    .map(([hour, b]) => ({ hour, avgMid: b.sum / b.count, count: b.count }))
    .sort((a, b) => a.hour - b.hour);
}

export function actualDailyPeak(obs: Observation[]): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const o of obs) {
    if (!inRiding(localHour(o.time))) continue;
    const d = localDate(o.time);
    peaks.set(d, Math.max(peaks.get(d) ?? -Infinity, mid(o)));
  }
  return peaks;
}

export function forecastDailyPeak(fc: Forecast[]): Map<string, Map<string, number>> {
  // For each day + model key, use ONLY the single latest snapshot fetched before that day,
  // and take that snapshot's peak windMph over the day window.
  // chosen: day -> key -> { fetchedAt used, peak so far within that snapshot }
  const chosen = new Map<string, Map<string, { fetchedAt: string; peak: number }>>();
  for (const f of fc) {
    const day = localDate(f.validTime);
    if (!inRiding(localHour(f.validTime))) continue;
    if (f.fetchedAt.slice(0, 10) >= day) continue; // only forecasts made before the day
    const key = `${f.source}/${f.model}`;
    const dayMap = chosen.get(day) ?? new Map<string, { fetchedAt: string; peak: number }>();
    chosen.set(day, dayMap);
    const cur = dayMap.get(key);
    if (!cur || f.fetchedAt > cur.fetchedAt) {
      dayMap.set(key, { fetchedAt: f.fetchedAt, peak: f.windMph }); // newer snapshot resets peak
    } else if (f.fetchedAt === cur.fetchedAt) {
      cur.peak = Math.max(cur.peak, f.windMph);
    } // older snapshot: ignore
  }
  const out = new Map<string, Map<string, number>>();
  for (const [day, keys] of chosen) {
    const m = new Map<string, number>();
    for (const [key, v] of keys) m.set(key, v.peak);
    out.set(day, m);
  }
  return out;
}

export function scoreboard(obs: Observation[], fc: Forecast[]) {
  const actual = actualDailyPeak(obs);
  const fpeak = forecastDailyPeak(fc);
  const errs = new Map<string, number[]>();
  for (const [day, models] of fpeak) {
    const a = actual.get(day);
    if (a === undefined) continue;
    for (const [key, wind] of models) {
      if (!isFinite(wind)) continue;
      const arr = errs.get(key) ?? [];
      arr.push(Math.abs(wind - a));
      errs.set(key, arr);
    }
  }
  return [...errs.entries()]
    .map(([key, e]) => ({ key, mae: e.reduce((s, x) => s + x, 0) / e.length, days: e.length }))
    .sort((a, b) => a.mae - b.mae);
}
