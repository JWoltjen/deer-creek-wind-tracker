import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Verdict } from "./Verdict";

describe("Verdict", () => {
  it("shows GOOD for steady in-band wind", () => {
    render(<Verdict latest={{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 }} />);
    expect(screen.getByText(/GOOD/i)).toBeTruthy();
    expect(screen.getByText(/16–20 mph/)).toBeTruthy();
  });
  it("shows empty state", () => {
    render(<Verdict latest={null} />);
    expect(screen.getByText(/No data yet/i)).toBeTruthy();
  });
});
