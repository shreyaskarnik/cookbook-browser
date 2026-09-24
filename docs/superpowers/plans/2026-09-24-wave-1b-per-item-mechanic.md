# Wave 1b — the per-item mechanic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one cookbook's questions against a *list* of items, route each item on its own, and ship Double-checking citations as the first card of that shape.

**Architecture:** `RoutedItem` gains a rule-owned `outcome` so a rule can say more than "auto or review" — every rule already smuggled a third state into free text. A per-item cookbook then declares an item list and an item rule; the card issues one `decide` per item, shows them landing one at a time, and renders one row per item. Single-state cookbooks are untouched.

**Tech Stack:** React 19, TypeScript, Vite 8 (Rolldown), Vitest 5, Tailwind 4, `open-jev` over Transformers.js.

**Spec:** `docs/superpowers/specs/2026-09-23-phase-2-remaining-cookbooks-design.md`
**Probe:** `docs/superpowers/notes/2026-09-24-wave-1b-probe.md` — read it before Task 3.

## Global Constraints

- **Questions come verbatim from the published cookbook.** Copy the exact strings from this plan. Do not reword, re-case, or "fix" punctuation. Option keys (`supports`, `contradicts`, `says_nothing`) are the cookbook's and are load-bearing.
- **A card's model requirement is measured, never guessed.** The measurement for this card is in the probe note. Do not invent a new one.
- **Copy rule:** never compare this model to TypeSafe's Jev, never put local numbers beside TypeSafe's published benchmarks, and make no claim about accuracy or quality — not "correctly", not "reliably", not "better". Describe what a card *does* and what a visitor can *move*. Sample `meta` strings describe what is in the sample, never what the model will answer. Six sweeps have been run on this project; five violations were found, three written by a controller.
- **Imports:** cookbook and routing files import types from `src/engine/types`, never `src/engine` — the barrel re-exports Worker code and the `scripts/` tsconfig has no DOM lib.
- **Do not run `git commit`, `git add` or `git checkout`.** Commit signing needs an interactive pinentry and hangs non-interactively. Leave work in the tree; the controller commits.
- **Do not run `pnpm smoke` or `pnpm smoke:1b`** unless a task says to. They download real weights.
- `pnpm test` and `pnpm build` must pass at the end of every task.

## File Structure

```
src/cookbooks/
  routing.ts          RoutedItem gains `outcome`; the three rules populate it; routeAll removed
  items.ts            NEW — the per-item types and the citation rule, pure, no React
  citationCheck.ts    NEW — the cookbook: one verbatim choice, samples, code sample
  types.ts            CookbookDefinition gains an optional `items` block
  index.ts            registers citationCheck
  catalog.ts          citation-check status -> "built"
src/lib/
  routing.ts          routeAll deleted; bandSummary keeps its own input
src/components/panes/
  AnswersPane.tsx     renders `outcome` beside `detail`, still colours by `disposition`
  ItemsPane.tsx       NEW — the editable item list and its per-item rows
src/components/cards/
  CookbookCard.tsx    runs N items when the definition declares them; one state otherwise
```

---

### Task 1: Give a routed row its own outcome word

Every rule already encodes a third state in `detail` — `bandRule` writes "Yes"/"No"/"Review", `hazardRule` writes "block", `minimumConfidenceRule` writes the chosen option — while `disposition` has only two values and `AnswersPane` can colour by nothing else. A block and a benign row currently render the same colour. Doing this now costs three cards; after Wave 1b it costs more every wave.

**Files:**
- Modify: `src/cookbooks/routing.ts`, `src/cookbooks/routing.test.ts`, `src/components/panes/AnswersPane.tsx`, `src/components/cards/CookbookCard.test.tsx`, `src/lib/routing.ts`, `src/lib/claimVerdict.test.ts`

**Interfaces:**
- Produces: `RoutedItem` with a required `outcome: string`.

- [ ] **Step 1: Write the failing test**

Add to `src/cookbooks/routing.test.ts`:

```ts
it("gives every routed row a word of its own, not only a disposition", () => {
  const routed = bandRule(0.3, 0.7)({ covered: noulAnswer(0.95) }, { covered: "Covered" });
  expect(routed[0].outcome).toBe("Yes");
  expect(routed[0].detail).toBe("95%");
});

it("says 'Block' on a severity override, where the disposition alone says only 'auto'", () => {
  const routed = hazardRule(0.35, 0.7, 2.0, "severity")(
    { jailbreak: noulAnswer(0.41), severity: scoreAnswer(2.22) },
    { jailbreak: "Jailbreak", severity: "Severity" }
  );
  const row = routed.find((entry) => entry.key === "jailbreak")!;
  expect(row.outcome).toBe("Block");
  expect(row.disposition).toBe("auto");
});
```

