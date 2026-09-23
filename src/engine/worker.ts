/// <reference lib="webworker" />
import { OpenJev } from "open-jev";
import { describeError } from "./protocol";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Answer } from "./types";

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
