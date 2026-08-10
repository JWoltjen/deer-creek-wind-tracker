import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CalibrationPanel } from "./CalibrationPanel";
import { EMPTY_PROFILE, type RiderProfile } from "../calibration";

const calibrated: RiderProfile = { kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 };

describe("CalibrationPanel", () => {
  it("uncalibrated shows the generic-defaults prompt", () => {
    render(<CalibrationPanel profile={EMPTY_PROFILE} update={vi.fn()} nudge={vi.fn()} />);
    expect(screen.getByText(/generic defaults/i)).toBeTruthy();
  });
  it("calibrated shows the computed range and kites", () => {
    render(<CalibrationPanel profile={calibrated} update={vi.fn()} nudge={vi.fn()} />);
    expect(screen.getByText(/15–26 mph|15–26/)).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
  });
  it("nudging high calls nudge('high', +1)", () => {
    const nudge = vi.fn();
    render(<CalibrationPanel profile={calibrated} update={vi.fn()} nudge={nudge} />);
    fireEvent.click(screen.getByRole("button", { name: "high +" }));
    expect(nudge).toHaveBeenCalledWith("high", 1);
  });
  it("adds a kite via the add button (mobile-safe)", () => {
    const update = vi.fn();
    render(<CalibrationPanel profile={EMPTY_PROFILE} update={update} nudge={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("+ add"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "add kite" }));
    expect(update).toHaveBeenCalledWith({ kites: [12] });
  });
});