Use the existing `noulAnswer`/`scoreAnswer` helpers in that file; if they are named differently, use whatever is there rather than adding new ones.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/cookbooks/routing.test.ts`
Expected: FAIL — `outcome` is not a property of `RoutedItem`.

- [ ] **Step 3: Add the field and populate it**

In `src/cookbooks/routing.ts`:

```ts
export type RoutedItem = {
  key: string;
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
  value: number;
};
```

`bandRule`: `outcome` is `"Yes" | "No" | "Review"`, `detail` is the percentage alone.
`minimumConfidenceRule`: `outcome` is the chosen option, `detail` is the confidence percentage.
`hazardRule`: `outcome` is `"Block"`, `"Review"` or `"Clear"`; `detail` stays the percentage, and the severity row's `outcome` is its truncated level with `detail` the normalized value.

- [ ] **Step 4: Render it**

`AnswersPane` renders `outcome` and `detail` in the right-hand column, outcome first. Card one's existing assertion that a row reads `"Yes (95%)"` must still pass — compose the two rather than changing the test. Keep colouring by `disposition`.

- [ ] **Step 5: Delete `routeAll`**

`routeAll` in `src/lib/routing.ts` has no production caller — only its own tests, and `bandSummary` builds its input through it. Delete `routeAll`; give `bandSummary`'s tests their input directly. If deleting turns out to require changing what `bandSummary` computes, stop and say so rather than changing its behaviour.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test && pnpm build`
Expected: all pass. Report the counts.

---

### Task 2: The per-item types and the citation rule

**Files:**
- Create: `src/cookbooks/items.ts`, `src/cookbooks/items.test.ts`
- Modify: `src/cookbooks/types.ts`

**Interfaces:**
- Consumes: `Answer` from `../engine/types`; `RoutedItem` from `./routing`.
- Produces:
  ```ts
  export type CookbookItem = { id: string; fields: Record<string, string> };
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
  export type ItemRoutingRule = (
    answers: Record<string, Answer>,
    item: CookbookItem,
    labelFor: (item: CookbookItem) => string
  ) => RoutedItem;
  export function citationRule(autoAccept: number): ItemRoutingRule;
  ```

`CookbookDefinition` gains `items?: ItemsSpec`. A definition has `items` or it does not; single-state cookbooks are unchanged and `routing` stays required for them.

- [ ] **Step 1: Write the failing test**

