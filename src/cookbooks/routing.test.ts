import { describe, expect, it } from "vitest";
import { bandRule, hazardRule, minimumConfidenceRule } from "./routing";
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
    expect(item.value).toBe(0.5);
    expect(item.detail).toBe("Review (50%)");
  });
  it("decides a probability outside the band automatically", () => {
    const high = route({ q: noul(0.95) }, { q: "Q" })[0];
    const low = route({ q: noul(0.05) }, { q: "Q" })[0];
    expect(high.disposition).toBe("auto");
    expect(high.value).toBe(0.95);
    expect(high.detail).toBe("Yes (95%)");
    expect(low.disposition).toBe("auto");
    expect(low.value).toBe(0.05);
    expect(low.detail).toBe("No (5%)");
  });
  it("treats both bounds as inside the band, matching the cookbook", () => {
    expect(route({ q: noul(0.3) }, { q: "Q" })[0].disposition).toBe("review");
    expect(route({ q: noul(0.7) }, { q: "Q" })[0].disposition).toBe("review");
  });
  it("uses the human label, never the raw key", () => {
    expect(route({ exclusionApplies: noul(0.9) }, { exclusionApplies: "Exclusion applies" })[0].label)
      .toBe("Exclusion applies");
  });
  it("throws naming the key when no label is provided, rather than emitting the raw key", () => {
    expect(() => route({ exclusionApplies: noul(0.9) }, {})).toThrow(/exclusionApplies/);
  });
});

describe("minimumConfidenceRule", () => {
  const route = minimumConfidenceRule(0.6);
  it("accepts a confident choice", () => {
    const [item] = route({ q: choice("Remove", 0.82) }, { q: "Action" });
    expect(item.disposition).toBe("auto");
    expect(item.value).toBe(0.82);
  });
  it("sends a choice below the floor to review", () => {
    const [item] = route({ q: choice("Remove", 0.41) }, { q: "Action" });
    expect(item.disposition).toBe("review");
    expect(item.value).toBe(0.41);
  });
  it("treats the floor itself as acceptable", () => {
    expect(route({ q: choice("Remove", 0.6) }, { q: "Action" })[0].disposition).toBe("auto");
  });
  it("names the winning option in the detail, so a visitor sees what was chosen", () => {
    expect(route({ q: choice("Escalate", 0.9) }, { q: "Action" })[0].detail).toContain("Escalate");
  });
  it("throws naming the key when no label is provided, rather than emitting the raw key", () => {
    expect(() => route({ recommendedAction: choice("Escalate", 0.9) }, {})).toThrow(/recommendedAction/);
  });
});

describe("hazardRule", () => {
  const route = hazardRule(0.35, 0.7, 2.0, "severity");
  const sev = (score: number): Answer => ({
    type: "score", score, normalized: score / 3, level: ["none", "mild", "serious", "severe"][Math.round(score)],
    confidence: 0.8, probabilities: { none: 0.1, mild: 0.2, serious: 0.4, severe: 0.3 },
  });

  it("leaves a hazard below the review threshold alone", () => {
    const items = route({ jailbreak: noul(0.1), severity: sev(0) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "jailbreak")!.disposition).toBe("auto");
  });

  it("sends a hazard at or above the review threshold to a person", () => {
    const items = route({ jailbreak: noul(0.4), severity: sev(0) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "jailbreak")!.disposition).toBe("review");
  });

  it("marks a hazard above the action threshold as actionable, not merely reviewable", () => {
    const items = route({ jailbreak: noul(0.9), severity: sev(0) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "jailbreak")!.detail).toMatch(/block|action/i);
  });

  it("escalates every review to a block once severity reaches the override", () => {
    const items = route({ jailbreak: noul(0.4), severity: sev(2.5) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "jailbreak")!.detail).toMatch(/block/i);
  });

  it("does not route the severity score itself as a hazard", () => {
    const items = route({ jailbreak: noul(0.1), severity: sev(3) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "severity")!.disposition).toBe("auto");
  });

  // The real measured case (see guardrails.ts's `requires.why`): jailbreak at
  // 69% with severity reaching 2.22 under this cookbook's own thresholds.
  it("renders a severity-forced block the same disposition as an action-threshold block", () => {
    const items = route(
      { jailbreak: noul(0.69), severity: sev(2.22) },
      { jailbreak: "Jailbreak", severity: "Severity" }
    );
    const item = items.find((i) => i.key === "jailbreak")!;
    expect(item.disposition).toBe("auto");
    expect(item.detail).toBe("69% — block (severity)");
  });

  it("the same 69% stays under review when severity does not reach the override", () => {
    const items = route(
      { jailbreak: noul(0.69), severity: sev(0.13) },
      { jailbreak: "Jailbreak", severity: "Severity" }
    );
    const item = items.find((i) => i.key === "jailbreak")!;
    expect(item.disposition).toBe("review");
    expect(item.detail).toBe("69% — review");
  });

  it("takes the severity detail up to its first colon, since AnswersPane's column is narrow", () => {
    const sentence: Answer = {
      type: "score",
      score: 2,
      normalized: 2 / 3,
      level: "Serious: complying enables real wrongdoing or gives unsafe personal advice",
      confidence: 0.8,
      probabilities: { none: 0.1, mild: 0.2, serious: 0.4, severe: 0.3 },
    };
    const items = route({ jailbreak: noul(0.1), severity: sentence }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "severity")!.detail).toBe("Serious");
  });

  it("leaves a severity level with no colon unchanged, rather than emptying it", () => {
    const items = route({ jailbreak: noul(0.1), severity: sev(0) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "severity")!.detail).toBe("none");
  });
});
