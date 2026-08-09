import { describe, it, expect } from "vitest";
import { formatHourShort, formatHour12, relativeAge } from "./format";

describe("format", () => {
  it("formatHourShort", () => {
    expect(formatHourShort(13)).toBe("1p");
    expect(formatHourShort(0)).toBe("12a");
    expect(formatHourShort(12)).toBe("12p");
    expect(formatHourShort(23)).toBe("11p");
  });
  it("formatHour12", () => {
    expect(formatHour12(13)).toBe("1 PM");
    expect(formatHour12(0)).toBe("12 AM");
    expect(formatHour12(12)).toBe("12 PM");
  });
  it("relativeAge", () => {
    const now = Date.parse("2026-08-09T12:45:00-06:00");
    expect(relativeAge("2026-08-09T12:45:00-06:00", now)).toBe("just now");
    expect(relativeAge("2026-08-09T12:17:00-06:00", now)).toBe("28 min ago");
    expect(relativeAge("2026-08-09T10:30:00-06:00", now)).toBe("2h 15m ago");
  });
});
