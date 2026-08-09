import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MonthBars } from "./MonthBars";

describe("MonthBars", () => {
  it("empty state", () => {
    render(<MonthBars bars={[]} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders with data", () => {
    const { container } = render(<MonthBars bars={[{ date: "2026-08-08", minLull: 14, maxGust: 24, category: "gusty" }]} />);
    expect(container.querySelector(".month-bars")).toBeTruthy();
  });
});
