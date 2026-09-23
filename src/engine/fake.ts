import type { Answer, Engine, EngineRuntime, Question } from "./types";

/** A stable hash of the state and the question text, so the same input always
 *  produces the same answer and a different input produces a different one. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

/**
 * An Engine that answers without a model. Every test in this project uses it, so
 * the suite runs in milliseconds and CI never downloads weights. Answers are
 * deterministic; `overrides` pins an exact probability for noul questions only,
 * allowing a routing test to place a case precisely inside or outside the band.
 * Overrides on choice or score questions throw an error.
 */
export class FakeEngine implements Engine {
  readonly runtime: EngineRuntime = {
    engine: "local",
    model: "fake",
    device: "none",
    dtype: "none",
  };

  constructor(private readonly overrides: Record<string, number> = {}) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value !== "number" || value < 0 || value > 1) {
        throw new Error(
          `FakeEngine override for "${key}" must be a number between 0 and 1, got ${value}`
        );
      }
    }
  }

  async decide(
    state: string,
    questions: Record<string, Question>
  ): Promise<Record<string, Answer>> {
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      if (key in this.overrides) {
        if (question.type !== "noul") {
          throw new Error(
            `FakeEngine override for "${key}" is only supported for noul questions, but got type "${question.type}". Pinning probabilities is implemented for noul questions only.`
          );
        }
      }
      const seed = this.overrides[key] ?? hash(state + key + question.instructions);
      answers[key] = this.answer(question, seed, state, key);
    }
    return answers;
  }

  countTokens(state: string): number {
    return state.split(/\s+/).filter(Boolean).length;
  }

  async dispose(): Promise<void> {}

  private answer(question: Question, seed: number, state: string, key: string): Answer {
    if (question.type === "noul") {
      return {
        type: "noul",
        answer: seed >= 0.5,
        probability: seed,
        confidence: Math.max(seed, 1 - seed),
      };
    }

    // `choice` and `score` both carry their labels in `options`. open-jev does not
    // export a helper for this, so read the field directly.
    const labels = question.options as readonly string[];
    // Spread the mass deterministically over the labels, then normalise.
    // For choice/score, combine the label hash with the state and question to get
    // a deterministic but state-aware distribution.
    const weights = labels.map((label, index) => hash(state + key + label + index));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const probabilities: Record<string, number> = {};
    labels.forEach((label, index) => {
      probabilities[label] = weights[index] / total;
    });
    const best = labels.reduce((winner, label) =>
      probabilities[label] > probabilities[winner] ? label : winner
    );

    if (question.type === "choice") {
      return {
        type: "choice",
        choice: best,
        confidence: probabilities[best],
        probabilities,
      };
    }

    const expected = labels.reduce(
      (sum, label, index) => sum + index * probabilities[label],
      0
    );
    return {
      type: "score",
      score: expected,
      normalized: labels.length > 1 ? expected / (labels.length - 1) : 0,
      level: labels[Math.round(expected)],
      confidence: probabilities[best],
      probabilities,
    };
  }
}
