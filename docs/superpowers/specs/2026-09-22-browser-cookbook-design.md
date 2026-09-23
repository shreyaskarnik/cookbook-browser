# Cookbook in the Browser — design

**Date:** 2026-09-22
**Status:** proposed, awaiting review

## What this is

An interactive twin of [TypeSafe's cookbooks](https://docs.typesafe.ai/cookbooks): every documented
pattern, runnable in a browser tab, with the state and the questions editable.

TypeSafe documents 18 cookbooks and ships one interactive demo (Smart Home Assistant), with a note
on that page inviting people to send in use cases. Their playground is excellent for a single
question but every cookbook is a *composition* — several questions in one request, or two rounds, or
a threshold over a probability — and a composition is the thing a static page cannot show.

The pitch is one line: **try the cookbook in your browser.** No key, no signup, no upload.

### Non-goals

- **No comparison with Jev.** We never put a local model's numbers next to TypeSafe's published
  benchmark results. The local model is the engine that makes this free and offline; it is not a
  contender. Benchmark numbers belong to the cookbooks and stay there.
- **No dataset reproduction.** Cards carry a handful of hand-picked sample states, not evaluation
  sets. Nothing on the page claims to reproduce a published measurement.
- Not a replacement for the docs. Every card links to its cookbook.

## Shape

A single static page, published as a Hugging Face Space under `shreyask/`.

```
┌────────────┬──────────────────────────────────────┬──────────────┐
│ Sidebar    │  Card: the cookbook, wired up        │ Examples     │
│            │                                      │              │
│ Self-      │  ┌────────────────────────────────┐  │ sample state │
│  consist.  │  │ State        (editable)         │  │ sample state │
│ Batching   │  └────────────────────────────────┘  │ sample state │
│ How-to     │  ┌────────────────────────────────┐  │              │
│ Extraction │  │ Questions    (typed cards)      │  │ ─ your own ─ │
│ Classif.   │  └────────────────────────────────┘  │ [paste here] │
│            │  ┌────────────────────────────────┐  │              │
│            │  │ Answers   (bars + the knob)     │  │              │
│            │  └────────────────────────────────┘  │              │
└────────────┴──────────────────────────────────────┴──────────────┘
```

The sidebar mirrors the docs' own five categories and names, so someone arriving from a cookbook
page finds the same structure. The three-pane body follows TypeSafe's console playground, which is
the layout their users already know — with the difference that a preset here is a whole cookbook
rather than one question.

## Engines

One interface, two implementations, chosen by a toggle:

| Engine | Default | How | Data |
|---|---|---|---|
| Local | yes | `open-jev` (MIT) over Transformers.js, WebGPU with WASM fallback | never leaves the tab |
| TypeSafe | opt-in | the user pastes their own API key | the state goes to TypeSafe's API |

Both speak the same three primitives, so a card's code is identical under either engine and only the
adapter differs. That property is worth stating on the page: the pattern is the point, not the model.

### Model sizes

`kev-0.6b` (q4f16, ~340 MB) loads first so the page is usable quickly, and `kev-4b` (q4f16, ~2.3 GB)
is offered as the better answer for anyone on a modern machine — most are. The page recommends 4B
where WebGPU reports enough memory, keeps 0.6B as the fast/low-end path, and lets either be chosen
explicitly. `open-jev` (DeBERTa-v3-large, ~350 MB, 512-token context) is available for short states.

Key handling: `sessionStorage` only, never a URL parameter, never logged, with a visible "clear key"
control and a plain sentence saying what leaves the machine when the toggle is on. Local stays the
default on every visit.

## Cards

All 18 cookbooks appear. Five are built first, because each has a knob that is invisible on a static
page and obvious once you can move it:

1. **Confidence routing** (self-consistency, nouls + choices) — a threshold slider; the share sent to
   review and the share auto-actioned move as you drag.
2. **Parallel questions** (batching) — the same questions run as N separate calls and as one call,
   with a wall-clock bar for each. Locally measured, honest, and the core idea of System One.
3. **Re-ranking** — a shortlist reorders itself as scores arrive.
4. **Function calling** — type a request, watch the tool probabilities compete before one wins, with
   confidence gating the call.
5. **Line-by-line search** — a document with each line lit by its score.

The remaining 13 ship as runnable examples with sample states, and get a knob when one is worth
building. Each card states which cookbook it comes from and links to it.

Every card has a "bring your own state" box. Because it is local and free, pasting a real support
ticket or document costs nothing and sends nothing.

## Mechanics

- **One model, many cards.** The model loads once into a Web Worker and stays resident, so moving
  between cookbooks is instant. This is the thing a notebook cannot do.
- **First visit:** the download is explicit — size, cache status, device (WebGPU or WASM) — before
  anything starts, following the pattern in `shreyask/needle-playground`.
- **Multi-round cookbooks** (SDE cascade, hierarchical classification, date extraction) run their
  rounds visibly, one step at a time, so the composition is legible rather than hidden.
- **No WebGPU** (Firefox today): the page says so and falls back to WASM, with a warning that it will
  be slow.

## Risks

- **Model quality.** A small model will get things wrong in ways Jev would not. Mitigation: the page
  is about patterns and makes no accuracy claims; `kev-4b` is the recommended default wherever the
  machine can hold it, with `kev-0.6b` as the quick path.
- **Scope.** 18 cards is a lot of surface. Mitigation: the five interactive ones are the product;
  the rest are a gallery that can grow.
- **Download size** is the main bounce risk, more so at 4B. Mitigation: start on 0.6B so the first
  card runs within a minute, offer the 4B upgrade in place once someone is already using the page,
  and cache aggressively so the second visit is instant.

## Open questions

- Whether to include a DuckDB-WASM card (SQL over a dropped CSV with a judgment column, mirroring
  MotherDuck's `prompt_jev()`) as a "batch classification" entry in a later version. It fits the
  gallery and needs a query-rewrite trick, since DuckDB-WASM's JS UDFs are synchronous.

## Reference implementation

`nico-martin/open-jev-demo` ([GitHub](https://github.com/nico-martin/open-jev-demo),
[Space](https://huggingface.co/spaces/nico-martin/open-jev-demo)) is the package author's own demo
and the closest working precedent. It is four fixed use cases, run over five canned samples each,
with no editable state and no knobs — which is precisely the gap this project fills. Its stack is
worth copying outright: Vite + React 19 + Tailwind 4, `pnpm`, and a GitHub Action that rsyncs
`dist/` into the Space with the HF README front matter generated at deploy time.

What we take: the deploy workflow, the load screen's shape (model picker, dtype picker, progress,
cached/size disclosure), and `optimizeDeps.exclude: ["@huggingface/transformers"]` with
`build.target: "esnext"`, which are both required for the ONNX runtime to work under Vite.

What we do differently: the state and the questions are editable, a card is a whole cookbook rather
than one `decide()` call, and the compositions (thresholds, rounds, re-ranking) are the point.

### Verified API

Checked against `open-jev@0.1.2` type declarations, not the README:

```ts
const jev = await OpenJev.load({ model, dtype, device, onProgress });
const answers = await jev.decide(stateText, { key: question, ... }, { temperature, maxStateTokens, truncation });
```

- `decide()` accepts questions as an **array** (answers come back as a tuple) or an **object**
  (answers keyed the same way), and answers **all of them in one forward pass**. The batching card
  compares N calls against one call; both sides are real.
- Every answer carries its full distribution, which is what the knobs act on:
  `NoulAnswer {answer, probability, confidence}`,
  `ChoiceAnswer {choice, confidence, probabilities}`,
  `ScoreAnswer {score, normalized, level, confidence, probabilities}`.
  `score` is the expected level index and may fall between levels — that is the re-ranking signal.
- `choice(instructions, options, descriptions?)` takes an optional description per option;
  `score(instructions, levels)` does not. Cards that need per-level guidance put it in the
  instructions.
- `OpenJev.info({model, device, dtype})` returns `isCached`, `downloadSize` and the file list
  **without loading**, so the first-visit disclosure is exact rather than hard-coded.
- `dtype: "auto"` already resolves to `q4f16` when `shader-f16` is available and `q4` otherwise,
  and `device: "auto"` to WebGPU when present. The pickers disclose what was chosen; they are not
  a decision the visitor has to make.
- Context: `kev-*` allow 8192 state tokens, `open-jev` 256 (512 whole sequence). Long-document
  cards must be on a `kev` model or chunk.
- `jev.countTokens(text)` sizes a pasted state before it is sent; `truncation: "error"` turns an
  over-long state into a message instead of a silent cut.
