import { config } from "./config";

export type Category = "good" | "gusty" | "light" | "strong";
export type DirRating = "ideal" | "ok" | "off";

export interface Thresholds {
  goodLowMph: number; goodHighMph: number; steadySpreadMax: number; gustySpreadMax: number;
}
export const configThresholds: Thresholds = {
  goodLowMph: config.goodLowMph, goodHighMph: config.goodHighMph,
  steadySpreadMax: config.steadySpreadMax, gustySpreadMax: config.gustySpreadMax,
};

export function classify(low: number, high: number, t: Thresholds = configThresholds): Category {
  const mid = (low + high) / 2;
  const spread = high - low;
  if (high < t.goodLowMph) return "light";
  if (mid > t.goodHighMph || spread > t.gustySpreadMax) return "strong";
  if (spread <= t.steadySpreadMax) return "good";
  return "gusty";
}

export function rateDirection(dir: string): DirRating {
  const d = dir.toUpperCase();
  if ((config.idealDirs as readonly string[]).includes(d)) return "ideal";
  if ((config.okDirs as readonly string[]).includes(d)) return "ok";
  return "off";
}

export function steadiness(low: number, high: number, t: Thresholds = configThresholds): "steady" | "a bit gusty" | "gusty" {
  const spread = high - low;
  if (spread <= t.steadySpreadMax) return "steady";
  if (spread <= t.gustySpreadMax) return "a bit gusty";
  return "gusty";
}
