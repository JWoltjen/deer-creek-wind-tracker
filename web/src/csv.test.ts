import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("emits header and rows", () => {
    const csv = toCsv([{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 15, high: 20 }]);
    expect(csv.split("\n")[0]).toBe("time,tempF,dir,low,high");
    expect(csv).toContain("2026-08-08T14:44:00-06:00,95,SW,15,20");
  });
});
