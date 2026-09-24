import { choice } from "open-jev";
import type { CookbookItem, ItemsSpec } from "./items";
import { citationRule } from "./items";
import type { UnmeasuredItem } from "./routing";
import type { CookbookDefinition } from "./types";

/** The cookbook's own floor: a verdict below this confidence goes to a
 *  person rather than being auto-accepted. Baked into `citationRule` below,
 *  the per-item rule that actually routes each citation. */
const AUTO_ACCEPT = 0.8;

/** How long a label can run before it stops reading as one line in the item
 *  list. Truncates on a character boundary rather than a word boundary,
 *  matching `firstClause` (`./routing.ts`) in not trying to be clever about it. */
const MAX_LABEL_LENGTH = 60;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Claim first, then the section it rests on. The quote is not part of the
 *  state sent to the model — it exists only for `preCheck` below — so it is
 *  deliberately left out here. */
function toState(item: CookbookItem): string {
  return `Claim: ${item.fields.claim}\n\nSection: ${item.fields.section}`;
}

/** The row label for one citation: its claim, truncated. A per-item rule
 *  labels from the item itself — see `ItemRoutingRule`'s comment on why
 *  `resolveLabel` cannot do this for a list. */
function labelFor(item: CookbookItem): string {
  return truncate(item.fields.claim, MAX_LABEL_LENGTH);
}

/** A citation whose quote does not occur in its own section did not need a
 *  model call to catch — it is a string search, not a judgment. Checked
 *  before every model call so it never spends one.
 *
 *  Returns an `UnmeasuredItem`: there is no confidence behind a string search,
 *  so the row this builds draws no bar. `detail` is a phrase rather than the
 *  sentence it once was, because the row renders it in brackets after the
 *  outcome — "fabricated (quote not in the section)" reads as an aside, where
 *  a full sentence inside brackets does not. */
function preCheck(
  item: CookbookItem,
  labelForItem: (item: CookbookItem) => string
): UnmeasuredItem | null {
  const quote = item.fields.quote;
  if (quote.length > 0 && !item.fields.section.includes(quote)) {
    return {
      key: item.id,
      label: labelForItem(item),
      disposition: "auto",
      outcome: "fabricated",
      detail: "quote not in the section",
    };
  }
  return null;
}

/** Five citations against a shared source document (an object-storage
 *  administrator guide, written for this cookbook — not a real product's
 *  docs). Covers all three relations plus the one pre-check catches:
 *  supports (retention-window, versioning-lock), contradicts
 *  (key-rotation), says-nothing (replication-cost), and fabricated
 *  (log-retention, whose quote is not the section's actual number). */
const CITATIONS: CookbookItem[] = [
  {
    id: "retention-window",
    fields: {
      claim: "Nimbus deletes Cold Tier objects automatically after 90 days of inactivity.",
      quote: "are automatically and permanently deleted",
      section:
        "Cold Tier objects that receive no read or write activity for 90 consecutive days " +
        "are automatically and permanently deleted; there is no recovery window once this " +
        "deletion job runs. Administrators can raise the inactivity threshold up to 365 " +
        "days from the Lifecycle Rules panel, but the default is 90 days for every new bucket.",
    },
  },
  {
    id: "key-rotation",
    fields: {
      claim: "Nimbus automatically rotates customer-managed encryption keys every 30 days.",
      quote: "are never rotated by Nimbus on the customer's behalf",
      section:
        "Customer-managed encryption keys (CMEKs) are never rotated by Nimbus on the " +
        "customer's behalf. Key rotation is solely the customer's responsibility, performed " +
        "through their KMS provider; Nimbus only re-wraps existing object keys the next time " +
        "each object is read or rewritten after a new key version is registered.",
    },
  },
  {
    id: "replication-cost",
    fields: {
      claim: "Enabling multi-region replication doubles a bucket's monthly storage bill.",
      quote: "copies every object to a minimum of two additional regions",
      section:
        "Multi-region replication copies every object to a minimum of two additional " +
        "regions chosen from the bucket's replication set, using asynchronous, " +
        "eventually-consistent transfer. Replication lag is typically under 60 seconds but " +
        "is not guaranteed, and objects written during a regional outage are queued and " +
        "replicated once the affected region recovers.",
    },
  },
  {
    id: "log-retention",
    fields: {
      claim: "Nimbus retains access logs for 400 days by default.",
      quote: "logs are retained for 400 days by default",
      section:
        "Access logs record every authenticated request to a bucket, including the " +
        "caller's identity, source IP, and response code. By default, Nimbus retains access " +
        "logs for 180 days before deleting them; customers on the Enterprise plan may " +
        "configure retention up to 3 years.",
    },
  },
  {
    id: "versioning-lock",
    fields: {
      claim: "Once you turn on object versioning for a bucket, you cannot turn it back off.",
      quote: "cannot be disabled — it can only be suspended",
      section:
        "Object versioning, once enabled on a bucket, cannot be disabled — it can only " +
        "be suspended, after which new writes stop creating versions but every version " +
        "created while it was enabled remains in storage and continues to be billed until " +
        "explicitly deleted.",
    },
  },
];

