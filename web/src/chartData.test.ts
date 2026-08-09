import { describe, it, expect } from "vitest";
import { ridingHoursFilter, sliceByRange, bandPoints, dayBoundaries, primeRanges, dailyBars } from "./chartData";
import { configThresholds, type Thresholds } from "./classify";
import type { Observation } from "./types";

const o = (time: string, low = 15, high = 20): Observation => ({ time, tempF: 90, dir: "SW", low, high });
const strongT: Thresholds = { ...configThresholds, goodLowMph: 25, goodHighMph: 35 };

describe("ridingHoursFilter", () => {
  const data = [o("2026-08-08T09:00:00-06:00"), o("2026-08-08T13:00:00-06:00"), o("2026-08-08T21:00:00-06:00")];
  it("riding keeps only 11–19", () => {
    expect(ridingHoursFilter(data, "riding").map((x) => x.time)).toEqual(["2026-08-08T13:00:00-06:00"]);
  });
  it("full keeps all", () => {
    expect(ridingHoursFilter(data, "full")).toHaveLength(3);
  });
});

describe("sliceByRange", () => {
  const now = Date.parse("2026-08-08T18:00:00-06:00");
  const data = [o("2026-08-01T13:00:00-06:00"), o("2026-08-07T13:00:00-06:00"), o("2026-08-08T13:00:00-06:00")];
  it("day keeps last 24h", () => expect(sliceByRange(data, "day", now)).toHaveLength(1));
  it("week keeps last 7d", () => expect(sliceByRange(data, "week", now)).toHaveLength(2));
  it("month keeps last 30d", () => expect(sliceByRange(data, "month", now)).toHaveLength(3));
});

describe("bandPoints", () => {
  it("shapes points with range, category, dayKey, prime flag", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00", 16, 20), o("2026-08-09T09:00:00-06:00", 8, 12)]);
    expect(pts[0]).toMatchObject({ i: 0, range: [16, 20], category: "good", dayKey: "2026-08-08", isPrime: true });
    expect(pts[1]).toMatchObject({ i: 1, category: "light", dayKey: "2026-08-09", isPrime: false });
  });
  it("bandPoints category respects passed thresholds", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00", 16, 20)], strongT);
    expect(pts[0].category).toBe("light"); // high 20 < 25 under strongT
  });
});

describe("dayBoundaries", () => {
  it("marks indices where the day changes", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00"), o("2026-08-08T14:00:00-06:00"), o("2026-08-09T13:00:00-06:00")]);
    expect(dayBoundaries(pts)).toEqual([2]);
  });
});

describe("primeRanges", () => {
  it("finds contiguous prime runs", () => {
    const pts = bandPoints([
      o("2026-08-08T11:00:00-06:00"), o("2026-08-08T13:00:00-06:00"),
      o("2026-08-08T14:00:00-06:00"), o("2026-08-08T18:00:00-06:00"),
    ]);
    expect(primeRanges(pts)).toEqual([[1, 2]]); // 13:00 & 14:00 are prime; 11 & 18 are not
  });
});

describe("dailyBars", () => {
  it("aggregates per day to min lull / max gust", () => {
    const bars = dailyBars([
      o("2026-08-08T13:00:00-06:00", 14, 19), o("2026-08-08T15:00:00-06:00", 16, 24),
      o("2026-08-09T13:00:00-06:00", 8, 12),
    ], "riding");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ date: "2026-08-08", minLull: 14, maxGust: 24 });
    expect(bars[1]).toMatchObject({ date: "2026-08-09", category: "light" });
  });
  it("dailyBars category respects passed thresholds", () => {
    const bars = dailyBars([o("2026-08-08T13:00:00-06:00", 16, 20)], "riding", strongT);
    expect(bars[0].category).toBe("light");
  });
});
