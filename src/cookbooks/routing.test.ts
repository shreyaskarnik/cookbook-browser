import { describe, expect, it } from "vitest";
import { bandRule, minimumConfidenceRule } from "./routing";
import type { Answer } from "../engine";

const noul = (p: number): Answer => ({
  type: "noul", answer: p >= 0.5, probability: p, confidence: Math.max(p, 1 - p),
});
const choice = (winner: string, confidence: number): Answer => ({
  type: "choice", choice: winner, confidence,
  probabilities: { [winner]: confidence, other: 1 - confidence },
});

describe("bandRule", () => {
  const route = bandRule(0.3, 0.7);
  it("sends a probability inside the band to review", () => {
    const [item] = route({ q: noul(0.5) }, { q: "Question" });
    expect(item.disposition).toBe("review");
  });
  it("decides a probability outside the band automatically", () => {
    expect(route({ q: noul(0.95) }, { q: "Q" })[0].disposition).toBe("auto");
    expect(route({ q: noul(0.05) }, { q: "Q" })[0].disposition).toBe("auto");
  });
  it("treats both bounds as inside the band, matching the cookbook", () => {
    expect(route({ q: noul(0.3) }, { q: "Q" })[0].disposition).toBe("review");
    expect(route({ q: noul(0.7) }, { q: "Q" })[0].disposition).toBe("review");
  });
  it("uses the human label, never the raw key", () => {
    expect(route({ exclusionApplies: noul(0.9) }, { exclusionApplies: "Exclusion applies" })[0].label)
      .toBe("Exclusion applies");
  });
});

describe("minimumConfidenceRule", () => {
  const route = minimumConfidenceRule(0.6);
  it("accepts a confident choice", () => {
    expect(route({ q: choice("Remove", 0.82) }, { q: "Action" })[0].disposition).toBe("auto");
  });
  it("sends a choice below the floor to review", () => {
    expect(route({ q: choice("Remove", 0.41) }, { q: "Action" })[0].disposition).toBe("review");
  });
  it("treats the floor itself as acceptable", () => {
    expect(route({ q: choice("Remove", 0.6) }, { q: "Action" })[0].disposition).toBe("auto");
  });
  it("names the winning option in the detail, so a visitor sees what was chosen", () => {
    expect(route({ q: choice("Escalate", 0.9) }, { q: "Action" })[0].detail).toContain("Escalate");
  });
});
