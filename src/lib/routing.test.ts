import { describe, expect, it } from "vitest";
import { DEFAULT_BAND, bandSummary, clampBand, classify } from "./routing";
import type { RoutedQuestion } from "./routing";

describe("classify", () => {
  it("calls a low probability no", () => {
    expect(classify(0.05, DEFAULT_BAND)).toBe("no");
  });
  it("calls a high probability yes", () => {
    expect(classify(0.95, DEFAULT_BAND)).toBe("yes");
  });
  it("calls a middling probability uncertain", () => {
    expect(classify(0.5, DEFAULT_BAND)).toBe("uncertain");
  });
  it("treats both bounds as inside the band, matching the cookbook", () => {
    expect(classify(0.3, DEFAULT_BAND)).toBe("uncertain");
    expect(classify(0.7, DEFAULT_BAND)).toBe("uncertain");
  });
  it("decides everything when the band is closed to nothing", () => {
    const closed = { low: 0, high: 0 };
    expect(classify(0.4, closed)).toBe("yes");
    expect(classify(0, closed)).toBe("uncertain");
  });
  it("escalates everything when the band spans the range", () => {
    expect(classify(0.99, { low: 0, high: 1 })).toBe("uncertain");
    expect(classify(0.01, { low: 0, high: 1 })).toBe("uncertain");
  });
});

describe("clampBand", () => {
  it("keeps a sane band as it is", () => {
    expect(clampBand({ low: 0.2, high: 0.8 })).toEqual({ low: 0.2, high: 0.8 });
  });
  it("swaps a crossed band rather than producing an empty one", () => {
    expect(clampBand({ low: 0.8, high: 0.2 })).toEqual({ low: 0.2, high: 0.8 });
  });
  it("holds the bounds inside zero and one", () => {
    expect(clampBand({ low: -0.5, high: 1.5 })).toEqual({ low: 0, high: 1 });
  });
  it("replaces NaN low with the default, leaving high unchanged", () => {
    const clamped = clampBand({ low: NaN, high: 0.7 });
    expect(clamped).toEqual({ low: 0.3, high: 0.7 });
    // Verify it still classifies high probability as "yes" and low as "no"
    expect(classify(0.95, clamped)).toBe("yes");
    expect(classify(0.05, clamped)).toBe("no");
  });
  it("replaces NaN high with the default, leaving low unchanged", () => {
    const clamped = clampBand({ low: 0.2, high: NaN });
    expect(clamped).toEqual({ low: 0.2, high: 0.7 });
    expect(classify(0.95, clamped)).toBe("yes");
    expect(classify(0.05, clamped)).toBe("no");
  });
  it("replaces both NaN bounds with their defaults", () => {
    const clamped = clampBand({ low: NaN, high: NaN });
    expect(clamped).toEqual({ low: 0.3, high: 0.7 });
    expect(classify(0.95, clamped)).toBe("yes");
    expect(classify(0.05, clamped)).toBe("no");
  });
  it("replaces Infinity with the default, clamping +Infinity to 1 via default then clamping", () => {
    const clamped = clampBand({ low: Infinity, high: -Infinity });
    // Both become defaults, then clamped to 0..1
    expect(clamped).toEqual({ low: 0.3, high: 0.7 });
  });
  it("handles -Infinity the same way", () => {
    const clamped = clampBand({ low: -Infinity, high: 0.5 });
    expect(clamped.low).toEqual(0.3);
    expect(clamped.high).toEqual(0.5);
  });
});

describe("bandSummary", () => {
  it("counts each verdict and the automated share", () => {
    const routed: RoutedQuestion[] = [
      { key: "a", probability: 0.95, verdict: "yes" },
      { key: "b", probability: 0.9, verdict: "yes" },
      { key: "c", probability: 0.5, verdict: "uncertain" },
      { key: "d", probability: 0.02, verdict: "no" },
    ];
    expect(bandSummary(routed)).toEqual({
      yes: 2,
      no: 1,
      uncertain: 1,
      automatedShare: 0.75,
    });
  });
  it("reports a zero share for nothing, without dividing by zero", () => {
    expect(bandSummary([])).toEqual({
      yes: 0,
      no: 0,
      uncertain: 0,
      automatedShare: 0,
    });
  });
});
