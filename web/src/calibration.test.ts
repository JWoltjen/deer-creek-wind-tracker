import { describe, it, expect } from "vitest";
import { computeGoodBand, finalBand, isCalibrated, EMPTY_PROFILE, type RiderProfile } from "./calibration";

const jeff = (skill: RiderProfile["skill"]): RiderProfile =>
  ({ kites: [12, 15], weightLb: 220, boardCm: 140, skill, lowAdjust: 0, highAdjust: 0 });

describe("computeGoodBand", () => {
  it("anchor: intermediate Jeff reproduces 15–26", () => {
    expect(computeGoodBand(jeff("intermediate"))).toEqual({ low: 15, high: 26 });
  });
  it("beginner narrows the band (higher floor, lower ceiling)", () => {
    const b = computeGoodBand(jeff("beginner"));
    expect(b.low).toBeGreaterThanOrEqual(15);
    expect(b.high).toBeLessThan(26);
  });
  it("more kites widen the band vs a single kite", () => {
    const one = computeGoodBand({ ...jeff("intermediate"), kites: [12] });
    const two = computeGoodBand(jeff("intermediate"));
    expect(two.high - two.low).toBeGreaterThan(one.high - one.low);
  });
  it("bigger board lowers the floor", () => {
    const small = computeGoodBand({ ...jeff("intermediate"), boardCm: 130 });
    const big = computeGoodBand({ ...jeff("intermediate"), boardCm: 150 });
    expect(big.low).toBeLessThanOrEqual(small.low);
  });
});

describe("finalBand / isCalibrated", () => {
  it("applies nudges", () => {
    expect(finalBand({ ...jeff("intermediate"), lowAdjust: -1, highAdjust: 2 })).toEqual({ low: 14, high: 28 });
  });
  it("isCalibrated needs kites + weight", () => {
    expect(isCalibrated(EMPTY_PROFILE)).toBe(false);
    expect(isCalibrated(jeff("intermediate"))).toBe(true);
  });
});
