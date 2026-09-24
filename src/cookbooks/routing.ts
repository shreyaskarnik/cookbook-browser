import type { Answer } from "../engine/types";
import { formatPercent } from "../lib/format";
import { clampBand } from "../lib/routing";

/** What happens to one question's answer: decided by the machine, or sent to a person. */
export type Disposition = "auto" | "review";

export type RoutedItem = {
  key: string;
  /** The human label from the cookbook's `labels`, never the raw question key. */
  label: string;
  /** Who acts on this row: the machine, or a person. Two values, because
   *  that is genuinely binary and it is what the row's colour means. */
  disposition: Disposition;
  /** The rule's own word for what happened — "Yes", "Review", "Block",
   *  "verified". Rules disagree about how many outcomes they have, and a
   *  two-valued disposition cannot carry that, so before this field every
   *  rule wrote its word into `detail` and the pane could not act on it. */
  outcome: string;
  /** The number or option only, e.g. "95%" or "Remove (40%)". */
  detail: string;
  /** The 0..1 quantity this rule thresholded on, so the card can draw a bar.
   *  For a noul that is its probability; for a choice, the winning option's
   *  confidence; for a score, its normalized position. Every rule has one,
   *  because every rule compares something against a threshold. */
  value: number;
};

/** One adjustable number behind a rule: what it is called, what it may be, and
 *  where it sits in the rule as built. A card renders one control per
 *  parameter — the rule names its own knobs, because only the rule knows what
 *  they mean. */
export type RuleParameter = {
  /** Keyed as the rule names it — `rebuild` reads values under these keys. */
  name: string;
  /** The visitor-facing name of the control, and its accessible name. */
  label: string;
  min: number;
  max: number;
  step: number;
  /** How to print the value beside the control. A probability reads as a
   *  percentage; a score does not — guardrails' severity override runs 0..3
   *  over four levels, where "200%" would be nonsense. */
  format: "percent" | "number";
  /** Where this parameter sits in the rule as built. */
  value: number;
};

/** The knobs a rule exposes, and how to rebuild it as they move. Every field
 *  here describes the rule, not the card: two cookbooks with different
 *  thresholds get different headings, different copy and different controls
 *  without the card knowing anything about either.
 *
 *  Generic in the rule type `rebuild` returns: a whole-state `RoutingRule`
 *  rebuilds into another `RoutingRule`, but a per-item `ItemRoutingRule`
 *  (`./items`) rebuilds into another `ItemRoutingRule` — same shape of knob,
 *  different callable underneath. `R` defaults to `RoutingRule` so existing
 *  call sites naming `RuleControls` bare keep working. */
export type RuleControls<R = RoutingRule> = {
  /** The section heading above the controls, e.g. "Uncertainty band". */
  title: string;
  /** One line under it, saying what moving these does. */
  help: string;
  parameters: readonly RuleParameter[];
  /**
   * The same kind of rule, built at `values` (keyed by parameter name). A rule
   * whose parameters constrain each other resolves that here — `bandRule`'s two
   * bounds swap rather than producing an empty band — and the returned rule's
   * own `parameters` carry the resolved values back, so a card can show where
   * the controls actually ended up rather than where they were dragged to.
   */
  rebuild(values: Record<string, number>): R;
  /** A region of the 0..1 bar that goes to a person, for a card to shade behind
   *  the answer rows. Only a rule whose review region is one contiguous range of
   *  the same quantity every row is measured on has one. */
  reviewBand?: { low: number; high: number };
};

/** How one cookbook turns answers into dispositions. Cookbooks differ: a
 *  symmetric band, a single confidence floor, two thresholds plus an override,
 *  an ordered cascade. The rule belongs to the cookbook, not the card. */
export interface RoutingRule {
  (answers: Record<string, Answer>, labels: Record<string, string>): RoutedItem[];
  /** The thresholds this rule was built at, and how to rebuild it at others.
   *  Optional so a rule with nothing to adjust can simply omit it and render
   *  no controls. */
  controls?: RuleControls<RoutingRule>;
}

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

/** Shared by every threshold that is a probability. */
export const PROBABILITY = { min: 0, max: 1, step: 0.01, format: "percent" } as const;

/** Probabilities inside [low, high], bounds included, go to a person.
 *  Used by Self-consistency: nouls. */
export function bandRule(low: number, high: number): RoutingRule {
  const rule: RoutingRule = (answers, labels) =>
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
        outcome: word,
        detail: formatPercent(answer.probability),
        value: answer.probability,
      };
    });

  rule.controls = {
    title: "Uncertainty band",
    help: "Anything inside the band goes to a person. Drag the bounds and watch the answers move — the model is not asked again.",
    reviewBand: { low, high },
    parameters: [
      { ...PROBABILITY, name: "low", label: "Lower bound", value: low },
      { ...PROBABILITY, name: "high", label: "Upper bound", value: high },
    ],
    // The two bounds are not independent: dragging one past the other is a drag
    // past the other handle, not a request for an empty band. `clampBand` also
    // absorbs a non-finite bound, so no control can produce a NaN threshold.
    rebuild: (values) => {
      const bounds = clampBand({ low: values.low, high: values.high });
      return bandRule(bounds.low, bounds.high);
    },
  };
  return rule;
}

