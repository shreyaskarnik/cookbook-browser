import type { ReactElement } from "react";
import type { CookbookDefinition } from "../../cookbooks";
import type { RoutedItem } from "../../cookbooks/routing";
import ClaimVerdictHeadline from "./ClaimVerdictHeadline";

/** What a headline is given. Everything here is already on screen in some
 *  form — a headline says something about the run as a whole that the
 *  per-question rows cannot say on their own. */
export type HeadlineProps = {
  /** The rule's own output, in the vocabulary every pane speaks. A headline
   *  reads this rather than the raw answers, so it sees exactly what the rows
   *  below it show — including the effect of wherever the controls are set. */
  routed: RoutedItem[];
  definition: CookbookDefinition;
  /** The routing rule's current parameter values, keyed as the rule names
   *  them. A headline that re-reads a threshold — card one's band, say —
   *  reads the same numbers the rule was built from. */
  params: Record<string, number>;
  /** True once the state has moved on from the text these answers describe.
   *  A headline dims itself rather than out-asserting the rows below it. */
  stale: boolean;
};

export type Headline = (props: HeadlineProps) => ReactElement;

/**
 * A cookbook may say something about a run as a whole, above its per-question
 * rows. Most do not, and a card with no headline simply omits that line.
 *
 * This is a registry rather than a field on `CookbookDefinition` because a
 * headline is a React component and the definitions are plain data compiled
 * under `tsconfig.node.json`, which has neither DOM nor JSX (see
 * `scripts/model.smoke.ts`, which imports a definition). Keeping the prose
 * here is what lets a definition stay importable from a script.
 */
const HEADLINES: Record<string, Headline> = {
  "consistency-noul": ClaimVerdictHeadline,
};

export function getHeadline(id: string): Headline | null {
  return HEADLINES[id] ?? null;
}
