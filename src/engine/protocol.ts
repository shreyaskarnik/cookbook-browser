import type { LoadProgress } from "open-jev";
import type { Answer, EngineRuntime, Question } from "./types";

// Factored out so callers can name "a WorkerRequest without its id" directly.
// `Omit<WorkerRequest, "id">` looks equivalent but is not: `keyof` on an
// intersection with a union keeps only the keys common to every union member,
// so `Omit` there collapses to `{ kind }` alone and silently drops `model` /
// `state` / `questions`.
export type WorkerRequestBody =
  | { kind: "load"; model: string }
  | { kind: "decide"; state: string; questions: Record<string, Question> }
  | { kind: "countTokens"; state: string }
  | { kind: "dispose" };

export type WorkerRequest = { id: number } & WorkerRequestBody;

export type WorkerResponse = { id: number } & (
  | { kind: "ready"; runtime: EngineRuntime }
  | { kind: "progress"; progress: LoadProgress }
  | { kind: "answers"; answers: Record<string, Answer> }
  | { kind: "tokens"; tokens: number }
  | { kind: "done" }
  | { kind: "error"; message: string }
);

let counter = 0;

/** Monotonic ids so a reply that arrives after its caller gave up is discarded
 *  rather than resolving a later request. */
export function nextRequestId(): number {
  counter += 1;
  return counter;
}

/** A worker can reject with anything. Always produce a non-empty sentence, because
 *  this string is rendered to the visitor. */
export function describeError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught);
  return message.trim() === "" ? "The model failed without a message." : message;
}
