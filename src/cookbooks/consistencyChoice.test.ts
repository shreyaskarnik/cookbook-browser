import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import definition from "./consistencyChoice";

describe("consistencyChoice", () => {
  it("asks the cookbook's eight choice questions", () => {
    const keys = Object.keys(definition.questions);
    expect(keys).toHaveLength(8);
    for (const question of Object.values(definition.questions)) {
      expect(question.type).toBe("choice");
    }
  });

  it("has labels that exactly match the questions (no orphans, no typos)", () => {
    expect(Object.keys(definition.labels).sort()).toEqual(Object.keys(definition.questions).sort());
  });

  it("has a catalog entry marked built", () => {
    expect(CATALOG.find((entry) => entry.id === definition.id)?.status).toBe("built");
  });

  it("routes a low-confidence choice to review at the cookbook's 0.60 floor", () => {
    const [item] = definition.routing!(
      { action: { type: "choice", choice: "Remove", confidence: 0.55, probabilities: { Remove: 0.55, Warn: 0.45 } } },
      definition.labels
    );
    expect(item.disposition).toBe("review");
  });

  it("runs on the small model", () => {
    expect(definition.requires.model).toBe("kev-0.6b");
  });
});
