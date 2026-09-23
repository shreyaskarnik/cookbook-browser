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
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 0 });
  });

  it("escalates when a critical question is uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("lineItemsAddUp", "yes")]).outcome
    ).toBe("review");
  });

  it("names the one critical question that is uncertain — by key, for the card to look up its label", () => {
    const verdict = claimVerdict([entry("fraudIndicators", "uncertain")]);
    expect(verdict).toEqual({ outcome: "review", criticalUncertainKeys: ["fraudIndicators"] });
  });

  it("lists them all when several critical questions are uncertain", () => {
    const verdict = claimVerdict([
      entry("covered", "uncertain"),
      entry("manualReview", "uncertain"),
    ]);
    expect(verdict).toEqual({
      outcome: "review",
      criticalUncertainKeys: ["covered", "manualReview"],
    });
  });

  it("still actions a claim when only non-critical questions are uncertain — the point of the rule", () => {
    const verdict = claimVerdict([
      entry("covered", "yes"),
      entry("lineItemsAddUp", "uncertain"),
      entry("subrogation", "uncertain"),
    ]);
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 2 });
  });

  it("counts a single non-critical uncertainty the same way as several", () => {
    const verdict = claimVerdict([entry("covered", "yes"), entry("subrogation", "uncertain")]);
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 1 });
  });

  it("actions an empty list rather than throwing", () => {
    expect(claimVerdict([])).toEqual({ outcome: "auto", elsewhereUncertain: 0 });
  });

  it("keeps every critical key among the card's fourteen question keys", async () => {
    const { default: definition } = await import("../cookbooks/consistencyNoul");
    for (const key of CRITICAL_KEYS) {
      expect(Object.keys(definition.questions)).toContain(key);
    }
  });

  it("never returns a raw key as English — it hands back keys, not sentences", () => {
    const verdict = claimVerdict([entry("fraudIndicators", "uncertain")]);
    expect(verdict).not.toHaveProperty("reason");
    expect(verdict.outcome === "review" && verdict.criticalUncertainKeys).toEqual([
      "fraudIndicators",
    ]);
  });
});
