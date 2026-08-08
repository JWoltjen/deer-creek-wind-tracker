import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HistoryChart } from "./HistoryChart";

describe("HistoryChart", () => {
  it("empty state", () => {
    render(<HistoryChart observations={[]} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders a chart container with data", () => {
    const { container } = render(
      <HistoryChart observations={[{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]} />
    );
    expect(container.querySelector(".history-chart")).toBeTruthy();
  });
});
