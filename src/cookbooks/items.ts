import type { Answer } from "../engine/types";
import { formatPercent } from "../lib/format";
import type { RoutedItem } from "./routing";

/** One entry in a per-item cookbook's list — a citation, a ticket, a review —
 *  identified by `id` and rendered from its editable `fields`. */
export type CookbookItem = { id: string; fields: Record<string, string> };

/** How one per-item cookbook turns one item's answers into one routed row.
 *  Unlike `RoutingRule`, which answers a whole state's questions at once and
 *  labels each from the cookbook's static `labels`, this answers one item and
 *  labels it from the item itself — a list of citations has no fixed set of
 *  question keys to label. */
export type ItemRoutingRule = (
  answers: Record<string, Answer>,
  item: CookbookItem,
  labelFor: (item: CookbookItem) => string
) => RoutedItem;

/** The per-item half of a cookbook: the same questions asked against each of
 *  a list of items, with each item routed on its own. */
export type ItemsSpec = {
  /** Plural noun for the list, e.g. "Citations". */
  noun: string;
  /** The editable fields of one item, in render order. */
  fields: { name: string; label: string; rows: number }[];
  /** The state string sent to the model for one item. */
  toState: (item: CookbookItem) => string;
  /** The row label for one item — a per-item rule cannot use the
   *  cookbook's static `labels`, which is keyed by question. */
  labelFor: (item: CookbookItem) => string;
  /** A check that needs no model call. Returning a RoutedItem short-
   *  circuits: the item is not sent. Takes `labelFor` for the same reason
   *  the rule does — it builds a row, and a row carries a label. */
  preCheck?: (
    item: CookbookItem,
    labelFor: (item: CookbookItem) => string
  ) => RoutedItem | null;
  items: CookbookItem[];
  rule: ItemRoutingRule;
};

/** Transcribed from the published cookbook — do not rename, re-case, or tidy
 *  the underscore on either side of this map. */
const RELATION_TO_VERDICT: Record<string, string> = {
  supports: "verified",
  contradicts: "contradicted",
  says_nothing: "unsupported",
};

/** Double-checking citations' rule — one `relation` choice answer in, one
 *  verified / contradicted / unsupported verdict out. */
export function citationRule(autoAccept: number): ItemRoutingRule {
  return (answers, item, labelFor) => {
    const answer = answers.relation;
    if (answer === undefined || answer.type !== "choice") {
      throw new Error(
        `citationRule expects a "relation" choice answer; got ${answer === undefined ? "nothing" : answer.type}.`
      );
    }
    const outcome = RELATION_TO_VERDICT[answer.choice];
    if (outcome === undefined) {
      throw new Error(`citationRule does not recognise relation "${answer.choice}".`);
    }
    return {
      key: item.id,
      label: labelFor(item),
      disposition: answer.confidence >= autoAccept ? "auto" : "review",
      outcome,
      detail: formatPercent(answer.confidence),
      value: answer.confidence,
    };
  };
}
