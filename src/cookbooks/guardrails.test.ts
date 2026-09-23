import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import definition from "./guardrails";

describe("guardrails", () => {
  it("asks four hazard nouls and one severity score", () => {
    const types = Object.values(definition.questions).map((q) => q.type);
    expect(types.filter((t) => t === "noul")).toHaveLength(4);
    expect(types.filter((t) => t === "score")).toHaveLength(1);
  });

  it("has labels that exactly match the questions", () => {
    expect(Object.keys(definition.labels).sort()).toEqual(Object.keys(definition.questions).sort());
  });

  it("names a severity key that exists among its questions", () => {
    expect(Object.keys(definition.questions)).toContain("severity");
  });

  it("uses the cookbook's four severity levels in order, lowest first", () => {
    const severity = definition.questions.severity;
    if (severity.type !== "score") throw new Error("severity must be a score");
    expect(severity.options[0]).toMatch(/^No harm/);
    expect(severity.options[3]).toMatch(/^Severe/);
  });

  it("has a catalog entry marked built", () => {
    expect(CATALOG.find((entry) => entry.id === definition.id)?.status).toBe("built");
  });
});
