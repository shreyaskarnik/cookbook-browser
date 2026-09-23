import { describe, expect, it } from "vitest";
import type { NoulAnswer } from "../engine/types";
import {
  DEFAULT_BAND,
  bandSummary,
  clampBand,
  classify,
  routeAll,
} from "./routing";

const answer = (probability: number): NoulAnswer => ({
  type: "noul",
  answer: probability >= 0.5,
  probability,
  confidence: Math.max(probability, 1 - probability),
});

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

describe("routeAll", () => {
  it("routes every answer and keeps the keys", () => {
    const routed = routeAll(
      { covered: answer(0.95), fraud: answer(0.5), excluded: answer(0.02) },
      DEFAULT_BAND
    );
    expect(routed).toEqual([
      { key: "covered", probability: 0.95, verdict: "yes" },
      { key: "fraud", probability: 0.5, verdict: "uncertain" },
      { key: "excluded", probability: 0.02, verdict: "no" },
    ]);
  });
  it("preserves insertion order so the card does not reshuffle as the slider moves", () => {
    const routed = routeAll(
      { b: answer(0.1), a: answer(0.9), c: answer(0.5) },
      DEFAULT_BAND
    );
    expect(routed.map((entry) => entry.key)).toEqual(["b", "a", "c"]);
  });
  it("returns nothing for no answers", () => {
    expect(routeAll({}, DEFAULT_BAND)).toEqual([]);
  });
});

describe("bandSummary", () => {
  it("counts each verdict and the automated share", () => {
    const routed = routeAll(
      {
        a: answer(0.95),
        b: answer(0.9),
        c: answer(0.5),
        d: answer(0.02),
      },
      DEFAULT_BAND
    );
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