const ITEMS: ItemsSpec = {
  noun: "Citations",
  fields: [
    { name: "claim", label: "Claim", rows: 2 },
    { name: "quote", label: "Quote", rows: 2 },
    { name: "section", label: "Section", rows: 6 },
  ],
  toState,
  labelFor,
  preCheck,
  items: CITATIONS,
  rule: citationRule(AUTO_ACCEPT),
};

const citationCheck: CookbookDefinition = {
  id: "citation-check",
  questions: {
    relation: choice(
      "How does the section relate to the claim?",
      ["supports", "contradicts", "says_nothing"],
      {
        supports: "The section states the claim or directly implies that it is true",
        contradicts: "The section states the opposite of the claim or implies it is false",
        says_nothing: "The section does not address what the claim asserts, either way",
      }
    ),
  },
  labels: {
    relation: "Relation",
  },
  code: `import { OpenJev, choice } from "open-jev";

const jev = await OpenJev.load({ model: "kev-0.6b" });

const relation = choice(
  "How does the section relate to the claim?",
  ["supports", "contradicts", "says_nothing"],
  {
    supports: "The section states the claim or directly implies that it is true",
    contradicts: "The section states the opposite of the claim or implies it is false",
    says_nothing: "The section does not address what the claim asserts, either way",
  }
);

const FLOOR = 0.8;

for (const citation of citations) {
  // A quote absent from its own section is a string search, not a
  // judgment — it needs no model call.
  if (citation.quote && !citation.section.includes(citation.quote)) {
    flagFabricated(citation);
    continue;
  }

  const state = \`Claim: \${citation.claim}\\n\\nSection: \${citation.section}\`;
  const { relation: answer } = await jev.decide(state, { relation });

  if (answer.confidence < FLOOR) sendToHuman(citation, answer);
  else recordVerdict(citation, answer.choice);
}`,
  // Measured on THESE items, not on the probe's — `pnpm smoke:citations`, CPU,
  // q4. An earlier version of this `why` described the probe's citations while
  // reading as a claim about the ones a visitor sees; they are different text
  // and were never run.
  //
  //                    kev-0.6b                     kev-4b
  //   retention-window verified   71%  to a person  verified     99%  auto
  //   key-rotation     unsupported 68% to a person  contradicted 98%  auto
  //   replication-cost unsupported 87% auto         unsupported  59%  to a person
  //   log-retention    pre-check, no model call     pre-check, no model call
  //   versioning-lock  verified   90%  auto         verified     98%  auto
  //
  // Per item: 128–204 ms at 0.6B, 974–1027 ms at 4B. The floor has a case to
  // catch at both sizes, so this is about how long a list takes to work
  // through, not about which size produces which verdict.
  //
  // Every figure in the table above is CPU, q4, in Node, via
  // `pnpm smoke:citations` — NOT the runtime a visitor gets, which is WebGPU
  // and q4f16 in a browser. The one in-browser measurement in the record is 425
  // ms across 4 model requests at 0.6B; there is no in-browser 4B figure at
  // all. So no duration from here may be described to a visitor as what their
  // browser will do, which is why `why` below states no timing.
  requires: {
    model: "kev-0.6b",
    why: "Two of these citations land below the 0.8 auto-accept floor and go to a person, so the floor has a case to catch here. Each citation is its own request, so the list is worked through one at a time.",
  },
  items: ITEMS,
};

export default citationCheck;
