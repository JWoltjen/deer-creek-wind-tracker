import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HistoryChart } from "./HistoryChart";
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
