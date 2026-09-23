import { describe, expect, it } from "vitest";
import consistencyNoul from "../cookbooks/consistencyNoul";
import { claimVerdict } from "./routing";
import type { RoutedQuestion } from "./routing";

/** `claimVerdict` takes its critical keys from the caller — it has no default
 *  and imports no cookbook. These tests are about consistency-noul's list, so
 *  they pass consistency-noul's own keys, the way its card does. */
const CRITICAL = consistencyNoul.criticalKeys ?? [];

const entry = (key: string, verdict: RoutedQuestion["verdict"]): RoutedQuestion => ({
  key,
  probability: verdict === "uncertain" ? 0.5 : verdict === "yes" ? 0.9 : 0.1,
  verdict,
});

describe("claimVerdict", () => {
  it("actions a claim where nothing is uncertain", () => {
    const verdict = claimVerdict([entry("covered", "yes"), entry("fraudIndicators", "no")], CRITICAL);
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 0 });
  });

  it("escalates when a critical question is uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("lineItemsAddUp", "yes")], CRITICAL).outcome
    ).toBe("review");
  });

  it("names the one critical question that is uncertain — by key, for the card to look up its label", () => {
    const verdict = claimVerdict([entry("fraudIndicators", "uncertain")], CRITICAL);
    expect(verdict).toEqual({ outcome: "review", criticalUncertainKeys: ["fraudIndicators"] });
  });

  it("lists them all when several critical questions are uncertain", () => {
    const verdict = claimVerdict(
      [entry("covered", "uncertain"), entry("manualReview", "uncertain")],
      CRITICAL
    );
    expect(verdict).toEqual({
      outcome: "review",
      criticalUncertainKeys: ["covered", "manualReview"],
    });
  });

  it("still actions a claim when only non-critical questions are uncertain — the point of the rule", () => {
    const verdict = claimVerdict(
      [
        entry("covered", "yes"),
        entry("lineItemsAddUp", "uncertain"),
        entry("subrogation", "uncertain"),
      ],
      CRITICAL
    );
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 2 });
  });

  it("counts a single non-critical uncertainty the same way as several", () => {
    const verdict = claimVerdict([entry("covered", "yes"), entry("subrogation", "uncertain")], CRITICAL);
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 1 });
  });

  it("actions an empty list rather than throwing", () => {
    expect(claimVerdict([], CRITICAL)).toEqual({ outcome: "auto", elsewhereUncertain: 0 });
  });

  it("keeps every critical key among the card's fourteen question keys", () => {
    for (const key of CRITICAL) {
      expect(Object.keys(consistencyNoul.questions)).toContain(key);
    }
  });

  it("never returns a raw key as English — it hands back keys, not sentences", () => {
    const verdict = claimVerdict([entry("fraudIndicators", "uncertain")], CRITICAL);
    expect(verdict).not.toHaveProperty("reason");
    expect(verdict.outcome === "review" && verdict.criticalUncertainKeys).toEqual([
      "fraudIndicators",
    ]);
  });

  it("takes its critical keys as a parameter, so a different cookbook can supply its own", () => {
    const verdict = claimVerdict([entry("lineItemsAddUp", "uncertain")], ["lineItemsAddUp"]);
    expect(verdict).toEqual({ outcome: "review", criticalUncertainKeys: ["lineItemsAddUp"] });
  });

  it("with an empty list, treats nothing as critical", () => {
    const verdict = claimVerdict([entry("covered", "uncertain")], []);
    expect(verdict).toEqual({ outcome: "auto", elsewhereUncertain: 1 });
  });
});
