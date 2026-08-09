import { config } from "./config";
import { classify, type Category } from "./classify";
import { localHour, localDate, hourDecimal } from "./analytics";
import type { Observation } from "./types";

export type HoursMode = "riding" | "full";
export type Range = "day" | "week" | "month";

export interface BandPoint {
  i: number; time: string; low: number; high: number;
  range: [number, number]; category: Category; dayKey: string; isPrime: boolean;
}

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

export function bandPoints(obs: Observation[]): BandPoint[] {
  return [...obs]
    .sort((a, b) => (a.time < b.time ? -1 : 1))
    .map((o, i) => {
      const hd = hourDecimal(o.time);
      return {
        i, time: o.time, low: o.low, high: o.high,
        range: [o.low, o.high] as [number, number],
        category: classify(o.low, o.high),
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
