import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FakeEngine } from "../../engine/fake";
import LoadGate, { MODEL_OPTIONS } from "./LoadGate";

vi.mock("../../engine", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createLocalEngine: vi.fn(async () => new (await import("../../engine/fake")).FakeEngine()),
    // Alias-aware, so a test can tell one model's response apart from another's —
    // needed to prove a late reply for the previously selected model is dropped.
    inspectModel: vi.fn(async (alias: string) => ({
      model: `onnx-community/${alias}-ONNX`,
      family: "kev",
      device: "webgpu",
      dtype: "q4f16",
      isCached: false,
      downloadSize: alias === "kev-4b" ? 2_300_000_000 : 340_000_000,
      files: ["model.onnx"],
    })),
    isWebGpuAvailable: vi.fn(() => true),
  };
});

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

  it("still shows a non-empty sentence when the rejection carries no message — e.g. a Worker constructor throw that never reaches the worker's own error handling", async () => {
    const engineModule = await import("../../engine");
    vi.mocked(engineModule.createLocalEngine).mockRejectedValueOnce(new Error(""));
    render(<LoadGate onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(
      await screen.findByText(/The model failed without a message\./)
    ).toBeInTheDocument();
  });

  it("clears a stale error when the selected model changes", async () => {
    const engineModule = await import("../../engine");
    vi.mocked(engineModule.createLocalEngine).mockRejectedValueOnce(
      new Error("WebGPU device lost")
    );
    render(<LoadGate onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(await screen.findByText(/WebGPU device lost/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /Kev 4B/ }));

    expect(screen.queryByText(/WebGPU device lost/)).not.toBeInTheDocument();
  });

  it("falls back to the approximate size when inspectModel rejects, without saying it is still checking", async () => {
    const engineModule = await import("../../engine");
    vi.mocked(engineModule.inspectModel).mockRejectedValueOnce(new Error("network down"));
    render(<LoadGate onReady={vi.fn()} />);
    expect(await screen.findByText(/About 340 MB/)).toBeInTheDocument();
    expect(screen.queryByText(/Checking the download size/)).not.toBeInTheDocument();
  });

  it("shows the newly selected model's size, not a late reply for the one left behind", async () => {
    const engineModule = await import("../../engine");
    const responses: Record<string, Awaited<ReturnType<typeof engineModule.inspectModel>>> = {
      "kev-0.6b": {
        model: "onnx-community/kev-0.6b-ONNX",
        family: "kev",
        device: "webgpu",
        dtype: "q4f16",
        isCached: false,
        downloadSize: 340_000_000,
        files: ["model.onnx"],
      },
      "kev-4b": {
        model: "onnx-community/kev-4b-ONNX",
        family: "kev",
        device: "webgpu",
        dtype: "q4f16",
        isCached: false,
        downloadSize: 2_300_000_000,
        files: ["model.onnx"],
      },
    };
    // Each alias gets its own resolver, held open until the test releases it —
    // this is what lets the test control the arrival order deterministically,
    // rather than racing real timers.
    const resolvers: Record<string, () => void> = {};
    vi.mocked(engineModule.inspectModel).mockImplementation(
      (alias: string) =>
        new Promise((resolve) => {
          resolvers[alias] = () => resolve(responses[alias]);
        })
    );

    render(<LoadGate onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: /Kev 4B/ }));

    // Resolve the newly selected model's lookup first...
    await act(async () => resolvers["kev-4b"]());
    expect(await screen.findByText(/2.3 GB/)).toBeInTheDocument();

    // ...then let the stale kev-0.6b lookup arrive late. The effect's cleanup
    // guard was set before this resolves, so it must not overwrite the display.
    await act(async () => resolvers["kev-0.6b"]());
    expect(screen.getByText(/2.3 GB/)).toBeInTheDocument();
    expect(screen.queryByText(/340 MB/)).not.toBeInTheDocument();
  });
});
