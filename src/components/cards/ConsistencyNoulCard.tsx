import { useEffect, useMemo, useState } from "react";
import { docsUrl, getDefinition, getEntry } from "../../cookbooks";
import type { Answer, Engine, NoulAnswer } from "../../engine";
import { describeError } from "../../engine";
import { formatDuration, formatPercent } from "../../lib/format";
import {
  DEFAULT_BAND,
  bandSummary,
  claimVerdict,
  clampBand,
  routeAll,
} from "../../lib/routing";
import type { ClaimVerdict } from "../../lib/routing";
import AnswersPane from "../panes/AnswersPane";
import QuestionsPane from "../panes/QuestionsPane";
import SamplesRail from "../panes/SamplesRail";
import StatePane from "../panes/StatePane";

const ID = "consistency-noul";

/** One finished run. These three always travel together: a duration describes
 *  a set of answers, and both describe one exact state string. */
type Completed = {
  forState: string;
  answers: Record<string, NoulAnswer>;
  elapsedMs: number;
};

/** Everything a run produces, in one value, so the parts cannot drift apart.
 *  `running` and `failed` carry the previous `Completed` forward — a re-run in
 *  flight, or one that just failed, does not erase results still on screen:
 *  the textarea is disabled while running, so `state` cannot have moved
 *  underneath a failed attempt, and the previous answers are still correct
 *  for the text they describe. `elapsedMs` only ever reads from `"ok"`, so a
 *  failed run still cannot show a duration, even though `previous` has one. */
type Run =
  | { kind: "idle" }
  | { kind: "running"; previous: Completed | null }
  | { kind: "ok"; completed: Completed }
  | { kind: "failed"; message: string; previous: Completed | null };

/** `decide`'s return type covers `choice` and `score` answers too; this cookbook
 *  only ever asks noul questions, but nothing at the type level enforces that.
 *  A future cookbook copied from this file with mixed question types would
 *  otherwise inherit a silent cast that produces answers whose `.probability`
 *  is `undefined` — rendering as `NaN%` bars with no error pointing at the
 *  cause. Throw instead, naming the offending key and its actual type, the
 *  same way `FakeEngine` already refuses a non-noul override. */
function assertNoulAnswers(answers: Record<string, Answer>): Record<string, NoulAnswer> {
  for (const [key, answer] of Object.entries(answers)) {
    if (answer.type !== "noul") {
      throw new Error(
        `Expected a noul answer for "${key}", but got type "${answer.type}".`
      );
    }
  }
  return answers as Record<string, NoulAnswer>;
}

/** `claimVerdict` hands back the offending keys, not English — `routing.ts` is
 *  pure logic over probabilities and has no access to the cookbook's labels.
 *  The card composes the sentence here, substituting the human label for each
 *  key, so a visitor never sees a raw camelCase question key. Wording matches
 *  what `routing.ts` used to produce itself. */
function describeVerdict(verdict: ClaimVerdict, labels: Record<string, string>): string {
  if (verdict.outcome === "auto") {
    const { elsewhereUncertain } = verdict;
    return elsewhereUncertain === 0
      ? "Every question landed outside the band."
      : `${elsewhereUncertain} question${elsewhereUncertain === 1 ? " is" : "s are"} uncertain, but none of the critical ones.`;
  }
  const { criticalUncertainKeys } = verdict;
  return criticalUncertainKeys.length === 1
    ? `${labels[criticalUncertainKeys[0]]} is uncertain.`
    : `${criticalUncertainKeys.length} critical questions are uncertain.`;
}

