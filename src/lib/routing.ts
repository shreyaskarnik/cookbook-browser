import type { NoulAnswer } from "../engine/types";

/** An uncertainty band. Probabilities inside it, bounds included, go to a human. */
export type Band = { low: number; high: number };

export type Verdict = "yes" | "no" | "uncertain";

/** The cookbook's band: below 0.30 is a no, above 0.70 a yes, the rest a human's call. */
export const DEFAULT_BAND: Band = { low: 0.3, high: 0.7 };

/** Both bounds are inclusive, so widening the band never leaves a probability
 *  unclassified at the edge. */
export function classify(probability: number, band: Band): Verdict {
  if (probability < band.low) return "no";
  if (probability > band.high) return "yes";
  return "uncertain";
}

/** Keep a band usable however the two slider handles are dragged: inside 0..1, and
 *  low below high (a crossed band is a drag past the other handle, not a request
 *  for an empty band). Non-finite bounds (NaN, Infinity, -Infinity) are replaced
 *  with their corresponding defaults independently, so a single bad bound cannot
 *  corrupt the good one. */
export function clampBand(band: Band): Band {
  // Replace non-finite bounds with their defaults, independently.
  let low = Number.isFinite(band.low) ? band.low : DEFAULT_BAND.low;
  let high = Number.isFinite(band.high) ? band.high : DEFAULT_BAND.high;
  // Clamp to valid range.
  low = Math.min(Math.max(low, 0), 1);
  high = Math.min(Math.max(high, 0), 1);
  // Ensure low <= high.
  return low <= high ? { low, high } : { low: high, high: low };
}

export type RoutedQuestion = {
  key: string;
  probability: number;
  verdict: Verdict;
};

/** Insertion order is preserved: the card renders this list directly, and
 *  re-sorting it as the slider moves would make rows jump under the cursor. */
export function routeAll(
  answers: Record<string, NoulAnswer>,
  band: Band
): RoutedQuestion[] {
  return Object.entries(answers).map(([key, answer]) => ({
    key,
    probability: answer.probability,
    verdict: classify(answer.probability, band),
  }));
}

export function bandSummary(routed: RoutedQuestion[]): {
  yes: number;
  no: number;
  uncertain: number;
  automatedShare: number;
} {
  const counts = { yes: 0, no: 0, uncertain: 0 };
  for (const entry of routed) counts[entry.verdict] += 1;
  const automated = counts.yes + counts.no;
  return {
    ...counts,
    automatedShare: routed.length === 0 ? 0 : automated / routed.length,
  };
}

/** What the card says about the claim as a whole, above the per-question rows.
 *  This is structured facts, not English: `routing.ts` is pure logic over
 *  probabilities and has no access to the cookbook's question labels, so it
 *  cannot compose a sentence itself without either reaching for labels it
 *  should not have or emitting raw camelCase keys into visitor-facing copy.
 *  The card composes the sentence, substituting `definition.labels[key]` for
 *  each key here. */
export type ClaimVerdict =
  | {
      /** Renders green and says the claim can be actioned without a person. */
      outcome: "auto";
      /** Count of non-critical questions that are uncertain — zero means
       *  every question landed outside the band. */
      elsewhereUncertain: number;
    }
  | {
      /** Renders amber and says a person needs to look at it. */
      outcome: "review";
      /** The critical keys (see `CRITICAL_KEYS`) that are uncertain. Always
       *  non-empty when `outcome` is "review". */
      criticalUncertainKeys: string[];
    };

/**
 * The questions a person must be sure about before a payout goes out: whether the
 * loss is covered at all, whether an exclusion kills it, whether it smells like
 * fraud, and whether the file itself asks for a supervisor. Uncertainty anywhere
 * else can be absorbed; uncertainty here cannot.
 *
 * This is a judgment call about claims handling rather than a fact about the model.
 * Change this list (or swap the rule in `claimVerdict` for a count over all
 * fourteen) and the headline changes with it.
 */
export const CRITICAL_KEYS: readonly string[] = [
  "covered",
  "exclusionApplies",
  "fraudIndicators",
  "manualReview",
];

export function claimVerdict(routed: RoutedQuestion[]): ClaimVerdict {
  const critical = routed.filter(
    (entry) => CRITICAL_KEYS.includes(entry.key) && entry.verdict === "uncertain"
  );
  if (critical.length === 0) {
    const elsewhere = routed.filter((entry) => entry.verdict === "uncertain").length;
    return { outcome: "auto", elsewhereUncertain: elsewhere };
  }
  return {
    outcome: "review",
    criticalUncertainKeys: critical.map((entry) => entry.key),
  };
}
