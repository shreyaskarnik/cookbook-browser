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
