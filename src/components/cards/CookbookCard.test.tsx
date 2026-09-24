import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefinition } from "../../cookbooks";
import type { Answer } from "../../engine";
import { FakeEngine } from "../../engine/fake";
import CookbookCard from "./CookbookCard";

/** Every test below renders one cookbook by id; this is the one the wave
 *  started from, and the only card that declares a headline. */
const NOUL = "consistency-noul";

/** Three questions straddling the default band, so a widening slider must move rows. */
const pinned = new FakeEngine({
  covered: 0.95,
  exclusionApplies: 0.5,
  fraudIndicators: 0.02,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CookbookCard — Self-consistency: nouls", () => {
  it("starts with a sample state in an editable box", () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i }) as HTMLTextAreaElement;
    expect(state.value).toContain("Claim #AC-88213");
  });

  it("shows the fourteen questions before anything is run", () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    expect(screen.getByText(/Fraud indicators/)).toBeInTheDocument();
    expect(screen.getAllByTestId("question-row")).toHaveLength(14);
  });

  it("renders a probability per question after running", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(within(row).getByText("Yes (95%)")).toBeInTheDocument();
  });

  it("routes through the cookbook's own rule, not a rule the card owns", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-disposition", "auto");
  });

  it("shows no model banner when the loaded model meets the requirement", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    expect(screen.queryByRole("button", { name: /load kev/i })).not.toBeInTheDocument();
  });

  it("puts a probability outside the band on the automatic side", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-disposition", "auto");
  });

  it("escalates a probability inside the band", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-exclusionApplies");
    expect(row).toHaveAttribute("data-disposition", "review");
  });

  it("moves a row to review when the band widens, without re-running the model", async () => {
    const decideSpy = vi.spyOn(pinned, "decide");
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-disposition", "auto");
    expect(decideSpy).toHaveBeenCalledTimes(1);

    // A range input takes a change event; it cannot be cleared and typed into.
    fireEvent.change(screen.getByRole("slider", { name: /upper bound/i }), {
      target: { value: "0.99" },
    });

    expect(await screen.findByTestId("answer-covered")).toHaveAttribute(
      "data-disposition",
      "review"
    );
    // The row moved, but the model was never asked again.
    expect(decideSpy).toHaveBeenCalledTimes(1);
  });

  it("lets a visitor replace the state with their own text", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.clear(state);
    await userEvent.type(state, "my own claim text");
    expect(state).toHaveValue("my own claim text");
  });

  it("links to the cookbook it comes from", () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    expect(screen.getByRole("link", { name: /cookbook/i })).toHaveAttribute(
      "href",
      "https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook"
    );
  });

  it("reports a failed decision rather than showing nothing", async () => {
    const broken = {
      runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
      decide: async () => {
        throw new Error("The model ran out of memory.");
      },
      countTokens: () => 10,
      // no primeTokenCount: the card must work with an engine that lacks it
      dispose: async () => {},
    };
    render(<CookbookCard id={NOUL} engine={broken} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();
  });

  it("still shows a non-empty sentence when a decision rejects with no message", async () => {
    const broken = {
      runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
      decide: async () => {
        throw new Error("");
      },
      countTokens: () => 10,
      dispose: async () => {},
    };
    render(<CookbookCard id={NOUL} engine={broken} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(
      await screen.findByText(/The model failed without a message\./)
    ).toBeInTheDocument();
  });

  it("clears a failure banner from a previous sample when a new sample is picked", async () => {
    const broken = {
      runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
      decide: async () => {
        throw new Error("The model ran out of memory.");
      },
      countTokens: () => 10,
      dispose: async () => {},
    };
    render(<CookbookCard id={NOUL} engine={broken} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /straightforward rear-end/i }));

    expect(screen.queryByText(/ran out of memory/)).not.toBeInTheDocument();
  });

  it("dims the claim verdict the same way stale rows are dimmed, so the verdict does not out-assert the rows below it", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const verdict = await screen.findByTestId("claim-verdict");
    expect(verdict).toHaveAttribute("data-stale", "false");
    expect(verdict.className).not.toMatch(/opacity-50/);

    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.type(state, " Addendum: nothing about this changes the facts.");

    expect(verdict).toHaveAttribute("data-stale", "true");
    expect(verdict.className).toMatch(/opacity-50/);
  });

  it("shows the human label, not the raw key, when a single critical question is uncertain", async () => {
    const engine = new FakeEngine({
      covered: 0.95,
      exclusionApplies: 0.5,
      fraudIndicators: 0.02,
      manualReview: 0.02,
    });
    render(<CookbookCard id={NOUL} engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(
      await screen.findByText(/Exclusion applies is uncertain\./)
    ).toBeInTheDocument();
    expect(screen.queryByText(/exclusionApplies/)).not.toBeInTheDocument();
  });

  it("marks the answers stale once the claim text changes, but keeps them visible and re-routable", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-disposition", "auto");

    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.type(state, " Addendum: nothing about this changes the facts.");

    // The previous run's answers are still on screen, but marked as no longer
    // describing what is in the box.
    expect(await screen.findByTestId("answer-covered")).toBeInTheDocument();
    expect(screen.getAllByText(/stale/i).length).toBeGreaterThan(0);

    // Re-routing stale answers by dragging the band is still reasonable, and
    // must still work without asking the model again.
    fireEvent.change(screen.getByRole("slider", { name: /upper bound/i }), {
      target: { value: "0.99" },
    });
    expect(await screen.findByTestId("answer-covered")).toHaveAttribute(
      "data-disposition",
      "review"
    );
  });

  it("keeps the previous run's answers, marked stale, through a failed re-run rather than implying they are current", async () => {
    let calls = 0;
    const flaky = {
      runtime: pinned.runtime,
      decide: async (
        stateArg: Parameters<typeof pinned.decide>[0],
        questions: Parameters<typeof pinned.decide>[1]
      ) => {
        calls += 1;
        if (calls === 1) return pinned.decide(stateArg, questions);
        throw new Error("The model ran out of memory.");
      },
      countTokens: (stateArg: string) => pinned.countTokens(stateArg),
      dispose: async () => {},
    };

    render(<CookbookCard id={NOUL} engine={flaky} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-disposition", "auto");

    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.type(state, " A late addition to the file.");
    expect(screen.getAllByText(/stale/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /run again/i }));

    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();
    // The failed attempt did not erase the previous, still-stale results.
    expect(screen.getByTestId("answer-covered")).toHaveAttribute("data-disposition", "auto");
    expect(screen.getAllByText(/stale/i).length).toBeGreaterThan(0);
  });

  it("shows the exact token count once priming resolves, without a stale reply for older text overwriting a newer count", async () => {
    vi.useFakeTimers();
    try {
      // Each call to primeTokenCount gets its own held-open resolver, in call
      // order — this is what lets the test control arrival order deterministically,
      // the same approach Task 6's LoadGate.test.tsx uses for its out-of-order guard.
      const pending: Array<{ text: string; resolve: (count: number) => void }> = [];
      const primed = {
        runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
        decide: async () => ({}),
        countTokens: (text: string) => text.split(/\s+/).filter(Boolean).length,
        primeTokenCount: (text: string) =>
          new Promise<number>((resolve) => {
            pending.push({ text, resolve });
          }),
        dispose: async () => {},
      };

      render(<CookbookCard id={NOUL} engine={primed} />);

      // The synchronous estimate shows immediately, marked as approximate.
      expect(screen.getByText(/^≈\d+ tokens$/)).toBeInTheDocument();

      // Let the debounce for the initial text fire, but leave its reply pending —
      // this stands in for a slow reply that arrives after the text has moved on.
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(pending).toHaveLength(1);

      // Edit the claim before that first count comes back.
      const state = screen.getByRole("textbox", { name: /state/i });
      fireEvent.change(state, { target: { value: "a short claim" } });
      expect(screen.getByText("≈3 tokens")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(pending).toHaveLength(2);

      // The newer text's exact count arrives and replaces the estimate. `act`
      // has already flushed the resulting render, so a plain (synchronous) query
      // is used rather than `findBy*` — its polling relies on real timers, which
      // never elapse while fake timers are installed.
      await act(async () => {
        pending[1].resolve(42);
      });
      expect(screen.getByText("42 tokens")).toBeInTheDocument();
      expect(screen.queryByText(/≈/)).not.toBeInTheDocument();

      // The stale reply for the text that is no longer on screen arrives late.
      // It must not overwrite the current, newer count.
      await act(async () => {
        pending[0].resolve(999);
      });
      expect(screen.getByText("42 tokens")).toBeInTheDocument();
      expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the offending question and its type rather than rendering NaN bars, when an engine answers a noul question with something else", async () => {
    // Every question in this cookbook is a noul, so this cannot happen with a
    // real engine today. The card no longer checks answer types itself — the
    // cookbook's rule does, because only the rule knows which types it needs —
    // so this pins that the rule's complaint reaches the visitor rather than
    // throwing out of a render and blanking the card.
    const mismatched = {
      runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
      decide: async () => ({
        covered: {
          type: "choice" as const,
          choice: "yes",
          confidence: 0.9,
          probabilities: { yes: 0.9, no: 0.1 },
        },
      }),
      countTokens: () => 10,
      dispose: async () => {},
    };

    render(<CookbookCard id={NOUL} engine={mismatched} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    // The message names both the offending key and its actual type, so
    // whoever hits this learns what went wrong without debugging.
    expect(
      await screen.findByText(/bandRule expects noul answers; "covered" is a choice/)
    ).toBeInTheDocument();

    // The card is not blanked: the rest of it is still usable.
    expect(screen.getByRole("textbox", { name: /state/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).not.toBeDisabled();

    // Nothing summarises a routing that did not happen. The headline reads its
    // counts off the routed rows, which are empty here, so rendering it would
    // state "0 of 0 questions go to review" directly beneath a banner saying
    // the answers could not be routed — the card asserting a number it does
    // not have. Same rule the stale case already enforces, in the case where
    // being wrong matters more.
    expect(screen.queryByText(/go to review/)).not.toBeInTheDocument();
    expect(screen.queryByText(/decided automatically/)).not.toBeInTheDocument();
  });

  it("cannot show a duration without answers, whatever the sequence", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    // "questions in one request" (the duration span) is more specific than
    // "in one request" alone — QuestionsPane's own header also reads "all in
    // one request", so the looser pattern matches both and is ambiguous.
    expect(await screen.findByText(/questions in one request/)).toBeInTheDocument();

    // Pick a different sample: answers and their timing must disappear together.
    await userEvent.click(screen.getByRole("button", { name: /Thin file, late report/ }));
    expect(screen.queryByText(/questions in one request/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("answer-covered")).not.toBeInTheDocument();
  });
});

describe("CookbookCard — the other cookbooks", () => {
  it("renders the guardrails score question's row rather than refusing every answer that is not a noul", async () => {
    render(<CookbookCard id="llm-guardrails" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    // The severity question is a `score`, and it routes alongside the four
    // noul hazards in the same pass.
    const severity = await screen.findByTestId("answer-severity");
    expect(within(severity).getByText("Severity")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^answer-/)).toHaveLength(
      Object.keys(getDefinition("llm-guardrails").questions).length
    );
    expect(screen.queryByText(/could not be routed/)).not.toBeInTheDocument();
  });

  it("routes the choices cookbook through its own confidence floor", async () => {
    render(<CookbookCard id="consistency-choice" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    const row = await screen.findByTestId("answer-action");
    expect(within(row).getByText("Enforcement action")).toBeInTheDocument();
    expect(screen.queryByText(/could not be routed/)).not.toBeInTheDocument();
  });

  it("gives the headline verdict to the cookbook that declares one, and to no other", async () => {
    const { unmount } = render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    expect(await screen.findByTestId("claim-verdict")).toBeInTheDocument();
    unmount();

    for (const id of ["consistency-choice", "llm-guardrails"]) {
      const view = render(<CookbookCard id={id} engine={new FakeEngine()} />);
      await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
      await screen.findAllByTestId(/^answer-/);
      expect(screen.queryByTestId("claim-verdict")).not.toBeInTheDocument();
      // Nor any of the prose that headline is made of.
      expect(screen.queryByText(/can be actioned/)).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("gives each cookbook the controls its own rule declares, under its own heading", async () => {
    const { unmount } = render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    expect(await screen.findByRole("slider", { name: /upper bound/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uncertainty band" })).toBeInTheDocument();
    unmount();

    render(<CookbookCard id="llm-guardrails" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findByTestId("answer-severity");
    // Guardrails has three thresholds of its own and no band to drag.
    expect(screen.getByRole("slider", { name: /review threshold/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /action threshold/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /severity override/i })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /upper bound/i })).not.toBeInTheDocument();
  });

  it("starts card one's bounds at the band its rule declares, not at numbers the card holds", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    const low = (await screen.findByRole("slider", { name: /lower bound/i })) as HTMLInputElement;
    const high = screen.getByRole("slider", { name: /upper bound/i }) as HTMLInputElement;
    // Read the expected values off the rule itself. The contract in the title
    // is "the card reads the rule's defaults" — asserting the literals would
    // pin 0.3/0.7 in a fourth place and pass even if the card stopped reading
    // the rule and happened to hold the same two numbers.
    const declared = getDefinition(NOUL).routing!.controls!.parameters;
    expect(low.value).toBe(String(declared[0].value));
    expect(high.value).toBe(String(declared[1].value));
  });

  it("prints a severity override as a score rather than as a percentage", async () => {
    render(<CookbookCard id="llm-guardrails" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findByTestId("answer-severity");
    const override = getDefinition("llm-guardrails").routing!.controls!.parameters.find(
      (parameter) => parameter.format !== "percent"
    )!;
    expect(screen.getByText(override.value.toFixed(2))).toBeInTheDocument();
    expect(screen.queryByText("200%")).not.toBeInTheDocument();
  });

  it("re-routes guardrails when a threshold moves, without asking the model again", async () => {
    const engine = new FakeEngine({ jailbreak: 0.5 });
    const decideSpy = vi.spyOn(engine, "decide");
    render(<CookbookCard id="llm-guardrails" engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(await screen.findByTestId("answer-jailbreak")).toHaveAttribute(
      "data-disposition",
      "review"
    );
    expect(decideSpy).toHaveBeenCalledTimes(1);

    // Lift the review threshold above the hazard and it stops needing a person.
    fireEvent.change(screen.getByRole("slider", { name: /review threshold/i }), {
      target: { value: "0.99" },
    });

    expect(await screen.findByTestId("answer-jailbreak")).toHaveAttribute(
      "data-disposition",
      "auto"
    );
    expect(decideSpy).toHaveBeenCalledTimes(1);
  });

  it("re-routes the choices cookbook when its floor moves, without asking the model again", async () => {
    const engine = new FakeEngine();
    const decideSpy = vi.spyOn(engine, "decide");
    render(<CookbookCard id="consistency-choice" engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findAllByTestId(/^answer-/);

    const floor = screen.getByRole("slider", { name: /floor/i });

    fireEvent.change(floor, { target: { value: "1" } });
    for (const row of screen.getAllByTestId(/^answer-/)) {
      expect(row).toHaveAttribute("data-disposition", "review");
    }

    fireEvent.change(floor, { target: { value: "0" } });
    for (const row of screen.getAllByTestId(/^answer-/)) {
      expect(row).toHaveAttribute("data-disposition", "auto");
    }

    expect(decideSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the band's two bounds from crossing, showing where the rule put them", async () => {
    render(<CookbookCard id={NOUL} engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    const low = (await screen.findByRole("slider", { name: /lower bound/i })) as HTMLInputElement;
    const high = screen.getByRole("slider", { name: /upper bound/i }) as HTMLInputElement;

    // Drag the lower bound past the upper one: the rule swaps them rather than
    // producing an empty band, and the controls follow.
    fireEvent.change(low, { target: { value: "0.9" } });
    expect(low.value).toBe("0.7");
    expect(high.value).toBe("0.9");
  });

  it("counts the questions it actually asks, rather than one cookbook's fourteen", async () => {
    render(<CookbookCard id="llm-guardrails" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    const asked = Object.keys(getDefinition("llm-guardrails").questions).length;
    expect(
      await screen.findByText(new RegExp(`^${asked} questions in one request`))
    ).toBeInTheDocument();
  });

  it("says what changed without calling every cookbook's state a claim", async () => {
    render(<CookbookCard id="llm-guardrails" engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findByTestId("answer-severity");

    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.type(state, " One more line.");

    expect(screen.getByText(/The state has changed since this run/)).toBeInTheDocument();
    expect(screen.queryByText(/claim text has changed/)).not.toBeInTheDocument();
  });
});

/** The one per-item cookbook: the same question asked against each of a list of
 *  citations, each routed on its own. */
const CITATIONS = "citation-check";

/** The spec under test, read off the definition rather than re-stated here, so
 *  these tests describe the cookbook that ships rather than a copy of it. */
const spec = getDefinition(CITATIONS).items!;

/** The citations this cookbook's own pre-check decides without a model call. */
const preChecked = spec.items.filter((item) => spec.preCheck?.(item, spec.labelFor));

/** One `relation` answer, shaped as the cookbook's rule expects. */
const relationAnswer = (choice: string, confidence: number): Record<string, Answer> => ({
  relation: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } },
});

/** An engine whose every `decide` hangs until the test resolves it, in call
 *  order. A run over a list lands one item at a time, and holding each request
 *  open is what makes "one at a time" observable rather than a race. */
function heldEngine() {
  const pending: Array<(answers: Record<string, Answer>) => void> = [];
  const engine = {
    runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
    decide: () =>
      new Promise<Record<string, Answer>>((resolve) => {
        pending.push(resolve);
      }),
    countTokens: () => 10,
    dispose: async () => {},
  };
  return { engine, pending };
}

describe("CookbookCard — Double-checking citations", () => {
  it("asks once per item and shows one row per item", async () => {
    const engine = new FakeEngine();
    const decideSpy = vi.spyOn(engine, "decide");
    render(<CookbookCard id={CITATIONS} engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    for (const item of spec.items) {
      expect(await screen.findByTestId(`answer-${item.id}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^answer-/)).toHaveLength(spec.items.length);

    // One request per item, minus the ones the cookbook's pre-check answered
    // without one. Each request carries that item's state and no other's.
    expect(decideSpy).toHaveBeenCalledTimes(spec.items.length - preChecked.length);
    const asked = decideSpy.mock.calls.map(([state]) => state);
    expect(new Set(asked).size).toBe(asked.length);
    for (const item of spec.items) {
      if (preChecked.includes(item)) continue;
      expect(asked).toContain(spec.toState(item));
    }
  });

  it("shows how many items have landed while a run is in flight", async () => {
    const { engine, pending } = heldEngine();
    render(<CookbookCard id={CITATIONS} engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    const total = spec.items.length;
    // The first request is open and nothing has landed yet.
    expect(screen.getByText(new RegExp(`0 of ${total} citations`))).toBeInTheDocument();
    expect(pending).toHaveLength(1);

    await act(async () => {
      pending.shift()!(relationAnswer("supports", 0.9));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // One item has landed, and it is on screen while the rest are still out.
    expect(screen.getByText(new RegExp(`1 of ${total} citations`))).toBeInTheDocument();
    expect(screen.getAllByTestId(/^answer-/)).toHaveLength(1);

    // Let the rest of the list through, so the run finishes rather than
    // leaving requests open past the end of the test.
    await act(async () => {
      while (pending.length > 0) {
        pending.shift()!(relationAnswer("supports", 0.9));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    expect(await screen.findByText(new RegExp(`^${total} citations,`))).toBeInTheDocument();
  });

  it("keeps the other items when one item's request fails", async () => {
    const fake = new FakeEngine();
    // The first citation the cookbook would actually send — not a pre-checked
    // one, which never reaches the engine to fail.
    const doomed = spec.items.find((item) => !preChecked.includes(item))!;
    const flaky = {
      runtime: fake.runtime,
      decide: async (state: string, questions: Parameters<typeof fake.decide>[1]) => {
        if (state === spec.toState(doomed)) throw new Error("The model ran out of memory.");
        return fake.decide(state, questions);
      },
      countTokens: (state: string) => fake.countTokens(state),
      dispose: async () => {},
    };

    render(<CookbookCard id={CITATIONS} engine={flaky} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(await screen.findByTestId(`item-error-${doomed.id}`)).toHaveTextContent(
      /ran out of memory/
    );
    // Every other citation still has its row: one failure is one row's problem.
    for (const item of spec.items) {
      if (item.id === doomed.id) continue;
      expect(await screen.findByTestId(`answer-${item.id}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId(`answer-${doomed.id}`)).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^answer-/)).toHaveLength(spec.items.length - 1);
  });

  it("does not ask the model for an item its pre-check already decided", async () => {
    expect(preChecked).toHaveLength(1);
    const skipped = preChecked[0];

    const engine = new FakeEngine();
    const decideSpy = vi.spyOn(engine, "decide");
    render(<CookbookCard id={CITATIONS} engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    const row = await screen.findByTestId(`answer-${skipped.id}`);

    // Not "the row looks different": the engine was never handed this
    // citation's state at all, under any phrasing of it.
    const asked = decideSpy.mock.calls.map(([state]) => state);
    expect(asked).toHaveLength(spec.items.length - 1);
    expect(asked).not.toContain(spec.toState(skipped));
    for (const state of asked) {
      expect(state).not.toContain(skipped.fields.claim);
    }

    // It was decided all the same, by the cookbook's own check.
    expect(row).toHaveAttribute("data-disposition", "auto");
    expect(row).toHaveTextContent(/fabricated/);
  });

  it("re-routes every item when a control moves, without asking again", async () => {
    const engine = new FakeEngine();
    const decideSpy = vi.spyOn(engine, "decide");
    render(<CookbookCard id={CITATIONS} engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findByTestId(`answer-${spec.items[spec.items.length - 1].id}`);

    const requests = decideSpy.mock.calls.length;
    expect(requests).toBe(spec.items.length - preChecked.length);

    const floor = screen.getByRole("slider", { name: /floor/i });
    const skipped = new Set(preChecked.map((item) => item.id));
    const idOf = (row: HTMLElement) => row.getAttribute("data-testid")!.replace("answer-", "");

    // A floor at the top puts every model-answered citation below it. The
    // pre-checked one is not the rule's to move: it never had answers.
    fireEvent.change(floor, { target: { value: "1" } });
    const raised = screen.getAllByTestId(/^answer-/);
    expect(raised).toHaveLength(spec.items.length);
    for (const row of raised) {
      expect(row).toHaveAttribute(
        "data-disposition",
        skipped.has(idOf(row)) ? "auto" : "review"
      );
    }

    // And a floor at the bottom brings all of them back.
    fireEvent.change(floor, { target: { value: "0" } });
    for (const row of screen.getAllByTestId(/^answer-/)) {
      expect(row).toHaveAttribute("data-disposition", "auto");
    }

    // Every one of those rows moved without a single new request.
    expect(decideSpy).toHaveBeenCalledTimes(requests);
  });

  it("marks the results stale when any item is edited", async () => {
    render(<CookbookCard id={CITATIONS} engine={new FakeEngine()} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    const first = spec.items[0];
    await screen.findByTestId(`answer-${first.id}`);
    expect(screen.queryByTestId("items-stale-badge")).not.toBeInTheDocument();

    const claim = within(screen.getByTestId(`item-${first.id}`)).getByLabelText("Claim");
    await userEvent.type(claim, " And one more thing.");

    expect(screen.getByTestId("items-stale-badge")).toBeInTheDocument();
    expect(screen.getByText(/The list has changed since this run/)).toBeInTheDocument();
    // The rows are still there, and still re-routable.
    expect(screen.getByTestId(`answer-${first.id}`)).toBeInTheDocument();
  });

  it("lets a visitor add an item to the list and remove one", async () => {
    render(<CookbookCard id={CITATIONS} engine={new FakeEngine()} />);
    const listed = () => screen.getAllByTestId(/^item-/);
    expect(listed()).toHaveLength(spec.items.length);

    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(listed()).toHaveLength(spec.items.length + 1);

    const first = spec.items[0];
    await userEvent.click(
      screen.getByRole("button", { name: `Remove ${spec.labelFor(first)}` })
    );
    expect(screen.queryByTestId(`item-${first.id}`)).not.toBeInTheDocument();
    expect(listed()).toHaveLength(spec.items.length);
  });

  it("offers no whole-state box or sample rail, because this cookbook has neither", () => {
    render(<CookbookCard id={CITATIONS} engine={new FakeEngine()} />);
    expect(screen.queryByRole("textbox", { name: /^state$/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Try it on")).not.toBeInTheDocument();
    // It still says what it asks, and links to the cookbook it comes from.
    expect(screen.getAllByTestId("question-row")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /cookbook/i })).toHaveAttribute(
      "href",
      "https://docs.typesafe.ai/cookbooks/citation_check"
    );
  });
});
