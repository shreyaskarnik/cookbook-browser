import { describe, expect, it } from "vitest";
import { CATALOG, CATEGORIES, docsUrl } from "./catalog";
import { BUILT_IDS, getDefinition } from "./index";
import consistencyNoul from "./consistencyNoul";

describe("CATALOG", () => {
  it("lists all eighteen documented cookbooks", () => {
    expect(CATALOG).toHaveLength(18);
  });

  it("has a unique id and slug for each", () => {
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(18);
    expect(new Set(CATALOG.map((entry) => entry.slug)).size).toBe(18);
  });

  it("puts every entry in one of the five documented categories", () => {
    for (const entry of CATALOG) {
      expect(CATEGORIES).toContain(entry.category);
    }
  });

  it("keeps the categories in the order the docs use", () => {
    expect(CATEGORIES).toEqual([
      "Self-consistency",
      "Batching",
      "How-to",
      "Extraction",
      "Classification",
    ]);
  });

  /** One direction only, deliberately. A cookbook marked "built" without a
   *  definition is a dead sidebar entry a visitor can click, which is the
   *  thing worth asserting. The converse — every registered definition is
   *  marked built — is NOT asserted, because a definition is registered in
   *  the task that writes it and advertised in the task that makes it
   *  render, and those are not the same task. Asserting the biconditional
   *  would forbid that intermediate state and fail on work that is correct. */
  it("never advertises a cookbook it has no definition for", () => {
    for (const entry of CATALOG) {
      if (entry.status === "built") {
        expect(BUILT_IDS).toContain(entry.id);
      }
    }
  });

  it("links each entry to its cookbook page", () => {
    expect(docsUrl(CATALOG[0])).toBe(
      "https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook"
    );
  });
});

describe("consistencyNoul", () => {
  it("matches a catalog entry", () => {
    expect(CATALOG.some((entry) => entry.id === consistencyNoul.id)).toBe(true);
  });

  it("has a catalog entry marked built", () => {
    expect(CATALOG.find((entry) => entry.id === consistencyNoul.id)?.status).toBe(
      "built"
    );
  });

  it("asks the cookbook's fourteen noul questions", () => {
    const keys = Object.keys(consistencyNoul.questions);
    expect(keys).toHaveLength(14);
    for (const question of Object.values(consistencyNoul.questions)) {
      expect(question.type).toBe("noul");
    }
  });

  it("gives every question a short label for the answer rows", () => {
    for (const key of Object.keys(consistencyNoul.questions)) {
      expect(consistencyNoul.labels[key]).toBeTruthy();
    }
  });

  it("has labels that exactly match the questions (no orphans, no typos)", () => {
    expect(Object.keys(consistencyNoul.labels).sort()).toEqual(
      Object.keys(consistencyNoul.questions).sort()
    );
  });

  it("ships sample states to start from", () => {
    // A single-state cookbook always has samples; only a per-item one omits
    // them in favour of `items`, and consistencyNoul is not one.
    const samples = consistencyNoul.samples!;
    expect(samples.length).toBeGreaterThanOrEqual(3);
    for (const sample of samples) {
      expect(sample.text.length).toBeGreaterThan(80);
    }
  });
});

/** Every routing rule resolves its row labels through `resolveLabel`, which
 *  throws rather than leak a raw camelCase key to a visitor. That makes a
 *  missing label a cookbook-authoring mistake that surfaces at run time, as an
 *  error banner on the card. Derived over every built cookbook so the
 *  fifteen still to come are covered the day they are registered, rather than
 *  each needing someone to remember to write this test again. */
describe("every built definition", () => {
  it.each(BUILT_IDS)("labels every question it asks: %s", (id) => {
    const definition = getDefinition(id);
    const unlabelled = Object.keys(definition.questions).filter(
      (key) => !definition.labels[key]
    );
    expect(unlabelled).toEqual([]);
  });

  it.each(BUILT_IDS)("labels nothing it does not ask: %s", (id) => {
    const definition = getDefinition(id);
    const orphaned = Object.keys(definition.labels).filter(
      (key) => !(key in definition.questions)
    );
    expect(orphaned).toEqual([]);
  });

  /** A definition carries `routing` + `samples` (a single state) or `items` (a
   *  list), and the card discriminates on exactly that. Neither shape reaches a
   *  `throw` during render, and — with no error boundary above it — that throw
   *  takes the whole app down, including the loaded model. Both shapes at once
   *  is worse for being silent: `items` wins and the other two are ignored with
   *  no signal. Asserted here rather than in the type, which cannot express it
   *  without a discriminated union rippling through every `getDefinition`
   *  consumer, and here it covers the fifteen cards still to come the day each
   *  one registers. */
  it.each(BUILT_IDS)("declares exactly one shape: %s", (id) => {
    const definition = getDefinition(id);
    const declared = [
      definition.items && "items",
      definition.routing && "routing",
      definition.samples && "samples",
    ].filter(Boolean);
    expect(declared).toEqual(definition.items ? ["items"] : ["routing", "samples"]);
  });

  it.each(BUILT_IDS)("offers at least one sample to run: %s", (id) => {
    // A single-state cookbook offers `samples`; a per-item one offers
    // `items.items` instead — either is something to run.
    const definition = getDefinition(id);
    const count = definition.samples?.length ?? definition.items?.items.length ?? 0;
    expect(count).toBeGreaterThan(0);
  });
});
