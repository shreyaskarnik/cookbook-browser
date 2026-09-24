/**
 * Real-model check, run by hand: `pnpm smoke`.
 * Downloads kev-0.6b (~340 MB) and runs the card's fourteen questions on CPU.
 * Never part of `pnpm test` — CI must not download weights. Run through Vitest
 * (via vitest.smoke.config.ts) rather than bare Node, so it shares the project's
 * TypeScript transform instead of depending on a Node version that can strip types.
 */
import { OpenJev } from "open-jev";
import { expect, it } from "vitest";
import definition from "../src/cookbooks/consistencyNoul";

it("answers the cookbook's fourteen questions on a real claim", async () => {
  const jev = await OpenJev.load({ model: "kev-0.6b", device: "cpu" });
  const lines: string[] = [`runtime: ${JSON.stringify(jev.runtime)}`];

  // This cookbook is single-state, so it has samples; the field is optional
  // on the type because a per-item cookbook offers `items` instead.
  for (const sample of definition.samples!) {
    const started = performance.now();
    const answers = await jev.decide(sample.text, definition.questions);
    const ms = performance.now() - started;
    const probabilities: number[] = [];
    lines.push(
      `\n--- ${sample.label} (${jev.countTokens(sample.text)} state tokens, ${Math.round(ms)} ms) ---`
    );
    for (const [key, answer] of Object.entries(answers)) {
      if (answer.type !== "noul") throw new Error(`${key} is not a noul`);
      probabilities.push(answer.probability);
      const bar = "#".repeat(Math.round(answer.probability * 24)).padEnd(24, ".");
      lines.push(`${bar} ${(answer.probability * 100).toFixed(0).padStart(3)}%  ${key}`);
    }
    const spread = Math.max(...probabilities) - Math.min(...probabilities);
    const inBand = probabilities.filter((p) => p >= 0.3 && p <= 0.7).length;
    lines.push(`spread ${spread.toFixed(3)} | in band ${inBand}/14 | auto ${14 - inBand}/14`);
  }
  await jev.dispose();

  // Deliberately forced failure: this check exists to print its numbers for a human to read,
  // not to assert a threshold. Read the diff output, then decide.
  expect(lines.join("\n")).toBe("PRINT_ME");
}, 1_800_000);
