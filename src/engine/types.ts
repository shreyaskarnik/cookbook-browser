import type { Answer, Question } from "open-jev";

export type { Answer, Question };
export type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from "open-jev";

/** Which implementation is answering. Phase 1 ships only "local"; "typesafe" exists
 *  so the remote engine is an added file rather than a change to this interface. */
export type EngineId = "local" | "typesafe";

export interface EngineRuntime {
  engine: EngineId;
  /** Hugging Face repo id, or "fake". */
  model: string;
  /** "webgpu" | "wasm" | "cpu" | "none". */
  device: string;
  /** Weight variant, or "none". */
  dtype: string;
}

/**
 * One state plus typed questions in, one answer per question out.
 *
 * `decide` takes questions as a keyed object and returns answers under the same
 * keys. Implementations must answer every key or throw — never return a partial
 * map, because a card reading a missing key would render a silent blank.
 */
export interface Engine {
  readonly runtime: EngineRuntime;
  decide(
    state: string,
    questions: Record<string, Question>
  ): Promise<Record<string, Answer>>;
  /** Token count of `state` alone, for the over-length warning. */
  countTokens(state: string): number;
  dispose(): Promise<void>;
}
