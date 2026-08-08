import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HourPattern } from "./HourPattern";

describe("HourPattern", () => {
  it("empty state", () => {
    render(<HourPattern observations={[]} />);
    expect(screen.getByText(/Not enough data yet/i)).toBeTruthy();
  });
  it("renders with data", () => {
    const { container } = render(
      <HourPattern observations={[{ time: "2026-08-08T14:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]} />
    );
    expect(container.querySelector(".hour-pattern")).toBeTruthy();
  });
});
