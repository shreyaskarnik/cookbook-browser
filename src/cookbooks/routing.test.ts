import { describe, expect, it } from "vitest";
import consistencyChoice from "./consistencyChoice";
import consistencyNoul from "./consistencyNoul";
import guardrails from "./guardrails";
import { bandRule, hazardRule, minimumConfidenceRule } from "./routing";
import type { Answer } from "../engine";

const noul = (p: number): Answer => ({
  type: "noul", answer: p >= 0.5, probability: p, confidence: Math.max(p, 1 - p),
});
const sevAnswer = (score: number): Answer => ({
  type: "score", score, normalized: score / 3,
  level: ["none", "mild", "serious", "severe"][Math.round(score)],
  confidence: 0.8, probabilities: { none: 0.1, mild: 0.2, serious: 0.4, severe: 0.3 },
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
    expect(item.outcome).toBe("Review");
    expect(item.detail).toBe("50%");
  });
  it("decides a probability outside the band automatically", () => {
    const high = route({ q: noul(0.95) }, { q: "Q" })[0];
    const low = route({ q: noul(0.05) }, { q: "Q" })[0];
    expect(high.disposition).toBe("auto");
    expect(high.value).toBe(0.95);
    expect(high.outcome).toBe("Yes");
    expect(high.detail).toBe("95%");
    expect(low.disposition).toBe("auto");
    expect(low.value).toBe(0.05);
    expect(low.outcome).toBe("No");
    expect(low.detail).toBe("5%");
  });
  it("gives every routed row a word of its own, not only a disposition", () => {
    const routed = route({ covered: noul(0.95) }, { covered: "Covered" });
    expect(routed[0].outcome).toBe("Yes");
    expect(routed[0].detail).toBe("95%");
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
  it("names the winning option as the outcome, so a visitor sees what was chosen", () => {
    expect(route({ q: choice("Escalate", 0.9) }, { q: "Action" })[0].outcome).toBe("Escalate");
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
    expect(items.find((i) => i.key === "jailbreak")!.outcome).toBe("Block");
  });

  it("escalates every review to a block once severity reaches the override", () => {
    const items = route({ jailbreak: noul(0.4), severity: sev(2.5) }, { jailbreak: "Jailbreak", severity: "Severity" });
    expect(items.find((i) => i.key === "jailbreak")!.outcome).toBe("Block");
  });

  it("says 'Block' on a severity override, where the disposition alone says only 'auto'", () => {
    const routed = route({ jailbreak: noul(0.41), severity: sev(2.22) }, { jailbreak: "Jailbreak", severity: "Severity" });
    const row = routed.find((entry) => entry.key === "jailbreak")!;
    expect(row.outcome).toBe("Block");
    expect(row.disposition).toBe("auto");
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
    expect(item.outcome).toBe("Block");
    expect(item.detail).toBe("69%");
  });

  it("the same 69% stays under review when severity does not reach the override", () => {
    const items = route(
      { jailbreak: noul(0.69), severity: sev(0.13) },
      { jailbreak: "Jailbreak", severity: "Severity" }
    );
    const item = items.find((i) => i.key === "jailbreak")!;
    expect(item.disposition).toBe("review");
    expect(item.outcome).toBe("Review");
    expect(item.detail).toBe("69%");
  });

  it("takes the severity outcome up to its first colon, since AnswersPane's column is narrow", () => {
    const sentence: Answer = {
      type: "score",
      score: 2,
      normalized: 2 / 3,
      level: "Serious: complying enables real wrongdoing or gives unsafe personal advice",
      confidence: 0.8,
      probabilities: { none: 0.1, mild: 0.2, serious: 0.4, severe: 0.3 },
    };
    const items = route({ jailbreak: noul(0.1), severity: sentence }, { jailbreak: "Jailbreak", severity: "Severity" });
    const row = items.find((i) => i.key === "severity")!;
    expect(row.outcome).toBe("Serious");
    expect(row.detail).toBe("");
  });

  it("leaves a severity level with no colon unchanged, rather than emptying it", () => {
    const items = route({ jailbreak: noul(0.1), severity: sev(0) }, { jailbreak: "Jailbreak", severity: "Severity" });
    const row = items.find((i) => i.key === "severity")!;
    expect(row.outcome).toBe("none");
    expect(row.detail).toBe("");
  });
});