export default function ConsistencyNoulCard({ engine }: { engine: Engine }) {
  const definition = getDefinition(ID);
  const entry = getEntry(ID);

  const [state, setState] = useState(definition.samples[0].text);
  const [tokens, setTokens] = useState(() => engine.countTokens(definition.samples[0].text));
  const [tokensExact, setTokensExact] = useState(false);
  const [band, setBand] = useState(DEFAULT_BAND);
  const [run, setRun] = useState<Run>({ kind: "idle" });

  // Derived, rather than stored, so the parts cannot drift apart.
  const completed =
    run.kind === "ok" ? run.completed
    : run.kind === "running" || run.kind === "failed" ? run.previous
    : null;
  const answers = completed?.answers ?? null;
  // True once the claim text has moved on from the text these answers describe.
  // The answers stay on screen — re-routing them by dragging the band is still a
  // reasonable thing to do — but they are no longer about what is in the box.
  const stale = completed !== null && completed.forState !== state;
  const running = run.kind === "running";
  const error = run.kind === "failed" ? run.message : null;

  // Re-routing is pure, so dragging the slider re-renders without touching the model.
  const routed = useMemo(
    () => (answers ? routeAll(answers, band) : []),
    [answers, band]
  );
  const summary = bandSummary(routed);
  const verdict = routed.length > 0 ? claimVerdict(routed) : null;
  // Only reads from a run that itself completed — `completed` also holds a
  // stale run's duration while `running`/`failed`, but showing that duration
  // beside a fresh attempt (or a failure banner) would read as though it
  // timed the attempt in progress, rather than the one before it.
  const elapsed = run.kind === "ok" ? run.completed.elapsedMs : null;

  // The tokenizer lives in the worker, so an exact count is only available
  // asynchronously. Show the synchronous estimate immediately, then replace it
  // once the real count arrives. Debounced so typing does not queue a request
  // per keystroke, and guarded so a slow reply for older text cannot overwrite
  // the count for newer text.
  useEffect(() => {
    setTokens(engine.countTokens(state));
    setTokensExact(false);
    // Captured in a local so it narrows to a defined function for the closure
    // below — `engine.primeTokenCount` itself would stay optional there, since
    // narrowing on a property access does not persist across a closure boundary.
    const primeTokenCount = engine.primeTokenCount;
    if (!primeTokenCount) return;
    let current = true;
    const timer = setTimeout(() => {
      primeTokenCount(state)
        .then((exactCount) => {
          if (!current) return;
          setTokens(exactCount);
          setTokensExact(true);
        })
        .catch(() => {
          // An estimate already shows; a failed count is not worth surfacing.
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [engine, state]);

  const runCard = async () => {
    // Carried forward into both `running` and `failed`, so a re-run in
    // flight — or one that just failed — does not blank out results still
    // on screen from the run before it.
    const previous = run.kind === "ok" ? run.completed : run.kind === "failed" ? run.previous : null;
    setRun({ kind: "running", previous });
    const started = performance.now();
    try {
      const result = await engine.decide(state, definition.questions);
      setRun({
        kind: "ok",
        completed: {
          forState: state,
          answers: assertNoulAnswers(result),
          elapsedMs: performance.now() - started,
        },
      });
    } catch (caught) {
      // `describeError` guarantees a non-empty sentence — this is rendered
      // to the visitor, and a rejection here need not have round-tripped
      // through the worker's own error handling to reach this catch.
      setRun({ kind: "failed", message: describeError(caught), previous });
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        <header>
          <h2 className="text-2xl font-bold tracking-tight">{entry.title}</h2>
          <p className="mt-1 text-stone">
            {entry.description}{" "}
            <a
              href={docsUrl(entry)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Read the cookbook
            </a>
            .
          </p>
        </header>

        <StatePane
          value={state}
          onChange={setState}
          tokens={tokens}
          exact={tokensExact}
          disabled={running}
        />

        <QuestionsPane
          questions={definition.questions}
          labels={definition.labels}
        />

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={runCard}
            disabled={running}
            className="rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {running ? "Running…" : answers ? "Run again" : "Run"}
          </button>
          {elapsed !== null && !running && (
            <span className="text-sm text-stone">
              14 questions in one request, {formatDuration(elapsed)}
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm">
            <span className="font-semibold">The decision failed. </span>
            {error}
          </p>
        )}

        {answers && (
          <>
            {stale && (
              <p className="rounded-xl border border-review/30 bg-review/10 p-3 text-sm text-review">
                <span className="font-semibold">Stale. </span>
                The claim text has changed since this run — the results below are
                for the previous text. Run again to match what is in the box now.
              </p>
            )}

            <section className="rounded-2xl border border-line bg-white p-4">
              <h3 className="font-semibold">Uncertainty band</h3>
              <p className="mt-1 text-sm text-stone">
                Anything inside the band goes to a person. Drag the bounds and watch
                the answers move — the model is not asked again.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  Lower bound
                  <input
                    type="range"
                    aria-label="Lower bound"
                    min={0}
                    max={1}
                    step={0.01}
                    value={band.low}
                    onChange={(event) =>
                      setBand(
                        clampBand({ ...band, low: Number(event.target.value) })
                      )
                    }
                  />
                  <span className="w-12 tabular-nums">
                    {formatPercent(band.low)}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Upper bound
                  <input
                    type="range"
                    aria-label="Upper bound"
                    min={0}
                    max={1}
                    step={0.01}
                    value={band.high}
                    onChange={(event) =>
                      setBand(
                        clampBand({ ...band, high: Number(event.target.value) })
                      )
                    }
                  />
                  <span className="w-12 tabular-nums">
                    {formatPercent(band.high)}
                  </span>
                </label>
              </div>
              <p
                data-testid="claim-verdict"
                data-stale={stale ? "true" : "false"}
                className={`mt-3 text-sm ${stale ? "opacity-50" : ""}`}
              >
                <strong>{summary.uncertain}</strong> of {routed.length} questions go
                to review; {formatPercent(summary.automatedShare)} are decided
                automatically.
                {verdict && (
                  <>
                    {" "}
                    <span
                      className={
                        verdict.outcome === "review"
                          ? "text-review font-semibold"
                          : "text-auto font-semibold"
                      }
                    >
                      {verdict.outcome === "review"
                        ? "This claim needs a person."
                        : "This claim can be actioned."}
                    </span>{" "}
                    <span className="text-stone">
                      {describeVerdict(verdict, definition.labels)}
                    </span>
                  </>
                )}
              </p>
            </section>

            <AnswersPane
              routed={routed}
              labels={definition.labels}
              band={band}
              stale={stale}
            />
          </>
        )}
      </div>

      <SamplesRail
        samples={definition.samples}
        onPick={(sample) => {
          setState(sample.text);
          // One assignment clears answers, their timing, and any error
          // together — otherwise a failure banner from the previous sample
          // survives the switch, now describing a claim that was never run.
          setRun({ kind: "idle" });
        }}
        disabled={running}
      />
    </div>
  );
}
