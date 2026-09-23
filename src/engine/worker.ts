/// <reference lib="webworker" />
import { OpenJev } from "open-jev";
import { env } from "@huggingface/transformers";
import { describeError } from "./protocol";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Answer } from "./types";

// By default `@huggingface/transformers` points ONNX Runtime's WASM loader at
// cdn.jsdelivr.net — a request to a host we don't control on every page load,
// leaking every visitor's IP and user agent and breaking this app's "nothing
// leaves your machine" claim. `public/onnxruntime/` is populated at dev/build
// time (scripts/copy-onnx-runtime.mjs) from the exact `onnxruntime-web` this
// project actually installs, so this points at our own origin instead. Setting
// it here, at import time and before any `load` request is handled, runs after
// transformers' own default assignment (imports evaluate before this module's
// body does) but before ONNX Runtime is actually initialised, which happens
// lazily inside `OpenJev.load()`.
// `wasm` itself is a readonly reference, always already populated by
// transformers' own module-level code by the time this runs (its type is only
// optional because `env.backends.onnx` is a `Partial<Env>`) — mutate its
// `wasmPaths` property in place rather than reassign the object.
const onnxWasm = env.backends.onnx.wasm;
if (!onnxWasm) {
  throw new Error("ONNX Runtime's WASM backend was not initialised as expected.");
}
onnxWasm.wasmPaths = {
  mjs: "/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs",
  wasm: "/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm",
};

let jev: OpenJev | null = null;

function reply(message: WorkerResponse): void {
  self.postMessage(message);
}

function required(): OpenJev {
  if (!jev) throw new Error("The model is not loaded.");
  return jev;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    switch (request.kind) {
      case "load": {
        jev = await OpenJev.load({
          model: request.model,
          onProgress: (progress) =>
            reply({ id: request.id, kind: "progress", progress }),
        });
        reply({
          id: request.id,
          kind: "ready",
          runtime: { engine: "local", ...jev.runtime },
        });
        break;
      }
      case "decide": {
        const answers = await required().decide(request.state, request.questions);
        reply({
          id: request.id,
          kind: "answers",
          answers: answers as Record<string, Answer>,
        });
        break;
      }
      case "countTokens": {
        reply({
          id: request.id,
          kind: "tokens",
          tokens: required().countTokens(request.state),
        });
        break;
      }
      case "dispose": {
        await jev?.dispose();
        jev = null;
        reply({ id: request.id, kind: "done" });
        break;
      }
    }
  } catch (caught) {
    reply({ id: request.id, kind: "error", message: describeError(caught) });
  }
};
