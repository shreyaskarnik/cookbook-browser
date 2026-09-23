import type { CookbookCategory, CookbookEntry } from "./types";

export const CATEGORIES: readonly CookbookCategory[] = [
  "Self-consistency",
  "Batching",
  "How-to",
  "Extraction",
  "Classification",
];

/** Every cookbook TypeSafe documents, in the order the index page lists them.
 *  Titles and descriptions follow the docs so someone arriving from a cookbook
 *  page recognises the entry. */
export const CATALOG: readonly CookbookEntry[] = [
  {
    id: "consistency-noul",
    title: "Self-consistency: nouls",
    slug: "consistency_noul_cookbook",
    category: "Self-consistency",
    description:
      "Route uncertain probabilities to human review while keeping the underlying noul values visible.",
    status: "built",
  },
  {
    id: "consistency-choice",
    title: "Self-consistency: choices",
    slug: "consistency_choice_cookbook",
    category: "Self-consistency",
    description:
      "Add uncertain outcomes to moderation decisions and compare label agreement with automatic action rates.",
    status: "built",
  },
  {
    id: "parallel-questions",
    title: "Parallel questions",
    slug: "parallel_questions",
    category: "Batching",
    description: "Ask many questions about one state in a single request.",
    status: "planned",
  },
  {
    id: "rerank",
    title: "Re-ranking",
    slug: "rerank_typesafe",
    category: "How-to",
    description: "Score a retrieval shortlist and reorder it.",
    status: "planned",
  },
  {
    id: "semantic-find",
    title: "Line-by-line search",
    slug: "semantic_find",
    category: "How-to",
    description:
      "Score every line of a document against a query in one request, with confidence checks.",
    status: "planned",
  },
  {
    id: "autoformat",
    title: "Structure recovery",
    slug: "autoformat",
    category: "How-to",
    description:
      "Reconstruct Markdown from plain text by stitching lines and classifying blocks.",
    status: "planned",
  },
  {
    id: "function-calling",
    title: "Function calling",
    slug: "function_calling",
    category: "How-to",
    description:
      "Map a natural-language request to a typed function with confidence-aware questions.",
    status: "planned",
  },
  {
    id: "skill-suggestion",
    title: "Skill suggestion",
    slug: "skill_suggestion",
    category: "How-to",
    description: "Pick one skill from a large set by ranking and then verifying.",
    status: "planned",
  },
  {
    id: "entity-alignment",
    title: "Knowledge graph entity alignment",
    slug: "entity_alignment",
    category: "How-to",
    description:
      "Match catalog pairs with score questions that reveal which fields disagree.",
    status: "planned",
  },
  {
    id: "classifying-rag-passages",
    title: "Classifying RAG passages",
    slug: "classifying_rag_passages",
    category: "How-to",
    description:
      "Score retrieved passages to filter which ones reach the answering model.",
    status: "planned",
  },
  {
    id: "citation-check",
    title: "Double-checking citations",
    slug: "citation_check",
    category: "How-to",
    description: "Verify that a quote's context supports the claim it is cited for.",
    status: "planned",
  },
  {
    id: "llm-guardrails",
    title: "Guardrails for LLMs",
    slug: "llm_guardrails",
    category: "How-to",
    description:
      "Screen input and output by thresholding hazard probabilities and severity levels.",
    status: "planned",
  },
  {
    id: "sde-cascade",
    title: "SDE cascade",
    slug: "sde_cascade",
    category: "Extraction",
    description: "Extract, verify, then reason — a two-stage cascade.",
    status: "planned",
  },
  {
    id: "date-extraction",
    title: "Date extraction",
    slug: "date_extraction_cookbook",
    category: "Extraction",
    description:
      "Extract date parts, resolve them in code, and route low-confidence cases to review.",
    status: "planned",
  },
  {
    id: "pre-parsed-value-extraction",
    title: "Pre-parsed value extraction",
    slug: "pre_parsed_value_extraction_cookbook",
    category: "Extraction",
    description:
      "Filter regex candidates down to the right verbatim value.",
    status: "planned",
  },
  {
    id: "hierarchical-classification",
    title: "Hierarchical classification",
    slug: "hierarchical_classification",
    category: "Classification",
    description:
      "Classify through a deep hierarchy with a parallel beam search over probabilities.",
    status: "planned",
  },
  {
    id: "autoresearch-feature-discovery",
    title: "Autoresearch feature discovery",
    slug: "autoresearch_feature_discovery",
    category: "Classification",
    description:
      "Propose questions iteratively to improve a supervised model's features.",
    status: "planned",
  },
  {
    id: "classification-using-confidence",
    title: "Classification using confidence",
    slug: "classification_using_confidence",
    category: "Classification",
    description:
      "Classify into a large label set and read confidence to decide how specific to be.",
    status: "planned",
  },
];

export function docsUrl(entry: CookbookEntry): string {
  return `https://docs.typesafe.ai/cookbooks/${entry.slug}`;
}

export function builtCookbooks(): CookbookEntry[] {
  return CATALOG.filter((entry) => entry.status === "built");
}

export function entriesInCategory(category: CookbookCategory): CookbookEntry[] {
  return CATALOG.filter((entry) => entry.category === category);
}
