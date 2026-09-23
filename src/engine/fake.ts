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
 * deterministic; `overrides` pins an exact probability per question key so a
 * routing test can place a case precisely inside or outside the band.
 */
export class FakeEngine implements Engine {
  readonly runtime: EngineRuntime = {
    engine: "local",
    model: "fake",
    device: "none",
    dtype: "none",
  };

  constructor(private readonly overrides: Record<string, number> = {}) {}

  async decide(
    state: string,
    questions: Record<string, Question>
  ): Promise<Record<string, Answer>> {
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      const seed = this.overrides[key] ?? hash(state + key + question.instructions);
      answers[key] = this.answer(question, seed);
    }
    return answers;
  }

  countTokens(state: string): number {
    return state.split(/\s+/).filter(Boolean).length;
  }

  async dispose(): Promise<void> {}

  private answer(question: Question, seed: number): Answer {
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
    const weights = labels.map((label, index) => hash(label + index) + seed);
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
