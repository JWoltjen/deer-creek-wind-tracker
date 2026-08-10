import { config } from "./config";
import { classify, configThresholds, type Category, type Thresholds } from "./classify";
import { localHour, localDate, hourDecimal } from "./analytics";
import { formatHourShort } from "./format";
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

export function fiveTicks(maxMph: number): number[] {
  const top = Math.ceil(Math.max(5, maxMph) / 5) * 5;
  const out: number[] = [];
  for (let v = 0; v <= top; v += 5) out.push(v);
  return out;
}

export interface AxisTick { i: number; label: string; }

export function hourTicks(points: BandPoint[], showDayLabels: boolean, markerHours: readonly number[]): AxisTick[] {
  const out: AxisTick[] = [];
  let lastHour = -1, lastKey = "";
  for (const p of points) {
    const h = localHour(p.time);
    if (showDayLabels) {
      const key = `${p.dayKey}|${h}`;
      if (markerHours.includes(h) && key !== lastKey) {
        out.push({ i: p.i, label: formatHourShort(h) });
        lastKey = key;
      }
    } else if (h !== lastHour) {
      out.push({ i: p.i, label: formatHourShort(h) });
      lastHour = h;
    }
  }
  return out;
}

export function localDateStr(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n).getTime());
}

export function dataDayRange(obs: Observation[]): { first: string; last: string } | null {
  if (obs.length === 0) return null;
  let first = "9999-99-99", last = "0000-00-00";
  for (const oo of obs) {
    const d = localDate(oo.time);
    if (d < first) first = d;
    if (d > last) last = d;
  }
  return { first, last };
}

export function sliceByDay(obs: Observation[], dateStr: string): Observation[] {
  return obs.filter((oo) => localDate(oo.time) === dateStr);
}

export function dayHourTicks(startHour: number, endHour: number, step: number): AxisTick[] {
  const out: AxisTick[] = [];
  for (let h = startHour; h <= endHour; h += step) out.push({ i: h, label: formatHourShort(h) });
  return out;
}

export function timeInWindow(obs: Observation[], t: Thresholds, ridingStart: number, ridingEnd: number, capMin = 5): number {
  const sorted = [...obs].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  let mins = 0;
  for (let k = 0; k < sorted.length; k++) {
    const oo = sorted[k];
    const h = localHour(oo.time);
    if (h < ridingStart || h > ridingEnd) continue;
    const mid = (oo.low + oo.high) / 2;
    if (mid < t.goodLowMph || mid > t.goodHighMph) continue;
    let gap = capMin;
    if (k + 1 < sorted.length) {
      const g = (Date.parse(sorted[k + 1].time) - Date.parse(oo.time)) / 60000;
      gap = Math.min(capMin, Math.max(0, g));
    }
    mins += gap;
  }
  return Math.round(mins);
}
