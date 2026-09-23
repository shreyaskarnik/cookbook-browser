import type { Answer } from "../engine/types";

/** What happens to one question's answer: decided by the machine, or sent to a person. */
export type Disposition = "auto" | "review";

export type RoutedItem = {
  key: string;
  /** The human label from the cookbook's `labels`, never the raw question key. */
  label: string;
  disposition: Disposition;
  /** One short phrase a visitor can read, e.g. "89%" or "Escalate (41%)". */
  detail: string;
  /** The 0..1 quantity this rule thresholded on, so the card can draw a bar.
   *  For a noul that is its probability; for a choice, the winning option's
   *  confidence; for a score, its normalized position. Every rule has one,
   *  because every rule compares something against a threshold. */
  value: number;
};

/** How one cookbook turns answers into dispositions. Cookbooks differ: a
 *  symmetric band, a single confidence floor, two thresholds plus an override,
 *  an ordered cascade. The rule belongs to the cookbook, not the card. */
export type RoutingRule = (
  answers: Record<string, Answer>,
  labels: Record<string, string>
) => RoutedItem[];

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The human label for `key`, never the raw key itself. Throws rather than
 *  falling back to `key` — a missing label is a cookbook bug, and a raw
 *  camelCase key must never reach a visitor (see commit 47eaa4f, which moved
 *  label substitution out of pure-logic code for exactly this reason). */
function resolveLabel(key: string, labels: Record<string, string>): string {
  const label = labels[key];
  if (label === undefined) {
    throw new Error(
      `No label for question "${key}". Every question needs one; a raw key must never reach a visitor.`
    );
  }
  return label;
}

/** Probabilities inside [low, high], bounds included, go to a person.
 *  Used by Self-consistency: nouls. */
export function bandRule(low: number, high: number): RoutingRule {
  return (answers, labels) =>
    Object.entries(answers).map(([key, answer]) => {
      if (answer.type !== "noul") {
        throw new Error(`bandRule expects noul answers; "${key}" is a ${answer.type}.`);
      }
      const inside = answer.probability >= low && answer.probability <= high;
      // Three-way word alongside a two-way disposition: "yes" and "no" are both
      // automatic (a person is not needed either way), but they are opposite
      // answers — "covered?" at 26% and at 89% are different facts, even though
      // neither needs a person. `disposition` says whether a person is needed;
      // `word` says what the answer actually was.
      const word = inside ? "Review" : answer.probability > high ? "Yes" : "No";
      return {
        key,
        label: resolveLabel(key, labels),
        disposition: inside ? "review" : "auto",
        detail: `${word} (${percent(answer.probability)})`,
        value: answer.probability,
      };
    });
}

/** A choice below `floor` is not acted on. Used by Self-consistency: choices,
 *  whose cookbook sets the floor at 0.60. */
export function minimumConfidenceRule(floor: number): RoutingRule {
  return (answers, labels) =>
    Object.entries(answers).map(([key, answer]) => {
      if (answer.type !== "choice") {
        throw new Error(`minimumConfidenceRule expects choice answers; "${key}" is a ${answer.type}.`);
      }
      return {
        key,
        label: resolveLabel(key, labels),
        disposition: answer.confidence >= floor ? "auto" : "review",
        detail: `${answer.choice} (${percent(answer.confidence)})`,
        value: answer.confidence,
      };
    });
}
