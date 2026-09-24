import { useEffect, useMemo, useState } from "react";
import { docsUrl, getDefinition, getEntry } from "../../cookbooks";
import type { CookbookDefinition, Sample } from "../../cookbooks";
import type { CookbookItem, ItemsSpec } from "../../cookbooks/items";
import type { RoutedItem, RoutingRule, RuleParameter } from "../../cookbooks/routing";
import type { Answer, Engine, EngineRuntime } from "../../engine";
import { describeError } from "../../engine";
import { formatDuration, formatPercent } from "../../lib/format";
import ModelRequirement from "../model/ModelRequirement";
import AnswersPane from "../panes/AnswersPane";
import ItemsPane from "../panes/ItemsPane";
import type { ItemRow } from "../panes/ItemsPane";
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
 *
 * Cookbooks come in two shapes and this is where they part. A per-item cookbook
 * declares `items` and genuinely has no whole-state `routing` and no flat
 * `samples`; a single-state one has both and no `items`. Branching here, and
 * handing each card the fields it needs as required props, is what lets both
 * cards read a field without asserting that it is there.
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
  const { items, routing, samples } = definition;

  if (items) {
    return (
      <ItemsCard
        id={id}
        definition={definition}
        spec={items}
        engine={engine}
        onUpgrade={onUpgrade}
      />
    );
  }
  if (!routing || !samples) {
    // A definition with neither shape is a cookbook-authoring mistake, and this
    // says which half is missing rather than blanking the card on a property
    // access. Nothing in `CookbookDefinition` can enforce the split, so it is
    // enforced at the one place that has to know.
    throw new Error(
      `Cookbook ${id} has no items, and no routing rule and samples to run as a single state.`
    );
  }
  return (
    <StateCard
      id={id}
      definition={definition}
      routing={routing}
      samples={samples}
      engine={engine}
      onUpgrade={onUpgrade}
    />
  );
}

/** Title, description, docs link and the model banner — the part of a card that
 *  is the same whichever shape the cookbook is. */
function CardHeader({
  id,
  requires,
  runtime,
  onUpgrade,
}: {
  id: string;
  requires: CookbookDefinition["requires"];
  runtime: EngineRuntime;
  onUpgrade?: () => void;
}) {
  const entry = getEntry(id);
  return (
    <>
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

      <ModelRequirement requires={requires} runtime={runtime} onUpgrade={onUpgrade} />
    </>
  );
}

/** The knobs a card draws, structurally rather than by rule type: a whole-state
 *  `RoutingRule` and a per-item `ItemRoutingRule` declare the same shape of
 *  control and differ only in what `rebuild` returns, which nothing here reads. */
type DrawableControls = {
  title: string;
  help: string;
  parameters: readonly RuleParameter[];
};

/** One control per parameter the rule declares. The heading and the copy come
 *  from the rule too — only the rule knows what its own knobs mean. */
