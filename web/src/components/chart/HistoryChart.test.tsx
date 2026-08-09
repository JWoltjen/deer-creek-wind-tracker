import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HistoryChart } from "./HistoryChart";
import type { Observation } from "../../types";

const obs: Observation[] = [{ time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }];
const now = Date.parse("2026-08-08T18:00:00-06:00");

describe("HistoryChart", () => {
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
});
