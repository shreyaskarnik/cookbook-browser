# Wave 1b viability probe

**Date:** 2026-09-24 · **Harness:** `pnpm smoke:1b` (`scripts/wave1b.smoke.ts`), CPU, q4.
Questions verbatim from the published cookbooks. Items written by us — the RAG cookbook's own
corpus is Supabase documentation under Apache 2.0 and is not ours to redistribute.

## Framing was tested before capability was blamed

A first run sent only `Query:` and the passage text. It produced **no signal**: five passages,
five `exclude`, the clearly relevant one at 12% relevance. The cookbook states that every request
sends all four passage fields, so the probe was reframed to send `id`, `title`, `source_type` and
`text`. Same model, same questions: relevance on the correct passage moved **12% → 64%** and the
cascade began producing three different outcomes.

This is the spec's guardrails lesson repeating exactly. A flat result is a question-design
hypothesis before it is a capability finding.

## Classifying RAG passages — NOT VIABLE at either size

Query: "Refresh tokens expire after 30 days - how do I extend that window?"

| Passage | 0.6B | routed | 4B | routed |
|---|---|---|---|---|
| sessions-refresh (the right answer) | rel 64 ev 58 | **include** ✓ | rel 26 ev 29 | exclude ✗ |
| sessions-timeout (contradicts premise) | rel 2 contra 3 | exclude ✗ | rel 4 contra 18 | exclude ✗ |
| keys-rotation (near miss) | rel 36 | exclude ✓ | rel 4 | exclude ✓ |
| magic-link (off topic) | rel 62 ev 70 | include ✗ | rel 1 | exclude ✓ |
| forum-injection | inj 69 | exclude (no evidence) | inj 49 rel 90 ev 80 | **include** ✗✗ |

**0.6B:** two of the cascade's four branches never fire. Injection peaks at 69% against a strict
`> 0.70`; the conflict route peaks at 3% against `> 0.70`. The same "inert branch" argument that
made guardrails require 4B — except here the larger model does not rescue it.

**4B is worse, and worse in the one direction that matters.** Every legitimate passage is
excluded, and the prompt-injection passage is the *only* one included. A card whose demo routes an
injection into the answer context demonstrates the inverse of the cookbook's own lesson, on a
route the cookbook puts first *because it is a security decision*. Injection detection drops 69% →
49% going up in size.

Second instance of the spec's "bigger is not uniformly better", far starker than the first.

## Double-checking citations — viable at 0.6B, with one honest failure

| Citation | 0.6B | 4B |
|---|---|---|
| supported | supports 84% → verified (auto) ✓ | supports 98% → verified ✓ |
| contradicted | says_nothing 91% → unsupported ✗ | **supports 95% → verified** ✗✗ |
| says-nothing | says_nothing 69% → to a person ✓ | says_nothing 82% → unsupported (auto) ✓ |

Both sizes get the contradicted citation wrong, and both are confident about it; 4B is worse,
calling a contradicting section `supports` at 95%. Note what the 0.6B column shows about the
mechanic though: the says-nothing citation lands at 69%, **below the cookbook's 0.8 auto-accept**,
so it routes to a person. That is the cookbook's actual lesson working — the floor catching a
case the model is unsure about — and it is visible at 0.6B.

Timing: 0.6B 126–235 ms per item; 4B 0.8–1.3 s per item.

## Caveats

One query and five passages; three citations. Sound for a scope decision, unsound for any
per-card accuracy claim — which this project does not make anyway.
