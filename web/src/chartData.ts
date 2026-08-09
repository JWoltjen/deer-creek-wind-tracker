import { config } from "./config";
import { classify, configThresholds, type Category, type Thresholds } from "./classify";
import { localHour, localDate, hourDecimal } from "./analytics";
import type { Observation } from "./types";

export type HoursMode = "riding" | "full";
export type Range = "day" | "week" | "month";

export interface BandPoint {
  i: number; time: string; low: number; high: number;
  range: [number, number]; category: Category; dayKey: string; isPrime: boolean;
}

export interface DailyBar { date: string; minLull: number; maxGust: number; category: Category; }

const RANGE_DAYS: Record<Range, number> = { day: 1, week: 7, month: 30 };

export function ridingHoursFilter(obs: Observation[], mode: HoursMode): Observation[] {
  if (mode === "full") return obs;
  return obs.filter((o) => {
    const h = localHour(o.time);
    return h >= config.ridingStartHour && h <= config.ridingEndHour;
  });
}

export function sliceByRange(obs: Observation[], range: Range, nowMs: number): Observation[] {
  const cutoff = nowMs - RANGE_DAYS[range] * 864e5;
  return obs.filter((o) => Date.parse(o.time) >= cutoff);
}

export function bandPoints(obs: Observation[], t: Thresholds = configThresholds): BandPoint[] {
  return [...obs]
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .map((o, i) => {
      const hd = hourDecimal(o.time);
      return {
        i, time: o.time, low: o.low, high: o.high,
        range: [o.low, o.high] as [number, number],
        category: classify(o.low, o.high, t),
        dayKey: localDate(o.time),
        isPrime: hd >= config.primeStartHour && hd <= config.primeEndHour,
      };
    });
}

export function dayBoundaries(points: BandPoint[]): number[] {
  const out: number[] = [];
  for (let k = 1; k < points.length; k++) {
    if (points[k].dayKey !== points[k - 1].dayKey) out.push(points[k].i);
  }
  return out;
}

export function primeRanges(points: BandPoint[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let k = 0; k < points.length; k++) {
    if (points[k].isPrime && start === -1) start = points[k].i;
    if (!points[k].isPrime && start !== -1) { out.push([start, points[k - 1].i]); start = -1; }
  }
  if (start !== -1) out.push([start, points[points.length - 1].i]);
  return out;
}

export function dailyBars(obs: Observation[], mode: HoursMode, t: Thresholds = configThresholds): DailyBar[] {
  const byDay = new Map<string, { min: number; max: number }>();
  for (const o of ridingHoursFilter(obs, mode)) {
    const d = localDate(o.time);
    const cur = byDay.get(d) ?? { min: Infinity, max: -Infinity };
    cur.min = Math.min(cur.min, o.low);
    cur.max = Math.max(cur.max, o.high);
    byDay.set(d, cur);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, v]) => ({ date, minLull: v.min, maxGust: v.max, category: classify(v.min, v.max, t) }));
}
