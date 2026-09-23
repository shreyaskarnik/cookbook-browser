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
  private throwOnNextPost: Error | null = null;

  postMessage(message: WorkerRequest): void {
    if (this.throwOnNextPost) {
      const error = this.throwOnNextPost;
      this.throwOnNextPost = null;
      throw error;
    }
    this.posted.push(message);
  }

  /** Makes the next `postMessage` throw synchronously instead of recording a
   *  request, simulating e.g. a `DataCloneError` on an unclonable payload. */
  failNextPostMessage(error: Error): void {
    this.throwOnNextPost = error;
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

describe("LocalEngine after a worker crash", () => {
  it("fails fast on a later send() instead of posting into a dead worker and hanging", async () => {
    const engine = await loadedEngine();

    worker.onerror?.({ message: "GPU device lost" } as ErrorEvent);

    await expect(
      withTimeout(
        engine.decide("state", {
          covered: { type: "noul", instructions: "Is this covered?" },
        })
      )
    ).rejects.toThrow(/reload the page/i);
  });
});

describe("LocalEngine after dispose", () => {
  it("rejects a later decide() instead of posting into a terminated worker and hanging", async () => {
    const engine = await loadedEngine();

    const disposePromise = engine.dispose();
    const disposeRequest = worker.lastRequest("dispose");
    worker.respond({ id: disposeRequest.id, kind: "done" });
    await disposePromise;

    await expect(
      withTimeout(
        engine.decide("state", {
          covered: { type: "noul", instructions: "Is this covered?" },
        })
      )
    ).rejects.toThrow(/disposed/i);
  });
});

describe("LocalEngine.send() when postMessage throws", () => {
  it("rejects with the original error and does not disturb a later request", async () => {
    const engine = await loadedEngine();

    const cloneError = new Error("DataCloneError: value could not be cloned");
    worker.failNextPostMessage(cloneError);

    await expect(
      withTimeout(
        engine.decide("state", {
          covered: { type: "noul", instructions: "Is this covered?" },
        })
      )
    ).rejects.toThrow("DataCloneError: value could not be cloned");

    // Measured, not reasoned: this test was run against the code from before
    // the `pending.delete(id)` fix and passed unchanged, so it does NOT guard
    // that line at all. A throw inside a Promise executor auto-rejects with
    // the original error regardless of any try/catch, and request ids are
    // monotonic and never reused, so a leaked entry cannot collide with a
    // later request — both assertions below already held pre-fix. There is no
    // public way to inspect the pending map to test the deletion directly;
    // the only alternative is a test-only accessor on the class, judged not
    // worth adding to guard a harmless one-entry leak. Kept anyway because it
    // still pins two real properties: the original error reaches the caller,
    // and a later request is unaffected.
    const nextDecide = engine.decide("state", {
      covered: { type: "noul", instructions: "Is this covered?" },
    });
    const decideRequest = worker.lastRequest("decide");
    worker.respond({
      id: decideRequest.id,
      kind: "answers",
      answers: {
        covered: { type: "noul", answer: true, probability: 0.9, confidence: 0.9 },
      },
    });

    await expect(withTimeout(nextDecide)).resolves.toEqual({
      covered: { type: "noul", answer: true, probability: 0.9, confidence: 0.9 },
    });
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
