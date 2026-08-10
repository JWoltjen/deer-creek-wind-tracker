import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HistoryChart } from "./HistoryChart";
import { localDateStr } from "../../chartData";
import type { Observation } from "../../types";

const obs: Observation[] = [{ time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }];
const now = Date.parse("2026-08-08T18:00:00-06:00");

describe("HistoryChart", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to Week + Riding and shows controls", () => {
    render(<HistoryChart observations={obs} nowMs={now} />);
    expect(screen.getByRole("button", { name: "Week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Riding" })).toBeTruthy();
  });
  it("switching to Month renders the month view", () => {
    const { container } = render(<HistoryChart observations={obs} nowMs={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(container.querySelector(".month-bars")).toBeTruthy();
  });
  it("restores the persisted range from storage", () => {
    localStorage.setItem("dc.chart.range", JSON.stringify("month"));
    const { container } = render(<HistoryChart observations={obs} nowMs={now} />);
    expect(container.querySelector(".month-bars")).toBeTruthy();
  });
  it("toggles the in-window chip and persists it", () => {
    render(<HistoryChart observations={obs} nowMs={now} />);
    const chip = screen.getByRole("button", { name: /in-window/i });
    expect(chip.className).not.toMatch(/ on/);
    fireEvent.click(chip);
    expect(JSON.parse(localStorage.getItem("dc.chart.inWindow")!)).toBe(true);
  });
});

describe("HistoryChart Day view", () => {
  beforeEach(() => localStorage.clear());
  const o = (time: string, low = 16, high = 20): Observation => ({ time, tempF: 90, dir: "SW", low, high });
  // now = Aug 10 ~1pm Mountain; data spans Aug 8-9 (past days) so prev is enabled, next disabled on today.
  const dayNow = Date.parse("2026-08-10T13:00:00-06:00");
  const dayData = [o("2026-08-08T13:00:00-06:00"), o("2026-08-09T12:00:00-06:00"), o("2026-08-09T15:00:00-06:00")];
  const toDay = () => fireEvent.click(screen.getByRole("button", { name: "Day" }));

  it("Day tab defaults to today and shows the stepper", () => {
    render(<HistoryChart observations={dayData} nowMs={dayNow} />);
    toDay();
    expect(screen.getByRole("button", { name: "previous day" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "next day" })).toBeTruthy();
    expect(localDateStr(dayNow)).toBe("2026-08-10");
    expect(screen.getByText("Today")).toBeTruthy();
  });
  it("next is disabled on today, prev is enabled when earlier data exists", () => {
    render(<HistoryChart observations={dayData} nowMs={dayNow} />);
    toDay();
    expect((screen.getByRole("button", { name: "next day" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "previous day" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("stepping back changes the shown day and can reach the first-data bound", () => {
    render(<HistoryChart observations={dayData} nowMs={dayNow} />);
    toDay();
    const prev = () => screen.getByRole("button", { name: "previous day" }) as HTMLButtonElement;
    fireEvent.click(prev()); // -> Aug 9
    fireEvent.click(prev()); // -> Aug 8 (first data day)
    expect(prev().disabled).toBe(true);
    expect(screen.queryByText("Today")).toBeNull();
  });
});
