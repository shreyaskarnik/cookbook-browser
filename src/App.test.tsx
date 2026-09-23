import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./engine", async () => ({
  createLocalEngine: vi.fn(
    async () => new (await import("./engine/fake")).FakeEngine()
  ),
  inspectModel: vi.fn(async () => ({
    model: "onnx-community/kev-0.6b-ONNX",
    family: "kev",
    device: "webgpu",
    dtype: "q4f16",
    isCached: true,
    downloadSize: 340_000_000,
    files: [],
  })),
  isWebGpuAvailable: vi.fn(() => true),
}));

import App from "./App";

describe("App", () => {
  it("shows the load gate before a model is chosen", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /load the model/i })
    ).toBeInTheDocument();
  });

  it("shows the card once the engine is ready", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(
      await screen.findByRole("heading", { name: "Self-consistency: nouls" })
    ).toBeInTheDocument();
  });
});
