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
});
