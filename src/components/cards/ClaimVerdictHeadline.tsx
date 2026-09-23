import { formatPercent } from "../../lib/format";
import { bandSummary, claimVerdict, clampBand, classify } from "../../lib/routing";
import type { ClaimVerdict, RoutedQuestion } from "../../lib/routing";
import type { HeadlineProps } from "./headlines";

/** `claimVerdict` hands back the offending keys, not English — `routing.ts` is
 *  pure logic over probabilities and has no access to the cookbook's labels.
 *  The sentence is composed here, substituting the human label for each key, so
 *  a visitor never sees a raw camelCase question key. Wording matches what
 *  `routing.ts` used to produce itself. */
function describeVerdict(verdict: ClaimVerdict, labels: Record<string, string>): string {
  if (verdict.outcome === "auto") {
    const { elsewhereUncertain } = verdict;
    return elsewhereUncertain === 0
      ? "Every question landed outside the band."
      : `${elsewhereUncertain} question${elsewhereUncertain === 1 ? " is" : "s are"} uncertain, but none of the critical ones.`;
  }
  const { criticalUncertainKeys } = verdict;
  return criticalUncertainKeys.length === 1
    ? `${labels[criticalUncertainKeys[0]]} is uncertain.`
    : `${criticalUncertainKeys.length} critical questions are uncertain.`;
}

/**
 * Self-consistency: nouls speaks about the claim as a whole, not only about its
 * fourteen questions one at a time: an insurer wants to know whether the file
 * can go out, and which question is holding it up if not. That is this
 * cookbook's own prose about insurance claims — it is registered for this
 * cookbook alone in `headlines.tsx` and must not run for any other.
 */
export default function ClaimVerdictHeadline({
  routed,
  definition,
  params,
  stale,
}: HeadlineProps) {
  // The same band the rule was built from, so the headline and the rows below
  // it cannot disagree about where the bounds are. `clampBand` also makes this
  // total: a parameter set with no band leaves the default in place rather
  // than producing NaN bounds.
  const band = clampBand({ low: params.low, high: params.high });
  // `RoutedItem.value` for a band-routed answer is its probability, so the
  // verdict machinery's older `RoutedQuestion` vocabulary is recovered from the
  // rule's own output rather than from the raw answers — the rule has already
  // established that every answer here is a noul.
  const questions: RoutedQuestion[] = routed.map((item) => ({
    key: item.key,
    probability: item.value,
    verdict: classify(item.value, band),
  }));
  const summary = bandSummary(questions);
  const verdict =
    questions.length > 0 ? claimVerdict(questions, definition.criticalKeys ?? []) : null;

  return (
    <p
      data-testid="claim-verdict"
      data-stale={stale ? "true" : "false"}
      className={`mt-3 text-sm ${stale ? "opacity-50" : ""}`}
    >
      <strong>{summary.uncertain}</strong> of {questions.length} questions go to
      review; {formatPercent(summary.automatedShare)} are decided automatically.
      {verdict && (
        <>
          {" "}
          <span
            className={
              verdict.outcome === "review"
                ? "text-review font-semibold"
                : "text-auto font-semibold"
            }
          >
            {verdict.outcome === "review"
              ? "This claim needs a person."
              : "This claim can be actioned."}
          </span>{" "}
          <span className="text-stone">
            {describeVerdict(verdict, definition.labels)}
          </span>
        </>
      )}
    </p>
  );
}
