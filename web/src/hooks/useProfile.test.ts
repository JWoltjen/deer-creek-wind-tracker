import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfile } from "./useProfile";

describe("useProfile", () => {
  beforeEach(() => localStorage.clear());
  it("starts empty and persists updates", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.update({ weightLb: 220, kites: [12, 15] }));
    expect(result.current.profile.weightLb).toBe(220);
    expect(JSON.parse(localStorage.getItem("dc.profile")!).kites).toEqual([12, 15]);
  });
  it("nudge changes adjust; gear change resets nudges", () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current.update({ weightLb: 220, kites: [12] }));
    act(() => result.current.nudge("high", 2));
    expect(result.current.profile.highAdjust).toBe(2);
    act(() => result.current.update({ kites: [12, 15] })); // gear change
    expect(result.current.profile.highAdjust).toBe(0);
  });
});
