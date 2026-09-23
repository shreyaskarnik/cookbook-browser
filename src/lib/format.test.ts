import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatPercent } from "./format";

describe("formatBytes", () => {
  it("uses GB above a gigabyte", () => {
    expect(formatBytes(2_300_000_000)).toBe("2.3 GB");
  });
  it("uses MB below a gigabyte", () => {
    expect(formatBytes(340_000_000)).toBe("340 MB");
  });
  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 MB");
  });
});

describe("formatPercent", () => {
  it("renders a fraction as a whole percent", () => {
    expect(formatPercent(0.732)).toBe("73%");
  });
  it("keeps a decimal below one percent so tiny probabilities are visible", () => {
    expect(formatPercent(0.004)).toBe("0.4%");
  });
  it("renders one", () => {
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("formatDuration", () => {
  it("uses milliseconds under a second", () => {
    expect(formatDuration(412)).toBe("412 ms");
  });
  it("uses seconds above a second", () => {
    expect(formatDuration(2480)).toBe("2.5 s");
  });
});
