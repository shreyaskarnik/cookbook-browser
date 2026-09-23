import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FakeEngine } from "../../engine/fake";
import ConsistencyNoulCard from "./ConsistencyNoulCard";

/** Three questions straddling the default band, so a widening slider must move rows. */
const pinned = new FakeEngine({
  covered: 0.95,
  exclusionApplies: 0.5,
  fraudIndicators: 0.02,
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
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");

    // A range input takes a change event; it cannot be cleared and typed into.
    fireEvent.change(screen.getByRole("slider", { name: /upper bound/i }), {
      target: { value: "0.99" },
    });

    expect(await screen.findByTestId("answer-covered")).toHaveAttribute(
      "data-verdict",
      "uncertain"
    );
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
});
