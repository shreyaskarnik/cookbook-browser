import { useEffect, useMemo, useState } from "react";
import { docsUrl, getDefinition, getEntry } from "../../cookbooks";
import type { Engine, NoulAnswer } from "../../engine";
import { formatDuration, formatPercent } from "../../lib/format";
import {
  DEFAULT_BAND,
  bandSummary,
  claimVerdict,
  clampBand,
  routeAll,
} from "../../lib/routing";
import AnswersPane from "../panes/AnswersPane";
import QuestionsPane from "../panes/QuestionsPane";
import SamplesRail from "../panes/SamplesRail";
import StatePane from "../panes/StatePane";

const ID = "consistency-noul";

export default function ConsistencyNoulCard({ engine }: { engine: Engine }) {
  const definition = getDefinition(ID);
  const entry = getEntry(ID);

  const [state, setState] = useState(definition.samples[0].text);
  const [tokens, setTokens] = useState(() => engine.countTokens(definition.samples[0].text));
  const [tokensExact, setTokensExact] = useState(false);
  const [answers, setAnswers] = useState<Record<string, NoulAnswer> | null>(null);
  const [band, setBand] = useState(DEFAULT_BAND);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-routing is pure, so dragging the slider re-renders without touching the model.
  const routed = useMemo(
    () => (answers ? routeAll(answers, band) : []),
    [answers, band]
  );
  const summary = bandSummary(routed);
  const verdict = routed.length > 0 ? claimVerdict(routed) : null;

  // The tokenizer lives in the worker, so an exact count is only available
  // asynchronously. Show the synchronous estimate immediately, then replace it
  // once the real count arrives. Debounced so typing does not queue a request
  // per keystroke, and guarded so a slow reply for older text cannot overwrite
  // the count for newer text.
  useEffect(() => {
    setTokens(engine.countTokens(state));
    setTokensExact(false);
    if (!engine.primeTokenCount) return;
    let current = true;
    const timer = setTimeout(() => {
      engine
        .primeTokenCount?.(state)
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

  const run = async () => {
    setRunning(true);
    setError(null);
    const started = performance.now();
    try {
      const result = await engine.decide(state, definition.questions);
      setElapsed(performance.now() - started);
      setAnswers(result as Record<string, NoulAnswer>);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{entry.title}</h1>
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
            onClick={run}
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
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="font-semibold">Uncertainty band</h2>
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
              <p className="mt-3 text-sm">
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
                    <span className="text-stone">{verdict.reason}</span>
                  </>
                )}
              </p>
            </section>

            <AnswersPane
              routed={routed}
              labels={definition.labels}
              band={band}
            />
          </>
        )}
      </div>

      <SamplesRail
        samples={definition.samples}
        onPick={(sample) => {
          setState(sample.text);
          setAnswers(null);
          setElapsed(null);
        }}
        disabled={running}
      />
    </div>
  );
}
