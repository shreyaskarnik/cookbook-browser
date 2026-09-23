import { describe, expect, it } from "vitest";
import { CRITICAL_KEYS, claimVerdict } from "./routing";
import type { RoutedQuestion } from "./routing";

const entry = (key: string, verdict: RoutedQuestion["verdict"]): RoutedQuestion => ({
  key,
  probability: verdict === "uncertain" ? 0.5 : verdict === "yes" ? 0.9 : 0.1,
  verdict,
});

describe("claimVerdict", () => {
  it("actions a claim where nothing is uncertain", () => {
    const verdict = claimVerdict([entry("covered", "yes"), entry("fraudIndicators", "no")]);
    expect(verdict.outcome).toBe("auto");
    expect(verdict.reason).toMatch(/outside the band/);
  });

  it("escalates when a critical question is uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("lineItemsAddUp", "yes")]).outcome
    ).toBe("review");
  });

  it("names the one critical question that is uncertain", () => {
    expect(claimVerdict([entry("fraudIndicators", "uncertain")]).reason).toBe(
      "fraudIndicators is uncertain."
    );
  });

  it("counts them when several critical questions are uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("manualReview", "uncertain")]).reason
    ).toBe("2 critical questions are uncertain.");
  });

  it("still actions a claim when only non-critical questions are uncertain — the point of the rule", () => {
    const verdict = claimVerdict([
      entry("covered", "yes"),
      entry("lineItemsAddUp", "uncertain"),
      entry("subrogation", "uncertain"),
    ]);
    expect(verdict.outcome).toBe("auto");
    expect(verdict.reason).toBe("2 questions are uncertain, but none of the critical ones.");
  });

  it("uses the singular for one non-critical uncertainty", () => {
    expect(
      claimVerdict([entry("covered", "yes"), entry("subrogation", "uncertain")]).reason
    ).toBe("1 question is uncertain, but none of the critical ones.");
  });

  it("actions an empty list rather than throwing", () => {
    expect(claimVerdict([]).outcome).toBe("auto");
  });

  it("keeps every critical key among the card's fourteen question keys", async () => {
    const { default: definition } = await import("../cookbooks/consistencyNoul");
    for (const key of CRITICAL_KEYS) {
      expect(Object.keys(definition.questions)).toContain(key);
    }
  });
});
