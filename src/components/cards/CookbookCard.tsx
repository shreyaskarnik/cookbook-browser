import { useEffect, useMemo, useState } from "react";
import { docsUrl, getDefinition, getEntry } from "../../cookbooks";
import type { RoutedItem, RuleParameter } from "../../cookbooks/routing";
import type { Answer, Engine } from "../../engine";
import { describeError } from "../../engine";
import { formatDuration, formatPercent } from "../../lib/format";
import ModelRequirement from "../model/ModelRequirement";
import AnswersPane from "../panes/AnswersPane";
import QuestionsPane from "../panes/QuestionsPane";
import SamplesRail from "../panes/SamplesRail";
import StatePane from "../panes/StatePane";
import { getHeadline } from "./headlines";

/** One finished run. These three always travel together: a duration describes
 *  a set of answers, and both describe one exact state string.
 *
 *  `answers` is `Answer`, not `NoulAnswer`: cookbooks ask noul, choice and
 *  score questions, and the card is not the place that decides which of those
 *  are acceptable. Each routing rule validates the answer types it needs and
 *  throws naming the offending key (see `src/cookbooks/routing.ts`), so a
 *  mismatch is still reported rather than rendered as a NaN bar. */
type Completed = {
  forState: string;
  answers: Record<string, Answer>;
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

/** The current position of every control, keyed as the rule names it. This is
 *  read back from a rebuilt rule rather than from the raw drag, so a rule whose
 *  parameters constrain each other — `bandRule`'s two bounds swap rather than
 *  crossing — keeps the controls where it actually put them. */
function valuesOf(parameters: readonly RuleParameter[]): Record<string, number> {
  return Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.value]));
}

/** A token count and whether it came from the real tokenizer. One value,
 *  because "42" and "that 42 is exact" are two facts about the same string and
 *  a count without its provenance is an estimate shown as fact. */
type TokenCount = { value: number; exact: boolean };

/**
 * The card for any cookbook. It takes an id rather than a definition: the card
 * already needs both halves of a cookbook — its `CookbookDefinition` for what
 * to ask and its `CookbookEntry` for the title, description and docs link — and
 * an id is the one thing that resolves both. `Shell` tracks a selected id, so
 * passing it through means the selection travels as one value with no chance of
 * a definition and an entry that describe different cookbooks.
 */
