import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEngine } from "../../engine/fake";
import ConsistencyNoulCard from "./ConsistencyNoulCard";

/** Three questions straddling the default band, so a widening slider must move rows. */
const pinned = new FakeEngine({
  covered: 0.95,
  exclusionApplies: 0.5,
  fraudIndicators: 0.02,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsistencyNoulCard", () => {
  it("starts with a sample state in an editable box", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i }) as HTMLTextAreaElement;
    expect(state.value).toContain("Claim #AC-88213");
  });

  it("shows the fourteen questions before anything is run", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    expect(screen.getByText(/Fraud indicators/)).toBeInTheDocument();
    expect(screen.getAllByTestId("question-row")).toHaveLength(14);
  });

  it("renders a probability per question after running", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(within(row).getByText("95%")).toBeInTheDocument();
  });

  it("puts a probability outside the band on the automatic side", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");
  });

  it("escalates a probability inside the band", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-exclusionApplies");
    expect(row).toHaveAttribute("data-verdict", "uncertain");
  });

  it("moves a row to review when the band widens, without re-running the model", async () => {
    const decideSpy = vi.spyOn(pinned, "decide");
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");
    expect(decideSpy).toHaveBeenCalledTimes(1);

    // A range input takes a change event; it cannot be cleared and typed into.
    fireEvent.change(screen.getByRole("slider", { name: /upper bound/i }), {
      target: { value: "0.99" },
    });

    expect(await screen.findByTestId("answer-covered")).toHaveAttribute(
      "data-verdict",
      "uncertain"
    );
    // The row moved, but the model was never asked again.
    expect(decideSpy).toHaveBeenCalledTimes(1);
  });

  it("lets a visitor replace the state with their own text", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.clear(state);
    await userEvent.type(state, "my own claim text");
    expect(state).toHaveValue("my own claim text");
  });

  it("links to the cookbook it comes from", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
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
    render(<ConsistencyNoulCard engine={broken} />);
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
    render(<ConsistencyNoulCard engine={broken} />);
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
    render(<ConsistencyNoulCard engine={broken} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /straightforward rear-end/i }));

    expect(screen.queryByText(/ran out of memory/)).not.toBeInTheDocument();
  });

  it("dims the claim verdict the same way stale rows are dimmed, so the verdict does not out-assert the rows below it", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
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
    render(<ConsistencyNoulCard engine={engine} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(
      await screen.findByText(/Exclusion applies is uncertain\./)
    ).toBeInTheDocument();
    expect(screen.queryByText(/exclusionApplies/)).not.toBeInTheDocument();
  });

  it("marks the answers stale once the claim text changes, but keeps them visible and re-routable", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");

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
      "data-verdict",
      "uncertain"
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

    render(<ConsistencyNoulCard engine={flaky} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");

    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.type(state, " A late addition to the file.");
    expect(screen.getAllByText(/stale/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /run again/i }));

    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();
    // The failed attempt did not erase the previous, still-stale results.
    expect(screen.getByTestId("answer-covered")).toHaveAttribute("data-verdict", "yes");
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

      render(<ConsistencyNoulCard engine={primed} />);

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
    // real engine today. It stands in for what a future cookbook built from
    // choice or score questions would hand the card if it reused this
    // component without also updating the guard.
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

    render(<ConsistencyNoulCard engine={mismatched} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));

    // The message names both the offending key and its actual type, so
    // whoever hits this learns what went wrong without debugging.
    expect(
      await screen.findByText(/Expected a noul answer for "covered", but got type "choice"/)
    ).toBeInTheDocument();

    // The card is not blanked: the rest of it is still usable.
    expect(screen.getByRole("textbox", { name: /state/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).not.toBeDisabled();
  });

  it("cannot show a duration without answers, whatever the sequence", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
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
