# Phase 2: the remaining cookbooks — design

**Date:** 2026-09-23
**Status:** approved
**Builds on:** `2026-09-22-browser-cookbook-design.md` (Phase 1, shipped: shell, load gate, and
Self-consistency: nouls)

## What this is

Phase 1 made one of TypeSafe's eighteen documented cookbooks interactive. This phase builds the
rest, in waves ordered by measured model viability rather than by the docs' own categories.

The Phase 1 non-goals still bind and are not restated per-card: never compare this model to
TypeSafe's Jev, never put a local number beside a published benchmark, no accuracy claims, and
nothing leaves the visitor's tab.

## What the viability probe found

Before designing anything, five representative cookbook *shapes* were run against the real model at
both `kev-0.6b` and `kev-4b`. The results reordered the work, so they are recorded here rather
than left in a chat log.

| Shape | 0.6B | 4B | Conclusion |
|---|---|---|---|
| Large label set (24 industries) | correct, 99% | correct, 100% | 0.6B is sufficient |
| Function calling (6 tools) | correct, 60% | correct, 90% | 0.6B works; 4B worth offering |
| Date extraction (round one) | weekday 52% | weekday 96% | recommend 4B |
| Line-by-line scoring (8 lines) | all eight identical — no signal | liability cap 2.48 vs 1.00, separates clearly | **requires 4B** |
| Guardrails (nouls + severity) | detects, misjudges | also misjudges | not a model limit — see below |

Three findings shaped this design:

**Intuition was backwards twice.** Large label sets were expected to be the risk and were the
safest result; line-by-line scoring was expected to be routine and is the one shape that produces
nothing usable on the small model.

**Bigger is not uniformly better.** On the guardrails probe, 4B scored *worse* than 0.6B on one
noul (89% to 56%) and rated severity lower. A blanket "use 4B for hard cards" would be wrong.

**The guardrails failure was question design, not capability.** The probe asked whether "there is
a plausible legitimate business reason", and both models answered yes — correctly, since the stated
reason is plausible on its face. The question failed to ask about the part that mattered. This is
the strongest argument for the rule below.

Caveats on that probe, recorded so nobody over-reads it: one example per shape, invented rather
than verbatim questions, and CPU rather than WebGPU inference. It is sound for deciding scope and
unsound for promising per-card accuracy.

## Two rules

**1. Questions come verbatim from the cookbook.** Card one works because its fourteen noul
statements are quoted exactly from TypeSafe's published cookbook. Invented questions produce
results that look like model limitations and are not. Where a cookbook's questions cannot be
recovered from its page, that card is blocked pending the real text rather than approximated.

**2. A card's model requirement is measured, never guessed.** Every `requires` value in this phase
comes from running that card's actual questions at both sizes and observing the difference. The
probe above is the precedent: the two shapes that were guessed wrong were guessed by someone with
the whole design in their head.

## Scope

**Cut: Autoresearch feature discovery.** It proposes questions iteratively to improve a supervised
CatBoost regressor, which requires model training in the browser. Either drop it, or render it as a
read-only walkthrough with no live inference and say plainly that it does not run here. Seventeen
listed cookbooks therefore become sixteen built ones.

### Wave 1 — proven mechanics, 0.6B (6 cards)

Self-consistency: choices · Guardrails for LLMs · Classifying RAG passages · Double-checking
citations · Function calling · Parallel questions.

The first four are the built card's shape: typed questions over one editable state with a
threshold. Function calling adds a choice over tools with confidence gating. Parallel questions
adds a wall-clock comparison of N separate calls against one batched call — its interest is a
timing measurement, not model difficulty, so it carries no viability risk.

### Wave 2 — requires or recommends 4B (4 cards)

Line-by-line search · Re-ranking · Knowledge graph entity alignment · Classification using
confidence.

Each needs its own probe before implementation to set `requires` honestly. Line-by-line is already
measured as 4B-only. Classification using confidence is expected to pass at 0.6B on the large-label
evidence, and must be confirmed rather than assumed.

### Wave 3 — multi-round (6 cards)

SDE cascade · Hierarchical classification · Structure recovery · Date extraction · Pre-parsed value
extraction · Skill suggestion.

These need something the app has no concept of: a round whose input depends on the previous round's
output, run visibly one step at a time so the composition is legible. That step-through is the
wave's real deliverable; the cards are what it carries. Deferred behind waves 1 and 2 so the
mechanic is designed once, against several real cases, rather than invented for the first card that
needs it.

## The model requirement and its callout

Each cookbook definition gains:

```ts
requires: {
  model: "kev-0.6b" | "kev-4b";
  /** What was actually observed, in a sentence a visitor can act on. Not a
   *  generic warning — the specific reason this card needs the larger model. */
  why: string;
}
```

Example, from the measured line-by-line probe: *"At 0.6B all eight lines score identically, so
there is nothing to compare. At 4B the liability clause separates clearly from the rest."*

Surfaced in three places:

- **The sidebar**, so the requirement is visible before a visitor commits to a card.
- **The card**, when the loaded model is below the requirement: a banner quoting that card's `why`
  rather than a generic message. The card stays usable — a visitor may want to run it anyway and
  see the flat result for themselves, which is a legitimate thing to want on a page about
  confidence.
- **An in-place upgrade**: a "Load Kev 4B" control that swaps the engine without leaving the card
  or losing the state the visitor has typed.

A card whose requirement is met shows none of this.

## Prerequisite: collapse the card's state

Before card two, replace the card's parallel `useState` with one discriminated union:

```ts
type Run =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; forState: string; answers: Record<string, NoulAnswer>; elapsedMs: number }
  | { kind: "failed"; forState: string; message: string };
```

`forState` lives inside the variant, not beside it. Phase 1 produced the same defect eight times
across five agents — state outliving what it describes — and every instance was the same event:
four pieces of state that must move together, and nothing forcing it. Card two will be a copy of
card one, so this is done once now or seventeen times later.

Full rationale in `docs/superpowers/notes/2026-09-23-phase-2-inputs.md`.

## Risks

- **A wave-2 or wave-3 card proves unviable even at 4B.** Mitigation: each wave probes before it
  builds, and a card that produces no signal is listed as "not viable in the browser" with the
  measurement shown, rather than shipped flat. That is a more honest page than one that hides it.
- **Verbatim questions may not be recoverable for every cookbook.** Some pages may not publish
  their full question text. Mitigation: such a card is blocked, not approximated — rule 1.
- **Wave 3's step-through mechanic is the largest unknown here.** Mitigation: it is designed once
  against several cookbooks rather than invented for one, which is why it is last.
- **Sixteen cards is a lot of surface to keep honest.** Mitigation: the copy constraints are
  already enforced by review on every task, and each wave is a separate plan with its own gate.

## Open questions

- Whether wave 3's step-through should re-use the card layout with rounds stacked vertically, or
  introduce a stepper. Deferred to wave 3's own design, once wave 2 has shown how much vertical
  space a card really has.
- Whether `open-jev` (DeBERTa, 512-token context) is worth offering per-card for the short-state
  cookbooks, or whether two model tiers is already one too many choices for a visitor.