export default function CookbookCard({
  id,
  engine,
  onUpgrade,
}: {
  id: string;
  engine: Engine;
  /** Threaded from `Shell` in a later plan. Absent here, `ModelRequirement`
   *  still explains the requirement but omits the upgrade button. */
  onUpgrade?: () => void;
}) {
  const definition = getDefinition(id);
  const entry = getEntry(id);
  const Headline = getHeadline(id);

  const [state, setState] = useState(definition.samples![0].text);
  const [tokenCount, setTokenCount] = useState<TokenCount>(() => ({
    value: engine.countTokens(definition.samples![0].text),
    exact: false,
  }));
  const [run, setRun] = useState<Run>({ kind: "idle" });

  // `definition.routing` is the rule at the thresholds its cookbook publishes,
  // and it is also where those thresholds are declared. The card starts every
  // control at the rule's own default and never names a threshold itself.
  const declared = definition.routing!.controls ?? null;
  const [values, setValues] = useState<Record<string, number>>(() =>
    declared ? valuesOf(declared.parameters) : {}
  );

  // Derived, rather than stored, so the parts cannot drift apart.
  const completed =
    run.kind === "ok" ? run.completed
    : run.kind === "running" || run.kind === "failed" ? run.previous
    : null;
  const answers = completed?.answers ?? null;
  // True once the state has moved on from the text these answers describe.
  // The answers stay on screen — re-routing them by moving a control is still a
  // reasonable thing to do — but they are no longer about what is in the box.
  const stale = completed !== null && completed.forState !== state;
  const running = run.kind === "running";
  const error = run.kind === "failed" ? run.message : null;

  // Re-routing is pure, so moving a control re-renders without touching the
  // model — the rule is simply rebuilt at the new thresholds. This is the whole
  // point of the cards, and it is what their copy promises.
  const rule = useMemo(
    () => (declared ? declared.rebuild(values) : definition.routing),
    [declared, values, definition]
  );
  // The rebuilt rule's own controls: the same knobs, carrying wherever the rule
  // settled them. Sliders read from here, not from `values`, so a constrained
  // parameter shows its resolved position rather than the raw drag.
  const controls = rule!.controls ?? null;

  // The per-row answers, in the shared `RoutedItem` vocabulary every cookbook's
  // pane speaks. A rule throws when an answer is not the type it needs, and
  // that throw happens here rather than inside an event handler — so it is
  // caught and reported like any other failure, instead of blanking the card.
  const routing = useMemo((): { items: RoutedItem[]; error: string | null } => {
    if (!answers) return { items: [], error: null };
    try {
      // Non-null because this card renders only single-state cookbooks today,
      // which always carry a whole-state rule. A per-item definition has
      // `items` and no `routing`, is registered but not advertised, and so
      // cannot reach here yet — the next task adds the branch that runs it.
      return { items: rule!(answers, definition.labels), error: null };
    } catch (caught) {
      return { items: [], error: describeError(caught) };
    }
  }, [answers, rule, definition]);

  // Only reads from a run that itself completed — `completed` also holds a
  // stale run's duration while `running`/`failed`, but showing that duration
  // beside a fresh attempt (or a failure banner) would read as though it
  // timed the attempt in progress, rather than the one before it.
  const elapsed = run.kind === "ok" ? run.completed.elapsedMs : null;
  const questionCount = Object.keys(definition.questions).length;

  // The tokenizer lives in the worker, so an exact count is only available
  // asynchronously. Show the synchronous estimate immediately, then replace it
  // once the real count arrives. Debounced so typing does not queue a request
  // per keystroke, and guarded so a slow reply for older text cannot overwrite
  // the count for newer text.
  useEffect(() => {
    setTokenCount({ value: engine.countTokens(state), exact: false });
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
          setTokenCount({ value: exactCount, exact: true });
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

  /** Move one control and re-route. The rule is rebuilt, never re-asked: the
   *  model is not touched here, which is what the copy above the controls
   *  promises. The new positions are read back off the rebuilt rule, so a rule
   *  that constrains its parameters against each other keeps the controls
   *  where it put them rather than where the drag ended. */
  const moveControl = (name: string, value: number) => {
    if (!declared) return;
    const rebuilt = declared.rebuild({ ...values, [name]: value });
    // A rebuilt rule that declares nothing back cannot say where it put the
    // control, so the raw move stands rather than being silently dropped.
    setValues(
      rebuilt.controls ? valuesOf(rebuilt.controls.parameters) : { ...values, [name]: value }
    );
  };

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
          answers: result,
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

        <ModelRequirement
          requires={definition.requires}
          runtime={engine.runtime}
          onUpgrade={onUpgrade}
        />

        <StatePane
          value={state}
          onChange={setState}
          tokens={tokenCount.value}
          exact={tokenCount.exact}
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
              {questionCount} questions in one request, {formatDuration(elapsed)}
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm">
            <span className="font-semibold">The decision failed. </span>
            {error}
          </p>
        )}

        {routing.error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm">
            <span className="font-semibold">These answers could not be routed. </span>
            {routing.error}
          </p>
        )}

        {answers && (
          <>
            {stale && (
              <p className="rounded-xl border border-review/30 bg-review/10 p-3 text-sm text-review">
                <span className="font-semibold">Stale. </span>
                The state has changed since this run — the results below are for
                the previous text. Run again to match what is in the box now.
              </p>
            )}

            {/* A rule that threw routed nothing, so `routing.items` is empty.
                The headline and the rows both read their content off that
                list, and an empty list reads as a real result — "0 of 0
                questions go to review" — sitting under a banner saying the
                answers could not be routed. The controls stay: they assert
                nothing, and moving one rebuilds the rule. */}
            {(controls || (Headline && !routing.error)) && (
              <section className="rounded-2xl border border-line bg-white p-4">
                {controls && (
                  <>
                    <h3 className="font-semibold">{controls.title}</h3>
                    <p className="mt-1 text-sm text-stone">{controls.help}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-6">
                      {controls.parameters.map((parameter) => (
                        <label
                          key={parameter.name}
                          className="flex items-center gap-2 text-sm"
                        >
                          {parameter.label}
                          <input
                            type="range"
                            aria-label={parameter.label}
                            min={parameter.min}
                            max={parameter.max}
                            step={parameter.step}
                            value={parameter.value}
                            onChange={(event) =>
                              moveControl(parameter.name, Number(event.target.value))
                            }
                          />
                          <span className="w-12 tabular-nums">
                            {parameter.format === "percent"
                              ? formatPercent(parameter.value)
                              : parameter.value.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {Headline && !routing.error && (
                  <Headline
                    routed={routing.items}
                    definition={definition}
                    params={values}
                    stale={stale}
                  />
                )}
              </section>
            )}

            {!routing.error && (
              <AnswersPane
                routed={routing.items}
                band={controls?.reviewBand}
                stale={stale}
              />
            )}
          </>
        )}
      </div>

      <SamplesRail
        samples={definition.samples!}
        onPick={(sample) => {
          setState(sample.text);
          // One assignment clears answers, their timing, and any error
          // together — otherwise a failure banner from the previous sample
          // survives the switch, now describing a state that was never run.
          setRun({ kind: "idle" });
        }}
        disabled={running}
      />
    </div>
  );
}
