import { describe, it, expect } from "vitest";
import { classify, rateDirection, steadiness } from "./classify";

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
