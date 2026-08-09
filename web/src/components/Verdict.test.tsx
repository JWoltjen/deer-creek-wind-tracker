import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Verdict } from "./Verdict";
import { EMPTY_PROFILE } from "../calibration";

const latest = { time: "2026-08-08T14:44:00-06:00", tempF: 95, dir: "SW", low: 16, high: 20 };

describe("Verdict", () => {
  it("shows the verdict (no kite call when uncalibrated)", () => {
    render(<Verdict latest={latest} profile={EMPTY_PROFILE} />);
    expect(screen.getByText(/Good/)).toBeTruthy();
    expect(screen.queryByText(/Rig your/)).toBeNull();
  });
  it("shows a kite call when calibrated", () => {
    render(<Verdict latest={latest} profile={{ kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 }} />);
    expect(screen.getByText(/m²/)).toBeTruthy();
  });
  it("empty state", () => {
    render(<Verdict latest={null} profile={EMPTY_PROFILE} />);
    expect(screen.getByText(/No data yet/i)).toBeTruthy();
  });
});
