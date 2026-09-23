import { OpenJev } from "open-jev";
import type { LoadProgress, OpenJevInfo } from "open-jev";
import { nextRequestId } from "./protocol";
import type { WorkerRequest, WorkerRequestBody, WorkerResponse } from "./protocol";
import type { Answer, Engine, EngineRuntime, Question } from "./types";

type Pending = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: LoadProgress) => void;
};

/** Talks to worker.ts. One request is in flight per id; `open-jev` serialises
 *  decisions internally, so several decide() calls may be outstanding. */
class LocalEngine implements Engine {
  private tokenCache = new Map<string, number>();
  /** Filled in by `create` once the worker reports what it actually loaded:
   *  the device and dtype are resolved from "auto" inside the worker. */
  runtime: EngineRuntime;

  private constructor(
    model: string,
    private readonly worker: Worker,
    private readonly pending: Map<number, Pending>
  ) {
    this.runtime = { engine: "local", model, device: "unknown", dtype: "unknown" };
  }

  static async create(
    model: string,
    onProgress: (progress: LoadProgress) => void
  ): Promise<Engine> {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const pending = new Map<number, Pending>();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return; // a reply to a request nobody is waiting for
      if (response.kind === "progress") {
        entry.onProgress?.(response.progress);
        return; // progress is not the final reply; keep waiting
      }
      pending.delete(response.id);
      if (response.kind === "error") entry.reject(new Error(response.message));
      else entry.resolve(response);
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || "The model worker crashed.");
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    };

    const engine = new LocalEngine(model, worker, pending);
    try {
      const ready = await engine.send({ kind: "load", model }, onProgress);
      if (ready.kind !== "ready") throw new Error("The model failed to load.");
      engine.runtime = ready.runtime;
      return engine;
    } catch (caught) {
      // A worker holding a partially-loaded model is a real memory leak — a
      // failed multi-gigabyte load must not survive in a tab that looks idle.
      // Rethrow the original error (e.g. "WebGPU device lost") rather than a
      // generic wrapper, so the visitor sees why loading actually failed.
      worker.terminate();
      throw caught;
    }
  }

  private send(
    request: WorkerRequestBody,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<WorkerResponse> {
    const id = nextRequestId();
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ ...request, id } as WorkerRequest);
    });
  }

  async decide(
    state: string,
    questions: Record<string, Question>
  ): Promise<Record<string, Answer>> {
    const response = await this.send({ kind: "decide", state, questions });
    if (response.kind !== "answers") throw new Error("The decision failed.");
    return response.answers;
  }

  /** Synchronous by interface, but the tokenizer lives in the worker. The cache is
   *  filled by `primeTokenCount`; an unseen string falls back to a word count so a
   *  freshly typed state still shows a number. That fallback is only an estimate —
   *  measured against the real tokenizer it undercounts by roughly 1.8x to 2.2x —
   *  so callers should prime before treating the result as exact. */
  countTokens(state: string): number {
    return this.tokenCache.get(state) ?? state.split(/\s+/).filter(Boolean).length;
  }

  async primeTokenCount(state: string): Promise<number> {
    const response = await this.send({ kind: "countTokens", state });
    if (response.kind !== "tokens") throw new Error("Token counting failed.");
    this.tokenCache.set(state, response.tokens);
    return response.tokens;
  }

  async dispose(): Promise<void> {
    try {
      await this.send({ kind: "dispose" });
    } finally {
      // Clearing the map does not settle anything still waiting on it: a
      // decide() or countTokens() outstanding when dispose() runs must be
      // rejected, not silently abandoned, or its caller hangs forever.
      const disposedError = new Error(
        "The engine was disposed while this request was still pending."
      );
      for (const entry of this.pending.values()) entry.reject(disposedError);
      this.pending.clear();
      this.worker.terminate();
    }
  }
}

export async function createLocalEngine(
  model: string,
  onProgress: (progress: LoadProgress) => void
): Promise<Engine> {
  return LocalEngine.create(model, onProgress);
}

/** Size and cache status without loading anything, so the first-visit disclosure
 *  is measured rather than hard-coded. */
export async function inspectModel(model: string): Promise<OpenJevInfo> {
  return OpenJev.info({ model });
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
