# What Phase 1 learned, for whoever builds card two

Phase 1 shipped one interactive cookbook out of eighteen. These are the findings from building
and reviewing it that change what the next card should do. They are ordered by how much they cost
if ignored.

## 1. Collapse the card's parallel state before writing card two

**Do this first, because card two will be a copy of card one.**

The same defect appeared eight times across this branch, written by five different agents: state
outliving the thing it described. Stale answers, a stale error (twice), a stale size lookup, a
stale progress percentage, a stale verdict, a stale duration.

They are not eight bugs. They are one design gap, and the generator is parallel `useState`
sharing an implicit invariant — ten of them in the card, seven in the load gate. `answers`,
`answeredState`, `elapsed` and `error` must always move together, and nothing forces it, so every
instance is the same event: someone updated three of the four.

Replace them with one discriminated union:

```ts
type Run =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; forState: string; answers: Record<string, NoulAnswer>; elapsedMs: number }
  | { kind: "failed"; forState: string; message: string };
```

Three things then follow without anyone having to remember them:

- `elapsedMs` cannot exist without `answers`
- clearing on a new sample is one assignment, so you cannot clear three of four
- staleness has exactly one definition, so the verdict cannot disagree with the rows about it

**The load-bearing detail:** `forState` must live *inside* the variant, not beside it.
`answeredState` was already the right primitive — it was just applied once, by hand, to one of the
four things that needed it.

Put the rationale as a comment on the `Run` type, where someone reaching for a sixth `useState`
will actually read it.

## 2. Two tests to delete, one to rewrite

Of Phase 1's 104 tests, roughly 70 genuinely constrain behaviour and ~25 restate data. Three are
worse than neutral, and each fails in a different way worth recognising:

- **`catalog.test.ts` "puts every entry in one of the five documented categories" cannot fail.**
  `category` is typed as a closed union, so a violating entry fails `tsc` before the test runs. It
  reads as exactly the invariant you want, and the type system silently already owns it.
  *Generalisation: before asserting anything about a typed field, ask whether `tsc` owns it.*
- **"marks exactly one cookbook built in Phase 1" is a tripwire disguised as an assertion.** It
  fails on the next card by design, teaching whoever hits it that a red test can mean "you did the
  work". If the reminder is wanted it belongs in a checklist, not the suite.
- **`claimVerdict.test.ts` "never returns a raw key as English" is a tombstone.** It pins the
  absence of a field name that used to exist. Rename the field and put English back in it and the
  test still passes. The real contract is structural: `ClaimVerdict` has no string field at all.

*The last two are the same root cause from opposite ends: a test that fails by design and a test
that pins an absence both record **history** rather than **contract**, and history is what tests
are worst at holding.*

Also: `toHaveLength(18)` and the `docsUrl` assertion are circular — delete. The uniqueness test is
worth keeping but rewrite it to drop the magic number
(`expect(new Set(CATALOG.map(e => e.slug)).size).toBe(CATALOG.length)`), because once seventeen
more entries land a duplicated slug becomes a plausible copy-paste error that silently points two
cards at one docs page.

## 3. Known follow-ups, none blocking

- **`dist/` is ~53 MB, about half of it dead.** Vite emits a hashed copy of the ONNX runtime WASM
  from `onnxruntime-web/webgpu`'s own internal `new URL(...)`, which is never fetched now that
  `wasmPaths` points at our own copy. It is LFS-tracked and pushed to the Space. Fix with a
  `generateBundle` hook doing `delete bundle[key]` — **not** a `closeBundle` unlink-by-glob: the
  asset never reaches disk that way, and a pattern that stops matching after a Vite upgrade
  degrades to "back to dead weight" rather than "deleted something live". Throw if zero keys
  matched, or a silent no-op puts you back here without telling anyone.
- **`pnpm-workspace.yaml`'s `esbuild: true` entry is stale and its comment is false.** Vite 8
  bundles with Rolldown; esbuild appears in the lockfile only as an optional peer and is not
  installed. The comment claims `pnpm build` fails without it. Three-line deletion, plus the
  `.npmrc` twin.
- **`fake.ts`'s `options as readonly string[]` cast is a provable no-op.** The type already
  narrows. One token. Leave the comment above it alone — "open-jev does not export a helper for
  this" is accurate.
- **Check `Content-Encoding` on the Space after the first deploy.** The runtime is 25.6 MB raw and
  about 6.3 MB gzipped. If Hugging Face's static host does not compress `application/wasm`, the
  load gate's "tens of megabytes" is right; if it does, it is pessimistic. Either way it is safe,
  but the measurement is worth having.

## 4. Things that worked, worth keeping

- **`open-jev` answers all fourteen questions in one forward pass**, 531–646 ms per claim on
  `kev-0.6b`. The batching is real, and it is what makes a card feel immediate.
- **The model reads the claim rather than the question wording.** `documentation` scores 94% on a
  claim with an estimate and photos attached and 18% on one with nothing — a 76-point swing driven
  purely by the text.
- **`FakeEngine` keeps the suite free of model downloads.** Keep that property; CI must never need
  network access for weights.
- **The smoke check (`pnpm smoke`) is the go/no-go for a new card.** Run it before building UI: if
  the probabilities for a new cookbook's questions come back clustered, the card is not viable at
  that model size and no amount of interface work fixes it.
