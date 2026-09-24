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

  it("grounds every citation's quote in its section, bar the ones the pre-check catches", () => {
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

  it("fires the pre-check on exactly the citations whose quote is not in their section", () => {
    const items = citationCheck.items!;
    const labelFor = items.labelFor;
    const fired = items.items
      .filter((item) => items.preCheck?.(item, labelFor))
      .map((item) => item.id);
    // Derived from the property the pre-check is for, not from today's ids: a
    // sixth fabricated citation should extend this set, not fail this test.
    const ungrounded = items.items
      .filter(
        (item) =>
          item.fields.quote.length > 0 && !item.fields.section.includes(item.fields.quote)
      )
      .map((item) => item.id);

    expect(ungrounded.length).toBeGreaterThan(0);
    expect(fired).toEqual(ungrounded);
  });

  it("says what it decided and why, carrying no quantity it never measured", () => {
    const items = citationCheck.items!;
    const labelFor = items.labelFor;
    let checked = 0;

    for (const item of items.items) {
      const routed = items.preCheck?.(item, labelFor) ?? null;
      if (!routed) continue;
      checked += 1;
      expect(routed).toMatchObject({ outcome: "fabricated", disposition: "auto" });
      // The row draws its bar from `value`, and a string search measured
      // nothing — so there is no value here. `CookbookCard.test.tsx` asserts
      // the consequence a visitor sees: no bar on that row.
      expect(routed.value).toBeUndefined();
      // A phrase, not a sentence: the row renders it inside brackets after the
      // outcome, where a full stop reads as a mistake.
      expect(routed.detail).toBeTruthy();
      expect(routed.detail).not.toMatch(/\.$/);
    }

    expect(checked).toBeGreaterThan(0);
  });

  it("requires kev-0.6b, where the mechanic is visible", () => {
    expect(citationCheck.requires.model).toBe("kev-0.6b");
  });

  it("keeps percentages and durations out of the why, whatever unit they are written in", () => {
    // Measurements belong in the comment above `requires`, where they can say
    // which runtime produced them. This string cannot: it is read in a browser
    // on WebGPU, and every figure in that comment was taken on CPU in Node.
    //
    // The name of this test used to say "no measurement figures", which the
    // string has never satisfied — it names the cookbook's own 0.8 floor, and
    // rightly: a published threshold is not a measurement. The two patterns
    // below are what it actually guards, and the second now matches the spelled
    // units ("0.2 seconds") that the old `\b\d+\s*(ms|s)\b` let through both
    // because of the word boundary and because it saw no decimal point.
    const why = citationCheck.requires.why;
    expect(why).not.toMatch(/%/);
    expect(why).not.toMatch(/\d+(\.\d+)?\s*(ms|s|secs?|seconds?|milliseconds?|minutes?)\b/i);
  });

  it("labels the one question it asks, and nothing else", () => {
    expect(Object.keys(citationCheck.labels).sort()).toEqual(
      Object.keys(citationCheck.questions).sort()
    );
  });
});
