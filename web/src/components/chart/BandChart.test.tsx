import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BandChart } from "./BandChart";
import { bandPoints } from "../../chartData";

describe("BandChart", () => {
  it("empty state", () => {
    render(<BandChart points={[]} showDayLabels={false} />);
    expect(screen.getByText(/No history yet/i)).toBeTruthy();
  });
  it("renders a container with data", () => {
    const pts = bandPoints([{ time: "2026-08-08T13:00:00-06:00", tempF: 90, dir: "SW", low: 15, high: 20 }]);
    const { container } = render(<BandChart points={pts} showDayLabels={true} />);
    expect(container.querySelector(".band-chart")).toBeTruthy();
  });
});
