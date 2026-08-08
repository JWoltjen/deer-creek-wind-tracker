import { describe, it, expect } from "vitest";
import { parseNdjson } from "./ndjson";

describe("parseNdjson", () => {
  it("parses lines and ignores blanks/trailing newline", () => {
    const text = `{"a":1}\n{"a":2}\n\n`;
    expect(parseNdjson<{ a: number }>(text)).toEqual([{ a: 1 }, { a: 2 }]);
  });
  it("returns [] for empty input", () => {
    expect(parseNdjson("")).toEqual([]);
  });
});
