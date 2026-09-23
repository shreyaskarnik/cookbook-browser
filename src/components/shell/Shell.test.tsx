import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { builtCookbooks, getDefinition, getEntry } from "../../cookbooks";
import { FakeEngine } from "../../engine/fake";
import Shell from "./Shell";

const engine = new FakeEngine();

/** The heading the card renders for the cookbook on screen. Both the card's
 *  title and the sidebar's category names are `h2`, so the match is on the
 *  exact accessible name rather than the level alone. */
const cardHeading = (title: string) =>
  screen.getByRole("heading", { name: title, level: 2 });

describe("Shell", () => {
  it("opens on the first built cookbook", () => {
    render(<Shell engine={engine} />);
    // Shell opens on `builtCookbooks()[0]`, so derive the title the same way.
    // A literal here passes only until the catalog's first built entry changes.
    expect(cardHeading(getEntry(builtCookbooks()[0].id).title)).toBeInTheDocument();
  });

  it.each(builtCookbooks().map((entry) => entry.id))(
    "renders %s's own card when it is selected, not whichever card was there before",
    async (id) => {
      const entry = getEntry(id);
      render(<Shell engine={engine} />);
      await userEvent.click(screen.getByRole("button", { name: new RegExp(entry.title) }));

      expect(cardHeading(entry.title)).toBeInTheDocument();
      // Nothing from another cookbook is left behind: every other built card's
      // title is gone from the page body.
      for (const other of builtCookbooks()) {
        if (other.id === id) continue;
        expect(
          screen.queryByRole("heading", { name: other.title, level: 2 })
        ).not.toBeInTheDocument();
      }
    }
  );

  it("shows a label only the selected cookbook has", async () => {
    render(<Shell engine={engine} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Guardrails for LLMs/ })
    );
    expect(screen.getByText("Self-harm signal")).toBeInTheDocument();
    expect(screen.queryByText("Fraud indicators")).not.toBeInTheDocument();
  });

  it("starts a newly selected cookbook from its own first sample", async () => {
    render(<Shell engine={engine} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Self-consistency: choices/ })
    );
    const state = screen.getByRole("textbox", {
      name: /state/i,
    }) as HTMLTextAreaElement;
    expect(state.value).toBe(getDefinition("consistency-choice").samples[0].text);
  });
});
