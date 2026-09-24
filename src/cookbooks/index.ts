import { CATALOG } from "./catalog";
import citationCheck from "./citationCheck";
import consistencyChoice from "./consistencyChoice";
import consistencyNoul from "./consistencyNoul";
import guardrails from "./guardrails";
import type { CookbookDefinition, CookbookEntry } from "./types";

const DEFINITIONS: Record<string, CookbookDefinition> = {
  [consistencyNoul.id]: consistencyNoul,
  [consistencyChoice.id]: consistencyChoice,
  [guardrails.id]: guardrails,
  [citationCheck.id]: citationCheck,
};

/** The ids that have a real definition registered above. The catalog's
 *  "built" status should always agree with membership here — derived so
 *  that registering a definition is the only edit a new card requires. */
export const BUILT_IDS: readonly string[] = Object.keys(DEFINITIONS);

export function getEntry(id: string): CookbookEntry {
  const entry = CATALOG.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown cookbook: ${id}`);
  return entry;
}

export function getDefinition(id: string): CookbookDefinition {
  const definition = DEFINITIONS[id];
  if (!definition) throw new Error(`Cookbook ${id} has no definition yet`);
  return definition;
}

export { CATALOG, CATEGORIES, docsUrl, builtCookbooks, entriesInCategory } from "./catalog";
export type { CookbookCategory, CookbookDefinition, CookbookEntry, Sample } from "./types";
