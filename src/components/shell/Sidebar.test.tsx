import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    expect(screen.getAllByText("soon").length).toBe(17);
  });

  it("shows no 4B marker for a cookbook that only requires kev-0.6b", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    expect(screen.queryByText("4B")).not.toBeInTheDocument();
  });
});
