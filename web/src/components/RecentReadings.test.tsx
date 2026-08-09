import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecentReadings } from "./RecentReadings";

describe("RecentReadings", () => {
  it("empty state", () => {
    render(<RecentReadings observations={[]} />);
    expect(screen.getByText(/No readings yet/i)).toBeTruthy();
  });
  it("lists newest first with a CSV button", () => {
    render(<RecentReadings observations={[
      { time: "2026-08-08T14:40:00-06:00", tempF: 90, dir: "SW", low: 12, high: 20 },
      { time: "2026-08-08T14:44:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 },
    ]} />);
    const rows = screen.getAllByText(/15–20|12–20/);
    expect(rows[0].textContent).toContain("15–20"); // newest first
    expect(screen.getByRole("button", { name: /CSV/i })).toBeTruthy();
  });
});
