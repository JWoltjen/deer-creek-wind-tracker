import { describe, it, expect } from "vitest";
import { categoryColor, CAT_LABEL } from "./theme";

describe("theme", () => {
  it("maps every category to a color", () => {
    expect(categoryColor.good).toBe("#22d3ee");
    expect(categoryColor.gusty).toBe("#f59e0b");
    expect(categoryColor.strong).toBe("#ef4444");
    expect(categoryColor.light).toBe("#334155");
  });
  it("has a human label per category", () => {
    expect(CAT_LABEL.good).toBe("Good");
    expect(CAT_LABEL.light).toBe("Too light");
  });
});
