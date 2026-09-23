import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FakeEngine } from "../../engine/fake";
import LoadGate, { MODEL_OPTIONS } from "./LoadGate";

vi.mock("../../engine", async () => ({
  createLocalEngine: vi.fn(async () => new (await import("../../engine/fake")).FakeEngine()),
  inspectModel: vi.fn(async () => ({
    model: "onnx-community/kev-0.6b-ONNX",
    family: "kev",
    device: "webgpu",
    dtype: "q4f16",
    isCached: false,
    downloadSize: 340_000_000,
    files: ["model.onnx"],
  })),
  isWebGpuAvailable: vi.fn(() => true),
}));

describe("LoadGate", () => {
  it("offers the three models with 0.6b first", () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(MODEL_OPTIONS[0].alias).toBe("kev-0.6b");
    expect(screen.getByRole("radio", { name: /Kev 0.6B/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Kev 4B/ })).toBeInTheDocument();
  });

  it("states the download size before anything is fetched", async () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(await screen.findByText(/340 MB/)).toBeInTheDocument();
  });

  it("says the text never leaves the tab", () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(screen.getByText(/never leaves this tab/i)).toBeInTheDocument();
  });

  it("hands the engine to its parent once loading finishes", async () => {
    const onReady = vi.fn();
    render(<LoadGate onReady={onReady} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onReady.mock.calls[0][0]).toBeInstanceOf(FakeEngine);
  });

  it("shows the failure instead of a blank screen when loading throws", async () => {
    const engineModule = await import("../../engine");
    vi.mocked(engineModule.createLocalEngine).mockRejectedValueOnce(
      new Error("WebGPU device lost")
    );
    render(<LoadGate onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(await screen.findByText(/WebGPU device lost/)).toBeInTheDocument();
  });
});
