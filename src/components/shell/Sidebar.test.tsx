import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getDefinition } from "../../cookbooks";
import { CATALOG } from "../../cookbooks/catalog";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  it("lists all eighteen cookbooks", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    expect(screen.getAllByTestId("cookbook-entry")).toHaveLength(18);
  });

  it("groups them under the five documented categories", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    for (const heading of [
      "Self-consistency",
      "Batching",
      "How-to",
      "Extraction",
      "Classification",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("only lets the built cookbook be selected", async () => {
    const onSelect = vi.fn();
    render(<Sidebar selected="consistency-noul" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Re-ranking/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /Self-consistency: nouls/ })
    );
    expect(onSelect).toHaveBeenCalledWith("consistency-noul");
  });

  it("says plainly which ones are not built yet", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    expect(screen.getAllByText("soon")).toHaveLength(
      CATALOG.filter((entry) => entry.status === "planned").length
    );
  });

  it("marks a built cookbook that needs a larger model, and only those", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    for (const entry of CATALOG.filter((e) => e.status === "built")) {
      const row = screen.getByRole("button", { name: new RegExp(entry.title) });
      const needsLarger = getDefinition(entry.id).requires.model !== "kev-0.6b";
      if (needsLarger) expect(within(row).getByText("4B")).toBeInTheDocument();
      else expect(within(row).queryByText("4B")).not.toBeInTheDocument();
    }
  });
});
