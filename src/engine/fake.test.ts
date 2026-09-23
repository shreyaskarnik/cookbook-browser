import { noul, choice, score } from "open-jev";
import { describe, expect, it } from "vitest";
import { FakeEngine } from "./fake";

describe("FakeEngine", () => {
  it("answers every question it is given, under the same keys", async () => {
    const engine = new FakeEngine();
    const answers = await engine.decide("some state", {
      covered: noul("Is the loss covered?"),
      team: choice("Which team?", ["billing", "support"]),
      urgency: score("How urgent?", ["low", "high"]),
    });
    expect(Object.keys(answers).sort()).toEqual(["covered", "team", "urgency"]);
    expect(answers.covered.type).toBe("noul");
    expect(answers.team.type).toBe("choice");
    expect(answers.urgency.type).toBe("score");
  });

  it("is deterministic: the same state and question give the same probability", async () => {
    const engine = new FakeEngine();
    const first = await engine.decide("a claim", { q: noul("Is it covered?") });
    const second = await engine.decide("a claim", { q: noul("Is it covered?") });
    expect(first.q).toEqual(second.q);
  });

  it("gives different probabilities for different states", async () => {
    const engine = new FakeEngine();
    const a = await engine.decide("state one", { q: noul("Is it covered?") });
    const b = await engine.decide("state two", { q: noul("Is it covered?") });
    expect(a.q).not.toEqual(b.q);
  });

  it("lets a test pin an exact probability by key, so routing tests can be precise", async () => {
    const engine = new FakeEngine({ covered: 0.92, fraud: 0.5 });
    const answers = await engine.decide("anything", {
      covered: noul("Is the loss covered?"),
      fraud: noul("Any fraud indicators?"),
    });
    expect(answers.covered).toMatchObject({ type: "noul", probability: 0.92, answer: true });
    expect(answers.fraud).toMatchObject({ type: "noul", probability: 0.5, answer: true });
  });

  it("returns a normalised distribution for choices", async () => {
    const engine = new FakeEngine();
    const answers = await engine.decide("s", { team: choice("Which?", ["a", "b", "c"]) });
    const answer = answers.team;
    if (answer.type !== "choice") throw new Error("expected a choice");
    const total = Object.values(answer.probabilities).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(answer.probabilities[answer.choice]).toBe(answer.confidence);
  });

  it("reports a runtime that names itself a fake, never a real model", () => {
    expect(new FakeEngine().runtime).toEqual({
      engine: "local",
      model: "fake",
      device: "none",
      dtype: "none",
    });
  });

  it("throws if an override is used on a choice question", async () => {
    const engine = new FakeEngine({ team: 0.5 });
    await expect(
      engine.decide("state", { team: choice("Which?", ["a", "b"]) })
    ).rejects.toThrow(
      'FakeEngine override for "team" is only supported for noul questions, but got type "choice"'
    );
  });

  it("throws if an override is used on a score question", async () => {
    const engine = new FakeEngine({ urgency: 0.5 });
    await expect(
      engine.decide("state", { urgency: score("How urgent?", ["low", "high"]) })
    ).rejects.toThrow(
      'FakeEngine override for "urgency" is only supported for noul questions, but got type "score"'
    );
  });

  it("throws if an override value is below 0", () => {
    expect(() => new FakeEngine({ q: -0.1 })).toThrow(
      'FakeEngine override for "q" must be a number between 0 and 1, got -0.1'
    );
  });

  it("throws if an override value is above 1", () => {
    expect(() => new FakeEngine({ q: 1.1 })).toThrow(
      'FakeEngine override for "q" must be a number between 0 and 1, got 1.1'
    );
  });

  it("choice and score distributions sum to 1 without overrides", async () => {
    const engine = new FakeEngine();
    const answers = await engine.decide("state", {
      choice_q: choice("Which?", ["x", "y", "z"]),
      score_q: score("Rate:", ["bad", "okay", "good"]),
    });

    const choiceAnswer = answers.choice_q;
    if (choiceAnswer.type !== "choice") throw new Error("expected choice");
    const choiceTotal = Object.values(choiceAnswer.probabilities).reduce(
      (sum, p) => sum + p,
      0
    );
    expect(choiceTotal).toBeCloseTo(1, 5);

    const scoreAnswer = answers.score_q;
    if (scoreAnswer.type !== "score") throw new Error("expected score");
    const scoreTotal = Object.values(scoreAnswer.probabilities).reduce(
      (sum, p) => sum + p,
      0
    );
    expect(scoreTotal).toBeCloseTo(1, 5);
  });

  it("choice and score distributions are deterministic for the same state and question", async () => {
    const engine = new FakeEngine();
    const first = await engine.decide("state", {
      choice_q: choice("Which?", ["x", "y", "z"]),
      score_q: score("Rate:", ["bad", "okay", "good"]),
    });
    const second = await engine.decide("state", {
      choice_q: choice("Which?", ["x", "y", "z"]),
      score_q: score("Rate:", ["bad", "okay", "good"]),
    });

    if (first.choice_q.type !== "choice") throw new Error("expected choice");
    if (second.choice_q.type !== "choice") throw new Error("expected choice");
    expect(first.choice_q.probabilities).toEqual(second.choice_q.probabilities);

    if (first.score_q.type !== "score") throw new Error("expected score");
    if (second.score_q.type !== "score") throw new Error("expected score");
    expect(first.score_q.probabilities).toEqual(second.score_q.probabilities);
  });
});