function Controls({
  controls,
  onMove,
}: {
  controls: DrawableControls;
  onMove: (name: string, value: number) => void;
}) {
  return (
    <>
      <h3 className="font-semibold">{controls.title}</h3>
      <p className="mt-1 text-sm text-stone">{controls.help}</p>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        {controls.parameters.map((parameter) => (
          <label key={parameter.name} className="flex items-center gap-2 text-sm">
            {parameter.label}
            <input
              type="range"
              aria-label={parameter.label}
              min={parameter.min}
              max={parameter.max}
              step={parameter.step}
              value={parameter.value}
              onChange={(event) => onMove(parameter.name, Number(event.target.value))}
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
  );
}

/** The card for a cookbook that asks its questions once, against one block of
 *  text. `routing` and `samples` arrive as required props, narrowed by the
 *  dispatcher above. */
function StateCard({
  id,
  definition,
  routing,
  samples,
  engine,
  onUpgrade,
}: {
  id: string;
  definition: CookbookDefinition;
  routing: RoutingRule;
  samples: Sample[];
  engine: Engine;
  onUpgrade?: () => void;
}) {
  const Headline = getHeadline(id);

  const [state, setState] = useState(samples[0].text);
  const [tokenCount, setTokenCount] = useState<TokenCount>(() => ({
    value: engine.countTokens(samples[0].text),
    exact: false,
  }));
  const [run, setRun] = useState<Run>({ kind: "idle" });

  // `routing` is the rule at the thresholds its cookbook publishes, and it is
  // also where those thresholds are declared. The card starts every control at
  // the rule's own default and never names a threshold itself.
  const declared = routing.controls ?? null;
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
    () => (declared ? declared.rebuild(values) : routing),
    [declared, values, routing]
  );
  // The rebuilt rule's own controls: the same knobs, carrying wherever the rule
  // settled them. Sliders read from here, not from `values`, so a constrained
  // parameter shows its resolved position rather than the raw drag.
  const controls = rule.controls ?? null;

  // The per-row answers, in the shared `RoutedItem` vocabulary every cookbook's
  // pane speaks. A rule throws when an answer is not the type it needs, and
  // that throw happens here rather than inside an event handler — so it is
  // caught and reported like any other failure, instead of blanking the card.
  const routed = useMemo((): { items: RoutedItem[]; error: string | null } => {
    if (!answers) return { items: [], error: null };
    try {
      return { items: rule(answers, definition.labels), error: null };
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
        <CardHeader
          id={id}
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

        {routed.error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm">
            <span className="font-semibold">These answers could not be routed. </span>
            {routed.error}
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

            {/* A rule that threw routed nothing, so `routed.items` is empty.
                The headline and the rows both read their content off that
                list, and an empty list reads as a real result — "0 of 0
                questions go to review" — sitting under a banner saying the
                answers could not be routed. The controls stay: they assert
                nothing, and moving one rebuilds the rule. */}
            {(controls || (Headline && !routed.error)) && (
              <section className="rounded-2xl border border-line bg-white p-4">
                {controls && <Controls controls={controls} onMove={moveControl} />}
                {Headline && !routed.error && (
                  <Headline
                    routed={routed.items}
                    definition={definition}
                    params={values}
                    stale={stale}
                  />
                )}
              </section>
            )}

            {!routed.error && (
              <AnswersPane
                routed={routed.items}
                band={controls?.reviewBand}
                stale={stale}
              />
            )}
          </>
        )}
      </div>

      <SamplesRail
        samples={samples}
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

/** What one item produced, and nothing more. The three cases are genuinely
 *  different facts about an item, not one fact with holes in it:
 *
 *  - `answered` keeps the raw answers rather than a routed row, so moving a
 *    control re-routes the item with no new request — the same promise the
 *    single-state card makes, made once per item.
 *  - `precheck` never reached the engine, so there are no answers to keep and
 *    no rule to re-run: the cookbook's own check already produced the row, and
 *    moving a control cannot change it.
 *  - `failed` carries the message alone. One item failing is one row's problem;
 *    the rest of the list keeps its results. */
type ItemOutcome =
  | { id: string; kind: "answered"; answers: Record<string, Answer> }
  | { id: string; kind: "precheck"; routed: RoutedItem }
  | { id: string; kind: "failed"; message: string };

/** One finished pass over the whole list. `forItems` is a signature of the list
 *  as it was run, standing where the single-state card's `forState` stands: any
 *  edit, addition or removal changes it, which is what marks the results stale. */
type CompletedItems = {
  forItems: string;
  outcomes: ItemOutcome[];
  elapsedMs: number;
};

/** A run over the list. There is no whole-run `failed` here, unlike the
 *  single-state card: every item is attempted inside its own try, so a failure
 *  is an `ItemOutcome`, never the end of the run. */
type ItemsRun =
  | { kind: "idle" }
  | { kind: "running"; landed: ItemOutcome[]; total: number }
  | { kind: "ok"; completed: CompletedItems };

/** Ids and field values, in list order. Editing any field, adding an item and
 *  removing one all change this, so all three mark a finished run stale. */
function signatureOf(items: CookbookItem[]): string {
  return JSON.stringify(items.map((item) => [item.id, item.fields]));
}

/** A stable empty list, so a card with no run does not hand `useMemo` a new
 *  array identity on every render. */
const NO_OUTCOMES: ItemOutcome[] = [];

/** The card for a cookbook that asks its questions once per item, against each
 *  of a list. The list is the thing a visitor edits, so it is always on screen;
 *  each item's row appears beside it as that item lands. */
function ItemsCard({
  id,
  definition,
  spec,
  engine,
  onUpgrade,
}: {
  id: string;
  definition: CookbookDefinition;
  spec: ItemsSpec;
  engine: Engine;
  onUpgrade?: () => void;
}) {
  // Copied out of the cookbook, because this list is editable and the
  // definition is shared: without the copy, editing a field here would edit
  // every later visit to this card, and the module itself.
  const [items, setItems] = useState<CookbookItem[]>(() =>
    spec.items.map((item) => ({ id: item.id, fields: { ...item.fields } }))
  );
  // Counts added items so each gets an id of its own. A counter rather than a
  // random id, so two runs of the same sequence produce the same ids.
  const [added, setAdded] = useState(0);
  const [run, setRun] = useState<ItemsRun>({ kind: "idle" });

  const declared = spec.rule.controls ?? null;
  const [values, setValues] = useState<Record<string, number>>(() =>
    declared ? valuesOf(declared.parameters) : {}
  );

  // Rebuilt, never re-asked — exactly as on the single-state card, and the
  // reason `answered` keeps raw answers rather than routed rows.
  const rule = useMemo(
    () => (declared ? declared.rebuild(values) : spec.rule),
    [declared, values, spec]
  );
  const controls = rule.controls ?? null;

  const running = run.kind === "running";
  const completed = run.kind === "ok" ? run.completed : null;
  // Whatever is on screen belongs to one run: the finished one, or the partial
  // results of the one in flight. Never a mixture of the two.
  const outcomes =
    run.kind === "ok" ? run.completed.outcomes
    : run.kind === "running" ? run.landed
    : NO_OUTCOMES;
  const stale = completed !== null && completed.forItems !== signatureOf(items);

  /** One row per item that has produced something, keyed by id. An `answered`
   *  item is routed here rather than when it landed, so it re-routes whenever
   *  the rule is rebuilt. A rule that refuses an item's answers takes out that
   *  item's row and no other. */
  const rows = useMemo((): Record<string, ItemRow> => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const result: Record<string, ItemRow> = {};
    for (const outcome of outcomes) {
      const item = byId.get(outcome.id);
      // Removed from the list since the run: there is nothing to draw it
      // against, and the run as a whole is marked stale anyway.
      if (!item) continue;
      if (outcome.kind === "failed") {
        result[outcome.id] = { kind: "error", message: outcome.message };
        continue;
      }
      if (outcome.kind === "precheck") {
        result[outcome.id] = { kind: "routed", routed: outcome.routed };
        continue;
      }
      try {
        result[outcome.id] = {
          kind: "routed",
          routed: rule(outcome.answers, item, spec.labelFor),
        };
      } catch (caught) {
        result[outcome.id] = { kind: "error", message: describeError(caught) };
      }
    }
    return result;
  }, [outcomes, items, rule, spec]);

  const moveControl = (name: string, value: number) => {
    if (!declared) return;
    const rebuilt = declared.rebuild({ ...values, [name]: value });
    setValues(
      rebuilt.controls ? valuesOf(rebuilt.controls.parameters) : { ...values, [name]: value }
    );
  };

  const editField = (itemId: string, field: string, value: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, fields: { ...item.fields, [field]: value } } : item
      )
    );
  };

  const addItem = () => {
    const next = added + 1;
    setAdded(next);
    setItems((current) => [
      ...current,
      { id: `added-${next}`, fields: Object.fromEntries(spec.fields.map((f) => [f.name, ""])) },
    ]);
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  /** One item, start to finish. The cookbook's own pre-check comes first and
   *  short-circuits: an item it decides is never sent, which is the point of
   *  this cookbook's `fabricated` verdict. Everything is inside the try, so a
   *  cookbook whose `preCheck` or `toState` throws costs one row rather than
   *  the whole run. */
  const runOne = async (item: CookbookItem): Promise<ItemOutcome> => {
    try {
      const preChecked = spec.preCheck?.(item, spec.labelFor) ?? null;
      if (preChecked) return { id: item.id, kind: "precheck", routed: preChecked };
      const answers = await engine.decide(spec.toState(item), definition.questions);
      return { id: item.id, kind: "answered", answers };
    } catch (caught) {
      return { id: item.id, kind: "failed", message: describeError(caught) };
    }
  };

  const runCard = async () => {
    const forItems = signatureOf(items);
    const total = items.length;
    const started = performance.now();
    setRun({ kind: "running", landed: [], total });
    // Sequentially, one request at a time, the way the cookbook's own loop
    // reads — and the reason the count beside the button moves while it runs.
    const landed: ItemOutcome[] = [];
    for (const item of items) {
      landed.push(await runOne(item));
      setRun({ kind: "running", landed: [...landed], total });
    }
    setRun({
      kind: "ok",
      completed: { forItems, outcomes: landed, elapsedMs: performance.now() - started },
    });
  };

  // How many of the items actually cost a request. The pre-check answers one of
  // this cookbook's citations without one, and that difference is the thing
  // worth printing beside the duration.
  const requests = outcomes.filter((outcome) => outcome.kind === "answered").length;
  const noun = spec.noun.toLowerCase();

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <CardHeader
        id={id}
        requires={definition.requires}
        runtime={engine.runtime}
        onUpgrade={onUpgrade}
      />

      <QuestionsPane questions={definition.questions} labels={definition.labels} />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={runCard}
          disabled={running}
          className="rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {running ? "Running…" : completed ? "Run again" : "Run"}
        </button>
        {run.kind === "running" && (
          <span className="text-sm text-stone">
            {run.landed.length} of {run.total} {noun}
          </span>
        )}
        {run.kind === "ok" && (
          <span className="text-sm text-stone">
            {run.completed.outcomes.length} {noun}, {requests} model request
            {requests === 1 ? "" : "s"}, {formatDuration(run.completed.elapsedMs)}
          </span>
        )}
      </div>

      {stale && (
        <p className="rounded-xl border border-review/30 bg-review/10 p-3 text-sm text-review">
          <span className="font-semibold">Stale. </span>
          The list has changed since this run — the results below are for the
          previous list. Run again to match the list as it is now.
        </p>
      )}

      {controls && outcomes.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <Controls controls={controls} onMove={moveControl} />
        </section>
      )}

      <ItemsPane
        noun={spec.noun}
        fields={spec.fields}
        items={items}
        labelFor={spec.labelFor}
        rows={rows}
        band={controls?.reviewBand}
        disabled={running}
        stale={stale}
        running={running}
        onEdit={editField}
        onAdd={addItem}
        onRemove={removeItem}
      />
    </div>
  );
}
