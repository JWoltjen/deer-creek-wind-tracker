import { describe, it, expect } from "vitest";
import { classify, rateDirection, steadiness, configThresholds, type Thresholds } from "./classify";

describe("classify", () => {
  it("good: steady, in band", () => expect(classify(16, 20)).toBe("good"));
  it("gusty: in band, spread 6-10", () => expect(classify(12, 20)).toBe("gusty"));
  it("light: high below floor", () => expect(classify(8, 12)).toBe("light"));
  it("strong: mid above ceiling", () => expect(classify(26, 32)).toBe("strong"));
  it("strong: spread over gusty max", () => expect(classify(10, 24)).toBe("strong"));
});

describe("rateDirection", () => {
  it("ideal SW", () => expect(rateDirection("SW")).toBe("ideal"));
  it("ok S", () => expect(rateDirection("S")).toBe("ok"));
  it("off N", () => expect(rateDirection("N")).toBe("off"));
});

describe("steadiness", () => {
  it("steady when spread within steadyMax", () => expect(steadiness(16, 20)).toBe("steady"));
  it("a bit gusty in the middle band", () => expect(steadiness(12, 20)).toBe("a bit gusty"));
  it("gusty above gustyMax", () => expect(steadiness(8, 22)).toBe("gusty"));
});

describe("classify with custom thresholds", () => {
  const t: Thresholds = { goodLowMph: 20, goodHighMph: 30, steadySpreadMax: 3, gustySpreadMax: 8 };
  it("uses passed thresholds, not config", () => {
    expect(classify(16, 19, t)).toBe("light");   // high 19 < 20 → light under custom band
    expect(classify(22, 25, t)).toBe("good");     // in 20–30, spread 3 ≤ 3
  });
  it("defaults to config when omitted", () => {
    expect(classify(16, 20)).toBe("good");        // config band 15–26
  });
  it("steadiness respects thresholds", () => {
    expect(steadiness(20, 24, t)).toBe("a bit gusty"); // spread 4 > 3, ≤ 8
    expect(configThresholds.goodLowMph).toBe(15);
  });
});
