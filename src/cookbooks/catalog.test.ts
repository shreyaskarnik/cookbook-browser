import { describe, expect, it } from "vitest";
import { CATALOG, CATEGORIES, docsUrl } from "./catalog";
import { BUILT_IDS } from "./index";
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

  it("marks every cookbook that has a definition as built", () => {
    for (const entry of CATALOG) {
      const hasDefinition = BUILT_IDS.includes(entry.id);
      expect(entry.status).toBe(hasDefinition ? "built" : "planned");
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
    expect(consistencyNoul.samples.length).toBeGreaterThanOrEqual(3);
    for (const sample of consistencyNoul.samples) {
      expect(sample.text.length).toBeGreaterThan(80);
    }
  });
});
