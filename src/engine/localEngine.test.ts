import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalEngine } from "./localEngine";
import { FakeEngine } from "./fake";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Engine } from "./types";

/**
 * A minimal stand-in for the real Worker, driven entirely by hand: nothing here
 * auto-replies. Each test decides exactly when (and whether) the "worker side"
 * responds, which is what lets it simulate a request left hanging.
 */
class StubWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  posted: WorkerRequest[] = [];

  postMessage(message: WorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Test helper: deliver a reply as if it came from the worker thread. */
  respond(response: WorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>);
  }

  lastRequest(kind: WorkerRequest["kind"]): WorkerRequest {
    const found = [...this.posted].reverse().find((request) => request.kind === kind);
    if (!found) throw new Error(`No "${kind}" request was posted`);
    return found;
  }
}

/** Fails fast instead of riding out Vitest's default timeout, so a regression
 *  that reintroduces a hang shows up as a clear "timed out" failure. */
function withTimeout<T>(promise: Promise<T>, ms = 200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${ms}ms — promise never settled`)), ms);
    }),
  ]);
}

let worker: StubWorker;

beforeEach(() => {
  worker = new StubWorker();
  vi.stubGlobal(
    "Worker",
    function (this: unknown) {
      return worker;
    } as unknown as typeof Worker
  );
});

/** Drives `createLocalEngine` to a ready engine against the stub worker. */
async function loadedEngine(): Promise<Engine> {
  const enginePromise = createLocalEngine("kev-0.6b", () => {});
  const loadRequest = worker.lastRequest("load");
  worker.respond({
    id: loadRequest.id,
    kind: "ready",
    runtime: { engine: "local", model: "kev-0.6b", device: "cpu", dtype: "q4" },
  });
  return enginePromise;
}

describe("LocalEngine.dispose", () => {
  it("rejects an in-flight request instead of leaving it hanging", async () => {
    const engine = await loadedEngine();

    const decidePromise = engine.decide("state", {
      covered: { type: "noul", instructions: "Is this covered?" },
    });
    // Deliberately never respond to the decide request — it must be rejected by
    // dispose(), not resolved, and not left pending forever.

    const disposePromise = engine.dispose();
    const disposeRequest = worker.lastRequest("dispose");
    worker.respond({ id: disposeRequest.id, kind: "done" });

    await expect(withTimeout(decidePromise)).rejects.toThrow(/disposed/i);
    await expect(withTimeout(disposePromise)).resolves.toBeUndefined();
    expect(worker.terminated).toBe(true);
  });
});

describe("LocalEngine.create", () => {
  it("terminates the worker and preserves the original message when loading fails", async () => {
    const enginePromise = createLocalEngine("kev-0.6b", () => {});
    const loadRequest = worker.lastRequest("load");
    worker.respond({ id: loadRequest.id, kind: "error", message: "WebGPU device lost" });

    await expect(withTimeout(enginePromise)).rejects.toThrow("WebGPU device lost");
    expect(worker.terminated).toBe(true);
  });
});

describe("Engine", () => {
  it("is satisfied by FakeEngine without it implementing the optional primeTokenCount", () => {
    // Type-only check: this line fails to compile if FakeEngine stops satisfying
    // Engine now that primeTokenCount exists on the interface.
    const engine: Engine = new FakeEngine();
    expect(engine.primeTokenCount).toBeUndefined();
  });
});