/** The label up to its first colon, e.g. "Serious: complying enables real
 *  wrongdoing or gives unsafe personal advice" becomes "Serious". A
 *  `ScoreAnswer.level` is the full option label — guardrails' four levels are
 *  each a whole sentence — and this renders into `AnswersPane`'s narrow
 *  (`w-20`) detail column. A level with no colon is returned unchanged rather
 *  than emptied, so a future cookbook's shorter levels are not broken by this. */
function firstClause(label: string): string {
  const colon = label.indexOf(":");
  return colon === -1 ? label : label.slice(0, colon);
}

/** Keep a threshold inside its declared range, replacing a non-finite value
 *  with the one the rule already had rather than letting NaN reach a
 *  comparison, where every test against it would silently be false. */
export function clampTo(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** The highest severity guardrails' four levels can reach: a `ScoreAnswer.score`
 *  is an expectation over level indices, so four levels top out at 3. */
const MAX_SEVERITY = 3;

/** The guardrails cookbook's rule: two thresholds on each hazard probability,
 *  plus a severity score that converts reviews into blocks once it is high
 *  enough. `severityKey` names the score question, which is judged differently
 *  from the hazards and is never itself a hazard. */
export function hazardRule(
  review: number,
  action: number,
  severityBlock: number,
  severityKey: string
): RoutingRule {
  const rule: RoutingRule = (answers, labels) => {
    const severity = answers[severityKey];
    const severe =
      severity !== undefined && severity.type === "score" && severity.score >= severityBlock;

    return Object.entries(answers).map(([key, answer]) => {
      if (key === severityKey) {
        if (answer.type !== "score") {
          throw new Error(`hazardRule expects "${severityKey}" to be a score; got ${answer.type}.`);
        }
        return {
          key,
          label: resolveLabel(key, labels),
          disposition: "auto" as const,
          // The truncated level is the outcome word itself here, not a detail
          // alongside a number — a severity row has no separate percentage to
          // show beside it.
          outcome: firstClause(answer.level),
          detail: "",
          value: answer.normalized,
        };
      }
      if (answer.type !== "noul") {
        throw new Error(`hazardRule expects noul hazards; "${key}" is a ${answer.type}.`);
      }
      const p = answer.probability;
      if (p >= action) {
        return { key, label: resolveLabel(key, labels), disposition: "auto" as const, outcome: "Block", detail: formatPercent(p), value: p };
      }
      if (p >= review) {
        // A severity-forced block is still a block: it must render the same
        // disposition as the action-threshold block above, or the same
        // outcome colours differently depending on which branch produced it.
        return {
          key,
          label: resolveLabel(key, labels),
          disposition: severe ? ("auto" as const) : ("review" as const),
          outcome: severe ? "Block" : "Review",
          detail: formatPercent(p),
          value: p,
        };
      }
      return { key, label: resolveLabel(key, labels), disposition: "auto" as const, outcome: "Clear", detail: formatPercent(p), value: p };
    });
  };

  rule.controls = {
    title: "Thresholds",
    help: "A hazard at or above the review threshold goes to a person, and at or above the action threshold it is blocked. A severity at or above the override turns any review into a block. Drag them and watch the answers move — the model is not asked again.",
    // No shaded region behind the rows: the severity row is measured on a
    // normalized score rather than a hazard probability, so one band drawn
    // across every row would not be true of all of them.
    parameters: [
      { ...PROBABILITY, name: "review", label: "Review threshold", value: review },
      { ...PROBABILITY, name: "action", label: "Action threshold", value: action },
      {
        name: "severityBlock",
        label: "Severity override",
        min: 0,
        max: MAX_SEVERITY,
        step: 0.05,
        format: "number",
        value: severityBlock,
      },
    ],
    rebuild: (values) =>
      hazardRule(
        clampTo(values.review, review, 0, 1),
        clampTo(values.action, action, 0, 1),
        clampTo(values.severityBlock, severityBlock, 0, MAX_SEVERITY),
        severityKey
      ),
  };
  return rule;
}

/** A choice below `floor` is not acted on. Used by Self-consistency: choices,
 *  whose cookbook sets the floor at 0.60. */
export function minimumConfidenceRule(floor: number): RoutingRule {
  const rule: RoutingRule = (answers, labels) =>
    Object.entries(answers).map(([key, answer]) => {
      if (answer.type !== "choice") {
        throw new Error(`minimumConfidenceRule expects choice answers; "${key}" is a ${answer.type}.`);
      }
      return {
        key,
        label: resolveLabel(key, labels),
        disposition: answer.confidence >= floor ? "auto" : "review",
        outcome: answer.choice,
        detail: formatPercent(answer.confidence),
        value: answer.confidence,
      };
    });

  rule.controls = {
    title: "Confidence floor",
    help: "A choice below the floor goes to a person. Drag it and watch the answers move — the model is not asked again.",
    // Everything under the floor goes to a person, and every row here is
    // measured on the winning option's confidence, so the shaded region is
    // true of all of them.
    reviewBand: { low: 0, high: floor },
    parameters: [{ ...PROBABILITY, name: "floor", label: "Floor", value: floor }],
    rebuild: (values) => minimumConfidenceRule(clampTo(values.floor, floor, 0, 1)),
  };
  return rule;
}
