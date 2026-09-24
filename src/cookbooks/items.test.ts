import { describe, expect, it } from "vitest";
import type { Answer } from "../engine/types";
import { citationRule } from "./items";

const item = { id: "c1", fields: { claim: "A claim.", section: "A section." } };
const labelFor = () => "Citation 1";
const relation = (choice: string, confidence: number): Record<string, Answer> => ({
  relation: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } },
});

describe("citationRule", () => {
  it("auto-accepts a confident verdict and names it", () => {
    const routed = citationRule(0.8)(relation("supports", 0.93), item, labelFor);
    expect(routed.outcome).toBe("verified");
    expect(routed.disposition).toBe("auto");
  });

  it("sends the same verdict to a person below the floor", () => {
    const routed = citationRule(0.8)(relation("supports", 0.79), item, labelFor);
    expect(routed.outcome).toBe("verified");
    expect(routed.disposition).toBe("review");
  });

  it("maps each of the cookbook's three relations to its verdict", () => {
    const at = (choice: string) => citationRule(0.8)(relation(choice, 0.9), item, labelFor).outcome;
    expect(at("supports")).toBe("verified");
    expect(at("contradicts")).toBe("contradicted");
    expect(at("says_nothing")).toBe("unsupported");
  });

  it("refuses an answer that is not a choice, naming the key", () => {
    const wrong = { relation: { type: "noul", answer: true, probability: 0.9, confidence: 0.9 } } as Record<string, Answer>;
    expect(() => citationRule(0.8)(wrong, item, labelFor)).toThrow(/relation/);
  });
});

describe("citationRule's controls", () => {
  it("declares its one floor, and shades everything under it", () => {
    const controls = citationRule(0.8).controls!;
    expect(controls.parameters.map((p) => [p.name, p.value])).toEqual([["autoAccept", 0.8]]);
    expect(controls.reviewBand).toEqual({ low: 0, high: 0.8 });
  });

  it("rebuilds at a new floor, flipping a review to auto with no new answers", () => {
    const answers = relation("supports", 0.69);
    const original = citationRule(0.8)(answers, item, labelFor);
    expect(original.disposition).toBe("review");

    const rebuilt = citationRule(0.8).controls!.rebuild({ autoAccept: 0.6 });
    const routed = rebuilt(answers, item, labelFor);
    expect(routed.disposition).toBe("auto");
    expect(routed.outcome).toBe("verified");
  });

  it("falls back to the value the rule already had when handed a non-finite floor", () => {
    const rebuilt = citationRule(0.8).controls!.rebuild({ autoAccept: NaN });
    expect(rebuilt.controls!.parameters[0].value).toBe(0.8);
  });
});
