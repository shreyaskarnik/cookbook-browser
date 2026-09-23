import type { Question } from "../engine/types";
import type { RoutingRule } from "./routing";

/** The five section headings on docs.typesafe.ai/cookbooks, in their order there. */
export type CookbookCategory =
  | "Self-consistency"
  | "Batching"
  | "How-to"
  | "Extraction"
  | "Classification";

export type CookbookEntry = {
  id: string;
  title: string;
  /** Path segment under docs.typesafe.ai/cookbooks/. */
  slug: string;
  category: CookbookCategory;
  description: string;
  /** "built" is clickable; "planned" shows in the sidebar but is not. */
  status: "built" | "planned";
};

export type Sample = {
  id: string;
  label: string;
  meta: string;
  text: string;
};

/** The runnable half of a cookbook: what gets asked, what to try it on, and the
 *  code a reader would write to do the same thing themselves. */
export type CookbookDefinition = {
  /** Matches a CookbookEntry.id. */
  id: string;
  questions: Record<string, Question>;
  /** Short row labels, keyed like `questions`. */
  labels: Record<string, string>;
  samples: Sample[];
  code: string;
  /** How this cookbook decides what a person sees versus what is actioned.
   *  Cookbooks genuinely differ here — see src/cookbooks/routing.ts. */
  routing: RoutingRule;
  /** Which model this cookbook needs to produce a result worth looking at.
   *  MEASURED, never guessed — see the spec's viability probe. `why` states
   *  what was actually observed, so the banner can say something specific. */
  requires: { model: "kev-0.6b" | "kev-4b"; why: string };
  /** Keys among `questions` that a person must be sure about before
   *  `claimVerdict` (`src/lib/routing.ts`) can call the claim "auto" —
   *  uncertainty elsewhere can be absorbed, uncertainty here cannot. This is
   *  a judgment call specific to consistency-noul's claims-handling card, not
   *  a fact every cookbook has, so it is optional: the other two cookbooks
   *  route without any notion of "critical". */
  criticalKeys?: readonly string[];
};
