import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ModelRequirement, { meetsRequirement } from "./ModelRequirement";

const runtime = (model: string) => ({
  engine: "local" as const, model, device: "webgpu", dtype: "q4f16",
});
const needs4b = {
  model: "kev-4b" as const,
  why: "At 0.6B all eight lines score identically, so there is nothing to compare.",
};

describe("meetsRequirement", () => {
  it("accepts the exact model", () => {
    expect(meetsRequirement("onnx-community/kev-4b-ONNX", "kev-4b")).toBe(true);
  });
  it("accepts a larger model than required", () => {
    expect(meetsRequirement("onnx-community/kev-4b-ONNX", "kev-0.6b")).toBe(true);
  });
  it("rejects a smaller model than required", () => {
    expect(meetsRequirement("onnx-community/kev-0.6b-ONNX", "kev-4b")).toBe(false);
  });
});

describe("ModelRequirement", () => {
  it("renders nothing when the loaded model already meets the requirement", () => {
    const { container } = render(
      <ModelRequirement requires={needs4b} runtime={runtime("onnx-community/kev-4b-ONNX")} onUpgrade={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("quotes the card's own reason rather than a generic warning", () => {
    render(
      <ModelRequirement requires={needs4b} runtime={runtime("onnx-community/kev-0.6b-ONNX")} onUpgrade={vi.fn()} />
    );
    expect(screen.getByText(/all eight lines score identically/)).toBeInTheDocument();
  });

  it("offers an upgrade without leaving the card", async () => {
    const onUpgrade = vi.fn();
    render(
      <ModelRequirement requires={needs4b} runtime={runtime("onnx-community/kev-0.6b-ONNX")} onUpgrade={onUpgrade} />
    );
    await userEvent.click(screen.getByRole("button", { name: /load kev 4b/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});
