import { describe, it, expect } from "vitest";
import { ridingHoursFilter, sliceByRange, bandPoints, dayBoundaries } from "./chartData";
import type { Observation } from "./types";

const o = (time: string, low = 15, high = 20): Observation => ({ time, tempF: 90, dir: "SW", low, high });

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
});

describe("dayBoundaries", () => {
  it("marks indices where the day changes", () => {
    const pts = bandPoints([o("2026-08-08T13:00:00-06:00"), o("2026-08-08T14:00:00-06:00"), o("2026-08-09T13:00:00-06:00")]);
    expect(dayBoundaries(pts)).toEqual([2]);
  });
});
