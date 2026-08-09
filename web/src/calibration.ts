export type Skill = "beginner" | "intermediate" | "advanced";

export interface RiderProfile {
  kites: number[]; weightLb: number; boardCm: number; skill: Skill; lowAdjust: number; highAdjust: number;
}

export const EMPTY_PROFILE: RiderProfile = {
  kites: [], weightLb: 0, boardCm: 138, skill: "intermediate", lowAdjust: 0, highAdjust: 0,
};

const REF_MID_MPH = 18, REF_WEIGHT_LB = 165, REF_AREA_M2 = 12;
const KITE_LOW_FACTOR = 0.80, KITE_HIGH_FACTOR = 1.25;
const REF_BOARD_CM = 138, BOARD_MPH_PER_CM = 0.06, BOARD_MAX_ADJ = 3;
const SKILL_DELTA: Record<Skill, { low: number; high: number }> = {
  beginner: { low: 1, high: -3 }, intermediate: { low: 0, high: 0 }, advanced: { low: -1, high: 2 },
};

export function isCalibrated(p: RiderProfile): boolean {
  return p.kites.length > 0 && p.weightLb > 0;
}

export function kiteRange(weightLb: number, area: number): { low: number; high: number } {
  const mid = REF_MID_MPH * Math.sqrt((weightLb / REF_WEIGHT_LB) * (REF_AREA_M2 / area));
  return { low: mid * KITE_LOW_FACTOR, high: mid * KITE_HIGH_FACTOR };
}

export function computeGoodBand(p: RiderProfile): { low: number; high: number } {
  const ranges = p.kites.map((a) => kiteRange(p.weightLb, a));
  let low = Math.min(...ranges.map((r) => r.low));
  let high = Math.max(...ranges.map((r) => r.high));
  const boardAdj = Math.min(BOARD_MAX_ADJ, Math.max(0, (p.boardCm - REF_BOARD_CM) * BOARD_MPH_PER_CM));
  low -= boardAdj;
  low += SKILL_DELTA[p.skill].low;
  high += SKILL_DELTA[p.skill].high;
  low = Math.round(low); high = Math.round(high);
  if (high <= low) high = low + 1;
  return { low, high };
}

export function finalBand(p: RiderProfile): { low: number; high: number } {
  const b = computeGoodBand(p);
  return { low: b.low + p.lowAdjust, high: b.high + p.highAdjust };
}
