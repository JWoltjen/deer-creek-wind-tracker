import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Verdict } from "./Verdict";

describe("Verdict", () => {
  it("shows category label, lull–gust, and steadiness", () => {
    render(<Verdict latest={{ time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 }} />);
    expect(screen.getByText(/Good/)).toBeTruthy();
    const numContainer = screen.getByText(/16/).closest(".verdict-num");
    expect(numContainer?.textContent).toMatch(/16–20\s+mph/);
    expect(screen.getByText(/steady/)).toBeTruthy();
  });
  it("empty state", () => {
    render(<Verdict latest={null} />);
    expect(screen.getByText(/No data yet/i)).toBeTruthy();
  });
});
