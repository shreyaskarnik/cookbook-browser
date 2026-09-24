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

## Addendum — the shipped citations, measured on themselves

The probe above used citations written for the probe. The card ships a different set, and
`requires.why` makes a claim about where the floor has a case to catch — which is a claim about
the items a visitor actually sees. Measured with `pnpm smoke:citations`, CPU, q4:

| Citation | kev-0.6b | kev-4b |
|---|---|---|
| retention-window | verified 71% → a person | verified 99% → auto |
| key-rotation | unsupported 68% → a person | contradicted 98% → auto |
| replication-cost | unsupported 87% → auto | unsupported 59% → **a person** |
| log-retention | pre-check, no model call | pre-check, no model call |
| versioning-lock | verified 90% → auto | verified 98% → auto |

Per item: 128–204 ms at 0.6B, 974–1027 ms at 4B.

The claim this replaced said no citation falls below the floor at 4B. On the shipped set one does.
It was not fabricated — it was true of the probe's citations — which is the point: a measurement
generalised onto different content reads exactly like a measured one and is not. Caught by review,
which asked whether `why` matched what was actually measured rather than whether it sounded right.

## Addendum 2 — the smoke harness is not representative of a browser

Prompted by a live run of the choices card, compared against the same sample measured here.
One run per configuration, one sample, so read it as a direction and not a magnitude.

Same cookbook, same sample (`borderline-post`), same eight questions:

| Question | browser, WebGPU/q4f16 | CPU/q4f16 | CPU/q4 |
|---|---|---|---|
| Category | None 50% | None 50% | Spam 54% |
| Primary risk | Harassment 75% | AccountHistory 37% | Harassment 35% |
| Directed at | None 56% | None 89% | None 87% |
| Enforcement action | Strike 49% | Remove 41% | Remove 51% |
| Queue | Threat 29% | Spam 88% | Spam 91% |
| Link handling | Allow 57% | Allow 74% | Allow 74% |
| Final call | Human 71% | Human 91% | Human 88% |
| Severity | High 43% | None 38% | Low 40% |

**Neither CPU configuration reproduces the browser.** Matching the browser's dtype fixes one row
and leaves the rest apart; `Queue` differs by the whole width of the scale, 29% against 88%, and
picks a different option. Device is doing at least as much work as dtype.

Every probe in this project, and every `requires.why` counted claim, was measured on CPU. Visitors
run WebGPU. This is the same lesson as the citations `why` correction, one level up: not the
timings, the answers.

**Consequences, recorded rather than acted on:**

1. A `why` should not make a counted claim ("three of the eight fall below the floor") unless the
   count was taken in a browser. `consistencyChoice` and `guardrails` both do.
2. The decision to cut Classifying RAG passages rests on CPU numbers. The 4B result — the
   injection passage the only one included — is damning enough that a browser check is unlikely
   to reverse it, but the decision has not been made on the runtime a visitor uses.
3. `pnpm smoke` is a viability *screen*, not a measurement of what ships. It is still the right
   cheap first filter; it is not evidence for a sentence on the page.

**Also tested and disconfirmed:** whether the model favours whichever option is listed first.
Reversing every option list moved two winners of eight, both between low-confidence options where
it was already unsure. Option order is not driving these answers.

## Addendum 3 — the two counted `why` claims, re-measured in a browser

kev-0.6b, WebGPU/q4f16, Apple metal-3, local dev build. Three repeats of one sample returned
byte-identical rows, so the model is deterministic on identical input; the CPU/browser gap in
addendum 2 is the runtime, not noise.

**Guardrails — the claim holds.** Severity across its three samples: 0.31, 0.09, 0.85 against the
cookbook's 2.0 override. CPU measured a peak of 0.87, the browser 0.85. The override genuinely
never fires at this size, which is what `requires.why` says.

**Self-consistency: choices — two clauses held, one did not.**

| Sample | below the 0.60 floor | enforcement action |
|---|---|---|
| Borderline post | 4 of 8 | Remove |
| Clearly fine | 1 of 8 | Allow |
| Ambiguous | 3 of 8 | Remove |

"Three of the eight fall below the floor on the ambiguous post" — holds. "Remove against Allow"
on borderline versus benign — holds. **"Spam against None" does not**: it contrasted the two
posts' Category, which is Spam on CPU and None in a browser, so both posts read None to a
visitor and the contrast does not exist. Dropped rather than reworded. Same failure as the
citations card, found the same way: a real measurement describing a run nobody sees.

Also disconfirmed here: hard line breaks in the state change nothing. The wrapped and unwrapped
forms of the same post return identical rows.
