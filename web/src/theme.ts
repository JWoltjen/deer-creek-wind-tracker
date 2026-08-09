import type { Category } from "./classify";

export const categoryColor: Record<Category, string> = {
  good: "#22d3ee",
  gusty: "#f59e0b",
  strong: "#ef4444",
  light: "#334155",
};

export const CAT_LABEL: Record<Category, string> = {
  good: "Good",
  gusty: "Gusty",
  light: "Too light",
  strong: "Strong",
};
