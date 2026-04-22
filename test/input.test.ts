import { describe, expect, it } from "vitest";

import { extractJsonPath, parseNumericInput } from "../src/input.js";

describe("parseNumericInput", () => {
  it("parses a direct flag value", () => {
    expect(parseNumericInput({ value: "42" })).toEqual({
      inputSource: "flag",
      value: 42,
    });
  });

  it("parses a raw number from stdin", () => {
    expect(parseNumericInput({ stdin: "  12.5\n" })).toEqual({
      inputSource: "stdin",
      value: 12.5,
    });
  });

  it("extracts a numeric value from stdin JSON", () => {
    expect(
      parseNumericInput({
        jsonPath: "metrics.current.usage",
        stdin: JSON.stringify({ metrics: { current: { usage: 87 } } }),
      })
    ).toEqual({
      inputSource: "stdin-json",
      jsonPath: "metrics.current.usage",
      value: 87,
    });
  });

  it("fails clearly when stdin looks like JSON without a path", () => {
    expect(() => parseNumericInput({ stdin: '{"value":12}' })).toThrow(
      /stdin looks like JSON/i
    );
  });

  it("rejects invalid json-path syntax", () => {
    expect(() => extractJsonPath({ value: 1 }, "data[0]")).toThrow(/simple dotted keys/i);
  });
});