describe("declared parameters", () => {
  it("lets bandRule name its own two bounds, at the values it was built with", () => {
    const controls = bandRule(0.3, 0.7).controls!;
    expect(controls.parameters.map((p) => [p.name, p.value])).toEqual([
      ["low", 0.3],
      ["high", 0.7],
    ]);
    expect(controls.reviewBand).toEqual({ low: 0.3, high: 0.7 });
  });

  it("rebuilds a band rule at new bounds, routing the same answer differently", () => {
    const widened = bandRule(0.3, 0.7).controls!.rebuild({ low: 0.3, high: 0.99 });
    expect(widened({ q: noul(0.95) }, { q: "Q" })[0].disposition).toBe("review");
    expect(bandRule(0.3, 0.7)({ q: noul(0.95) }, { q: "Q" })[0].disposition).toBe("auto");
  });

  it("swaps a crossed band and reports where it actually put the bounds", () => {
    const rebuilt = bandRule(0.3, 0.7).controls!.rebuild({ low: 0.8, high: 0.2 });
    expect(rebuilt.controls!.parameters.map((p) => p.value)).toEqual([0.2, 0.8]);
  });

  it("keeps a rebuilt rule adjustable, so a control can be moved twice", () => {
    const once = bandRule(0.3, 0.7).controls!.rebuild({ low: 0.1, high: 0.9 });
    const twice = once.controls!.rebuild({ low: 0.1, high: 0.4 });
    expect(twice.controls!.parameters.map((p) => p.value)).toEqual([0.1, 0.4]);
  });

  it("lets minimumConfidenceRule name its one floor, and shade everything under it", () => {
    const controls = minimumConfidenceRule(0.6).controls!;
    expect(controls.parameters.map((p) => [p.name, p.value])).toEqual([["floor", 0.6]]);
    expect(controls.reviewBand).toEqual({ low: 0, high: 0.6 });

    const strict = controls.rebuild({ floor: 0.95 });
    expect(strict({ q: choice("Remove", 0.82) }, { q: "Action" })[0].disposition).toBe("review");
  });

  it("lets hazardRule name all three of its thresholds, and prints the override as a score", () => {
    const controls = hazardRule(0.35, 0.7, 2.0, "severity").controls!;
    expect(controls.parameters.map((p) => [p.name, p.value])).toEqual([
      ["review", 0.35],
      ["action", 0.7],
      ["severityBlock", 2],
    ]);
    // A severity runs 0..3 over four levels, so it is not a percentage.
    const override = controls.parameters.find((p) => p.name === "severityBlock")!;
    expect(override.format).toBe("number");
    expect(override.max).toBe(3);
    // No single shaded region: the severity row is measured on a normalized
    // score rather than a hazard probability.
    expect(controls.reviewBand).toBeUndefined();
  });

  it("rebuilds a hazard rule at a new override without re-stating which question is the severity", () => {
    const lenient = hazardRule(0.35, 0.7, 2.0, "severity").controls!.rebuild({
      review: 0.35,
      action: 0.7,
      severityBlock: 3,
    });
    const items = lenient(
      { jailbreak: noul(0.69), severity: sevAnswer(2.22) },
      { jailbreak: "Jailbreak", severity: "Severity" }
    );
    // 2.22 no longer reaches the override, so the review is no longer forced
    // into a block — and the severity question is still judged as a score.
    expect(items.find((i) => i.key === "jailbreak")!.disposition).toBe("review");
    expect(items.find((i) => i.key === "severity")!.disposition).toBe("auto");
  });

  it("falls back to the value the rule already had when a control hands over a non-finite number", () => {
    const rebuilt = minimumConfidenceRule(0.6).controls!.rebuild({ floor: NaN });
    expect(rebuilt.controls!.parameters[0].value).toBe(0.6);
  });

  it("holds a threshold inside its declared range", () => {
    const rebuilt = hazardRule(0.35, 0.7, 2.0, "severity").controls!.rebuild({
      review: -5,
      action: 9,
      severityBlock: 99,
    });
    expect(rebuilt.controls!.parameters.map((p) => p.value)).toEqual([0, 1, 3]);
  });
});

describe("the thresholds each cookbook publishes", () => {
  const valuesOf = (rule: { controls?: { parameters: readonly { name: string; value: number }[] } }) =>
    Object.fromEntries(rule.controls!.parameters.map((p) => [p.name, p.value]));

  it("starts Self-consistency: nouls at the cookbook's 0.30 / 0.70 band", () => {
    expect(valuesOf(consistencyNoul.routing)).toEqual({ low: 0.3, high: 0.7 });
  });

  it("starts Self-consistency: choices at the cookbook's 0.60 floor", () => {
    expect(valuesOf(consistencyChoice.routing)).toEqual({ floor: 0.6 });
  });

  it("starts Guardrails for LLMs at the cookbook's 0.35 / 0.70 / 2.0", () => {
    expect(valuesOf(guardrails.routing)).toEqual({
      review: 0.35,
      action: 0.7,
      severityBlock: 2,
    });
  });
});
