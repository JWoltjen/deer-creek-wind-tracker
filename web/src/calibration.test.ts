import { describe, it, expect } from "vitest";
import { computeGoodBand, finalBand, isCalibrated, EMPTY_PROFILE, recommendKite, effectiveThresholds, type RiderProfile } from "./calibration";
import { configThresholds } from "./classify";

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

describe("recommendKite", () => {
  const kites = [12, 15], w = 220; // 12: ~16.6–26, 15: ~14.9–23.2
  it("light wind → biggest kite", () => {
    expect(recommendKite(kites, w, 16).note).toMatch(/15 m²/);
  });
  it("in both ranges → best powered, notes the other", () => {
    const r = recommendKite(kites, w, 20);
    expect(r.kite).not.toBeNull();
    expect(r.note).toMatch(/m²/);
  });
  it("below all → too light", () => {
    expect(recommendKite(kites, w, 10)).toEqual({ kite: null, note: "Too light for your kites." });
  });
  it("above all → overpowered, smallest kite", () => {
    const r = recommendKite(kites, w, 32);
    expect(r.kite).toBe(12);
    expect(r.note).toMatch(/Overpowered/);
  });
  it("no kites → null", () => {
    expect(recommendKite([], w, 20).kite).toBeNull();
  });
});

describe("effectiveThresholds", () => {
  it("uses config when uncalibrated", () => {
    expect(effectiveThresholds(EMPTY_PROFILE)).toEqual(configThresholds);
  });
  it("uses the rider band when calibrated", () => {
    const t = effectiveThresholds({ kites: [12, 15], weightLb: 220, boardCm: 140, skill: "intermediate", lowAdjust: 0, highAdjust: 0 });
    expect(t.goodLowMph).toBe(15);
    expect(t.goodHighMph).toBe(26);
    expect(t.steadySpreadMax).toBe(configThresholds.steadySpreadMax);
  });
});
