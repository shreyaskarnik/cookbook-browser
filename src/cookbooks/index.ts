import { CATALOG } from "./catalog";
import consistencyNoul from "./consistencyNoul";
import type { CookbookDefinition, CookbookEntry } from "./types";

const DEFINITIONS: Record<string, CookbookDefinition> = {
  [consistencyNoul.id]: consistencyNoul,
};

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
