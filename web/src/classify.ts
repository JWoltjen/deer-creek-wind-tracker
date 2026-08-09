import { config } from "./config";

export type Category = "good" | "gusty" | "light" | "strong";
export type DirRating = "ideal" | "ok" | "off";

export function classify(low: number, high: number): Category {
  const mid = (low + high) / 2;
  const spread = high - low;
  if (high < config.goodLowMph) return "light";
  if (mid > config.goodHighMph || spread > config.gustySpreadMax) return "strong";
  if (spread <= config.steadySpreadMax) return "good";
  return "gusty";
}

export function rateDirection(dir: string): DirRating {
  const d = dir.toUpperCase();
  if ((config.idealDirs as readonly string[]).includes(d)) return "ideal";
  if ((config.okDirs as readonly string[]).includes(d)) return "ok";
  return "off";
}

export function steadiness(low: number, high: number): "steady" | "a bit gusty" | "gusty" {
  const spread = high - low;
  if (spread <= config.steadySpreadMax) return "steady";
  if (spread <= config.gustySpreadMax) return "a bit gusty";
  return "gusty";
}
