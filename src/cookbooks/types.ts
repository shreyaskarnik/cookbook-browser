import type { Question } from "../engine/types";
import type { ItemsSpec } from "./items";
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
 *  code a reader would write to do the same thing themselves.
 *
 *  A definition carries either `routing` and `samples` (a single-state
 *  cookbook) or `items` (a per-item one) — never neither, and a per-item
 *  cookbook has no use for a whole-state `routing` or a flat `samples` list.
 *  This type does not enforce that split — a discriminated union would ripple
 *  through every `getDefinition` consumer for a payoff the card gets
 *  structurally — so it is enforced over every registered cookbook by the
 *  "declares exactly one shape" guard in `catalog.test.ts`. The card still
 *  throws on a shapeless definition as a backstop, but that throw is now
 *  unreachable for anything registered. `code` stays required either way:
 *  every cookbook has a code sample a reader can copy, whatever its shape. */
export type CookbookDefinition = {
  /** Matches a CookbookEntry.id. */
  id: string;
  questions: Record<string, Question>;
  /** Short row labels, keyed like `questions`. */
  labels: Record<string, string>;
  /** Absent on a per-item cookbook, which offers its `items` to try instead. */
  samples?: Sample[];
  code: string;
  /** How this cookbook decides what a person sees versus what is actioned.
   *  Cookbooks genuinely differ here — see src/cookbooks/routing.ts. Absent
   *  on a per-item cookbook, which routes through `items.rule` instead. */
  routing?: RoutingRule;
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
  /** The per-item half of a cookbook, for one that routes a list of items
   *  rather than a single state. A definition has `items` or it does not;
   *  single-state cookbooks are unchanged and `routing`/`samples` stay
   *  required for them either way. */
  items?: ItemsSpec;
};
