import { describe, it, expect } from "vitest";
import { localHour, localDate, hourPattern, actualDailyPeak, scoreboard, forecastDailyPeak } from "./analytics";
import type { Observation, Forecast } from "./types";

const obs = (time: string, low: number, high: number): Observation =>
  ({ time, tempF: 90, dir: "SW", low, high });

describe("time helpers", () => {
  it("localHour uses the string's own offset", () =>
    expect(localHour("2026-08-08T14:44:00-06:00")).toBe(14));
  it("localDate", () => expect(localDate("2026-08-08T14:44:00-06:00")).toBe("2026-08-08"));
});

describe("hourPattern", () => {
  it("averages mid per hour", () => {
    const p = hourPattern([
      obs("2026-08-08T14:00:00-06:00", 10, 20), // mid 15
      obs("2026-08-08T14:30:00-06:00", 20, 30), // mid 25
    ]);
    const h14 = p.find((x) => x.hour === 14)!;
    expect(h14.avgMid).toBe(20);
    expect(h14.count).toBe(2);
  });
});

describe("actualDailyPeak", () => {
  it("takes daytime max mid", () => {
    const m = actualDailyPeak([
      obs("2026-08-08T07:00:00-06:00", 30, 30), // before window -> ignored
      obs("2026-08-08T14:00:00-06:00", 18, 22), // mid 20
      obs("2026-08-08T15:00:00-06:00", 10, 12), // mid 11
    ]);
    expect(m.get("2026-08-08")).toBe(20);
  });
});

describe("scoreboard", () => {
  it("computes MAE per model, best first", () => {
    const observations = [obs("2026-08-08T14:00:00-06:00", 18, 22)]; // actual peak 20
    const forecasts: Forecast[] = [
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T14:00", windMph: 18, gustMph: null, dirDeg: 225 },
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "nws", model: "nws",
        validTime: "2026-08-08T14:00:00-06:00", windMph: 10, gustMph: null, dirDeg: 225 },
    ];
    const board = scoreboard(observations, forecasts);
    expect(board[0].key).toBe("open-meteo/ecmwf"); // |18-20|=2 beats |10-20|=10
    expect(board[0].mae).toBe(2);
  });
});

describe("forecastDailyPeak", () => {
  it("uses only the latest pre-day snapshot, ignoring older and same-day fetches", () => {
    const forecasts: Forecast[] = [
      // older snapshot (2026-08-07T06:00) — should be ignored even though its value is higher
      { fetchedAt: "2026-08-07T06:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T14:00:00-06:00", windMph: 99, gustMph: null, dirDeg: 0 },
      // newer pre-day snapshot (2026-08-07T18:00) — should win; max of its in-window hours
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T14:00:00-06:00", windMph: 18, gustMph: null, dirDeg: 0 },
      { fetchedAt: "2026-08-07T18:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T15:00:00-06:00", windMph: 22, gustMph: null, dirDeg: 0 },
      // same-day fetch — must be excluded
      { fetchedAt: "2026-08-08T01:00:00-06:00", source: "open-meteo", model: "ecmwf",
        validTime: "2026-08-08T14:00:00-06:00", windMph: 50, gustMph: null, dirDeg: 0 },
    ];
    const m = forecastDailyPeak(forecasts);
    expect(m.get("2026-08-08")?.get("open-meteo/ecmwf")).toBe(22);
  });

  it("keeps an evening-fetched next-day forecast when fetchedAt is Mountain Time", () => {
    const forecasts: Forecast[] = [
      { fetchedAt: "2026-08-08T20:00:00-06:00", source: "open-meteo", model: "gfs",
        validTime: "2026-08-09T14:00:00-06:00", windMph: 17, gustMph: null, dirDeg: 0 },
    ];
    const m = forecastDailyPeak(forecasts);
    expect(m.get("2026-08-09")?.get("open-meteo/gfs")).toBe(17);
  });
});
