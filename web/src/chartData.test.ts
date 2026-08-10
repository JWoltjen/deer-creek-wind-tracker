import { describe, it, expect } from "vitest";
import { ridingHoursFilter, sliceByRange, bandPoints, dayBoundaries, primeRanges, dailyBars, fiveTicks, hourTicks, timeInWindow, localDateStr, addDays, dataDayRange, sliceByDay, dayHourTicks } from "./chartData";
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

describe("fiveTicks", () => {
  it("rounds up to a multiple of 5", () => {
    expect(fiveTicks(27)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(fiveTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(fiveTicks(0)).toEqual([0, 5]);
  });
});

describe("hourTicks", () => {
  it("Day: one tick per clock hour", () => {
    const pts = bandPoints([
      o("2026-08-08T13:00:00-06:00"), o("2026-08-08T13:30:00-06:00"),
      o("2026-08-08T14:00:00-06:00"),
    ]);
    expect(hourTicks(pts, false, [12, 15])).toEqual([
      { i: 0, label: "1p" }, { i: 2, label: "2p" },
    ]);
  });
  it("Week: marker hours per day", () => {
    const pts = bandPoints([
      o("2026-08-08T12:00:00-06:00"), o("2026-08-08T13:00:00-06:00"),
      o("2026-08-08T15:00:00-06:00"), o("2026-08-09T12:00:00-06:00"),
    ]);
    expect(hourTicks(pts, true, [12, 15])).toEqual([
      { i: 0, label: "12p" }, { i: 2, label: "3p" }, { i: 3, label: "12p" },
    ]);
  });
});

describe("localDateStr", () => {
  it("formats a local timestamp as YYYY-MM-DD", () => {
    expect(localDateStr(new Date(2026, 7, 9, 15, 30).getTime())).toBe("2026-08-09");
    expect(localDateStr(new Date(2026, 0, 1, 0, 0).getTime())).toBe("2026-01-01");
  });
});

describe("addDays", () => {
  it("adds and subtracts days with rollover", () => {
    expect(addDays("2026-08-09", 1)).toBe("2026-08-10");
    expect(addDays("2026-08-09", -1)).toBe("2026-08-08");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("dataDayRange", () => {
  it("returns first and last local dates", () => {
    expect(dataDayRange([
      o("2026-08-08T13:00:00-06:00"), o("2026-08-10T13:00:00-06:00"), o("2026-08-09T13:00:00-06:00"),
    ])).toEqual({ first: "2026-08-08", last: "2026-08-10" });
  });
  it("returns null when empty", () => expect(dataDayRange([])).toBeNull());
});

describe("sliceByDay", () => {
  it("keeps only readings on the given calendar day", () => {
    const data = [o("2026-08-08T13:00:00-06:00"), o("2026-08-09T09:00:00-06:00"), o("2026-08-09T18:00:00-06:00")];
    expect(sliceByDay(data, "2026-08-09").map((x) => x.time))
      .toEqual(["2026-08-09T09:00:00-06:00", "2026-08-09T18:00:00-06:00"]);
  });
});

describe("dayHourTicks", () => {
  it("one tick per hour across the riding window", () => {
    expect(dayHourTicks(11, 20, 1)).toEqual([
      { i: 11, label: "11a" }, { i: 12, label: "12p" }, { i: 13, label: "1p" }, { i: 14, label: "2p" },
      { i: 15, label: "3p" }, { i: 16, label: "4p" }, { i: 17, label: "5p" }, { i: 18, label: "6p" },
      { i: 19, label: "7p" }, { i: 20, label: "8p" },
    ]);
  });
  it("honors a larger step for the full-day view", () => {
    expect(dayHourTicks(0, 24, 3).map((t) => t.i)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
  });
});

describe("timeInWindow", () => {
  it("sums in-window riding readings, caps gaps at 5 min", () => {
    const data = [
      o("2026-08-08T13:00:00-06:00", 16, 20),
      o("2026-08-08T13:02:00-06:00", 16, 21),
      o("2026-08-08T13:32:00-06:00", 8, 12),
      o("2026-08-08T20:00:00-06:00", 16, 20),
    ];
    expect(timeInWindow(data, configThresholds, 11, 19, 5)).toBe(7);
  });
});
