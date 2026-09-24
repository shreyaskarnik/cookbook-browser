import { describe, expect, it } from "vitest";
import citationCheck from "./citationCheck";

describe("citationCheck", () => {
  it("asks the cookbook's relation question, verbatim", () => {
    expect(citationCheck.questions.relation.instructions).toBe(
      "How does the section relate to the claim?"
    );
  });

  it("offers exactly the cookbook's three relations", () => {
    const relation = citationCheck.questions.relation;
    if (relation.type !== "choice") throw new Error("relation must be a choice");
    expect(relation.options).toEqual(["supports", "contradicts", "says_nothing"]);
  });

  it("has an items spec, since this is a per-item cookbook", () => {
    expect(citationCheck.items).toBeDefined();
  });

  it("gives every sample the fields toState reads", () => {
    const items = citationCheck.items!;
    for (const item of items.items) {
      expect(item.fields.claim).toBeTruthy();
      expect(item.fields.section).toBeTruthy();
      const state = items.toState(item);
      expect(state).toContain(item.fields.claim);
      expect(state).toContain(item.fields.section);
    }
  });

  it("covers all three relations plus the pre-check case, over at least four citations", () => {
    const items = citationCheck.items!;
    expect(items.items.length).toBeGreaterThanOrEqual(4);

    // Every non-fabricated citation's quote must actually be in its section,
    // or the pre-check below would fire on it too and this test would not be
    // exercising what it claims to.
    const fabricated = items.items.filter(
      (item) => item.fields.quote.length > 0 && !item.fields.section.includes(item.fields.quote)
    );
    const grounded = items.items.filter((item) => !fabricated.includes(item));
    expect(fabricated.length).toBeGreaterThanOrEqual(1);
    for (const item of grounded) {
      expect(item.fields.section).toContain(item.fields.quote);
    }
  });

  it("fires the pre-check only on the citation whose quote is not in its section", () => {
    const items = citationCheck.items!;
    const labelFor = items.labelFor;
    const fired = items.items
      .map((item) => ({ id: item.id, routed: items.preCheck?.(item, labelFor) ?? null }))
      .filter((entry) => entry.routed !== null);

    expect(fired).toHaveLength(1);
    expect(fired[0]!.id).toBe("log-retention");
    expect(fired[0]!.routed).toMatchObject({ outcome: "fabricated", disposition: "auto", value: 1 });
  });

  it("does not fire the pre-check on citations whose quote is grounded in the section", () => {
    const items = citationCheck.items!;
    const labelFor = items.labelFor;
    for (const item of items.items) {
      if (item.id === "log-retention") continue;
      expect(items.preCheck?.(item, labelFor) ?? null).toBeNull();
    }
  });

  it("requires kev-0.6b, where the mechanic is visible", () => {
    expect(citationCheck.requires.model).toBe("kev-0.6b");
  });

  it("has a why with no percentages or other measurement figures in it", () => {
    // The measurement itself belongs in a comment above `requires`, not in
    // the string a visitor reads.
    expect(citationCheck.requires.why).not.toMatch(/%/);
    expect(citationCheck.requires.why).not.toMatch(/\b\d+\s*(ms|s)\b/);
  });

  it("labels the one question it asks, and nothing else", () => {
    expect(Object.keys(citationCheck.labels).sort()).toEqual(
      Object.keys(citationCheck.questions).sort()
    );
  });
});