`src/cookbooks/items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Answer } from "../engine/types";
import { citationRule } from "./items";

const item = { id: "c1", fields: { claim: "A claim.", section: "A section." } };
const labelFor = () => "Citation 1";
const relation = (choice: string, confidence: number): Record<string, Answer> => ({
  relation: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } },
});

describe("citationRule", () => {
  it("auto-accepts a confident verdict and names it", () => {
    const routed = citationRule(0.8)(relation("supports", 0.93), item, labelFor);
    expect(routed.outcome).toBe("verified");
    expect(routed.disposition).toBe("auto");
  });

  it("sends the same verdict to a person below the floor", () => {
    const routed = citationRule(0.8)(relation("supports", 0.79), item, labelFor);
    expect(routed.outcome).toBe("verified");
    expect(routed.disposition).toBe("review");
  });

  it("maps each of the cookbook's three relations to its verdict", () => {
    const at = (choice: string) => citationRule(0.8)(relation(choice, 0.9), item, labelFor).outcome;
    expect(at("supports")).toBe("verified");
    expect(at("contradicts")).toBe("contradicted");
    expect(at("says_nothing")).toBe("unsupported");
  });

  it("refuses an answer that is not a choice, naming the key", () => {
    const wrong = { relation: { type: "noul", answer: true, probability: 0.9, confidence: 0.9 } } as Record<string, Answer>;
    expect(() => citationRule(0.8)(wrong, item, labelFor)).toThrow(/relation/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test src/cookbooks/items.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

The verdict map is the cookbook's, verbatim:

```ts
const RELATION_TO_VERDICT: Record<string, string> = {
  supports: "verified",
  contradicts: "contradicted",
  says_nothing: "unsupported",
};
```

`citationRule(autoAccept)` reads the `relation` answer, throws naming the key if it is not a choice, and returns one `RoutedItem`: `outcome` the verdict, `disposition` `"auto"` when `confidence >= autoAccept` else `"review"`, `detail` the confidence as a percentage, `value` the confidence, `label` from `labelFor(item)`, `key` the item's id.

- [ ] **Step 4: Run tests, then the whole suite**

Run: `pnpm test && pnpm build`

---

### Task 3: The Double-checking citations cookbook

**Read `docs/superpowers/notes/2026-09-24-wave-1b-probe.md` first.** It records what this card does at both model sizes, and its `requires` value comes from there, not from you.

**Every string in this task is quoted from the published cookbook. Transcribe exactly.**

**Files:**
- Create: `src/cookbooks/citationCheck.ts`, `src/cookbooks/citationCheck.test.ts`
- Modify: `src/cookbooks/index.ts`, `src/cookbooks/catalog.ts`

**Interfaces:**
- Consumes: `choice` from `open-jev`; `citationRule` from `./items`.
- Produces: `const citationCheck: CookbookDefinition` as the default export.

- [ ] **Step 1: The question, verbatim**

```ts
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
```

- [ ] **Step 2: The item spec**

`noun: "Citations"`. Fields: `claim` (label "Claim", 2 rows), `quote` (label "Quote", 2 rows) and `section` (label "Section", 6 rows). All three are editable; the quote is what the pre-check looks for inside the section. `toState` renders them as `Claim: …` then a blank line then `Section: …`. `labelFor` returns the claim truncated to a readable length — this is the row label, and it is what the reviewer flagged that `resolveLabel` cannot supply for a list.

`preCheck`: the cookbook's `fabricated` verdict. If the item's `quote` is non-empty and does not appear in its `section`, return a `RoutedItem` with `outcome: "fabricated"`, `disposition: "auto"`, `value: 1`, and a `detail` saying the quote is not in the section — **without asking the model.** The cookbook checks this before the model call, and a check that costs nothing is worth showing.

- [ ] **Step 3: Samples**

Four to six citations over a shared source document, written by us, in the cookbook's own subject area (a claim plus the section it rests on). At least one where the section supports the claim, one where it contradicts it, one where it says nothing, and one whose quote is absent from the section so the pre-check fires.

`meta` describes what is in the sample, never what the model will answer. "the section states the opposite" is fine; "the model should say contradicts" is not.

- [ ] **Step 4: `requires`**

`model: "kev-0.6b"`. The probe measured this card at both sizes; 0.6B is where its mechanic is visible. `why` is **one sentence** naming a concrete, non-quality reason — what the floor does, or what the card costs to run. Put any measurement detail in a comment above the block, not in the string a visitor reads.

- [ ] **Step 5: Register and flip the catalog**

Add to `src/cookbooks/index.ts`; set `citation-check` status to `"built"` in `src/cookbooks/catalog.ts`. The catalog description must describe what the card does — check it against the card before you finish.

- [ ] **Step 6: Tests**

`citationCheck.test.ts` asserts: the question text matches the cookbook's string exactly; the three option keys are exactly `supports`, `contradicts`, `says_nothing`; every sample has the fields `toState` reads; the pre-check fires on the fabricated sample and not on the others. The existing derived guards in `catalog.test.ts` will also now cover this cookbook — check they still pass.

---

### Task 4: Run a list of items

**Files:**
- Create: `src/components/panes/ItemsPane.tsx`
- Modify: `src/components/cards/CookbookCard.tsx`, `src/components/cards/CookbookCard.test.tsx`

**Interfaces:**
- Consumes: `ItemsSpec`, `CookbookItem` from `../../cookbooks/items`.

- [ ] **Step 1: Write the failing tests**

In `CookbookCard.test.tsx`, using `FakeEngine`:

```ts
it("asks once per item and shows one row per item", async () => { /* … */ });
it("shows how many items have landed while a run is in flight", async () => { /* … */ });
it("keeps the other items when one item's request fails", async () => { /* … */ });
it("does not ask the model for an item its pre-check already decided", async () => { /* … */ });
it("re-routes every item when a control moves, without asking again", async () => { /* … */ });
```

Write the bodies against the real component API as you build it. The fourth and fifth are the ones that matter most: the pre-check existing at all is the point of the cookbook's `fabricated` verdict, and re-routing without re-asking is this project's whole pitch.

- [ ] **Step 2: Run them and watch them fail**

- [ ] **Step 3: Extend the run state**

`Completed` currently holds one flat `answers` record for one `forState`. For a per-item cookbook it holds a result per item:

```ts
type ItemOutcome =
  | { id: string; kind: "answered"; answers: Record<string, Answer> }
  | { id: string; kind: "precheck"; routed: RoutedItem }
  | { id: string; kind: "failed"; message: string };
```

`forState` becomes a signature of the whole item list, so the existing stale marking keeps working — it must still be true that editing any item marks the results stale.

One item failing must not fail the run. Items land one at a time and the count in flight is visible.

- [ ] **Step 4: `ItemsPane`**

Renders the item list: each item's fields editable, an add and a remove control, and each item's routed row once a run has produced one. Reuse `AnswersPane`'s row shape where it fits rather than inventing a second visual language.

- [ ] **Step 5: Wire the card**

A definition with `items` renders `ItemsPane` instead of `StatePane`; one without is unchanged. The three existing cards must keep passing their tests untouched.

- [ ] **Step 6: Run the whole suite and build**

---

## Done when

- [ ] `RoutedItem` carries an `outcome` and all three existing rules populate it — **Task 1**
- [ ] `routeAll` is gone — **Task 1**
- [ ] A cookbook can declare a list of items and a rule that routes one item — **Task 2**
- [ ] Double-checking citations exists as a definition with verbatim questions — **Task 3**
- [ ] The card asks once per item, shows them landing, and survives one item failing — **Task 4**
- [ ] The pre-check decides an item without a model call — **Tasks 2 and 4**
- [ ] `citation-check` is reachable from the sidebar and renders its own card — **Tasks 3 and 4**
- [ ] `pnpm test` and `pnpm build` pass — every task
