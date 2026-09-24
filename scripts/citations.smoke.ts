/**
 * Measures the citations card's OWN shipped items, run by hand:
 * `pnpm smoke:citations`.
 *
 * The wave-1b probe measured a different set of citations, written for the
 * probe. `requires.why` describes where the auto-accept floor has a case to
 * catch, which is a claim about the items a visitor actually sees — so it has
 * to be measured on those, not generalised from the probe's.
 */
import { OpenJev } from "open-jev";
import { expect, it } from "vitest";
import definition from "../src/cookbooks/citationCheck";

const MODEL = (process.env.PROBE_MODEL ?? "kev-0.6b") as "kev-0.6b" | "kev-4b";

it(`routes the shipped citations at ${MODEL}`, async () => {
  const spec = definition.items!;
  const jev = await OpenJev.load({ model: MODEL, device: "cpu" });
  const out: string[] = [`model: ${MODEL}`];

  for (const item of spec.items) {
    const pre = spec.preCheck?.(item, spec.labelFor);
    if (pre) {
      out.push(`${item.id.padEnd(18)} ${"(pre-check)".padEnd(14)} ${pre.outcome} — no model call`);
      continue;
    }
    const started = performance.now();
    const answers = await jev.decide(spec.toState(item), definition.questions);
    const ms = Math.round(performance.now() - started);
    const routed = spec.rule(answers, item, spec.labelFor);
    out.push(
      `${item.id.padEnd(18)} ${routed.outcome.padEnd(14)} ${routed.detail.padStart(5)} ` +
        `-> ${routed.disposition}${routed.disposition === "review" ? " (to a person)" : ""}  (${ms} ms)`
    );
  }

  await jev.dispose();
  expect(out.join("\n")).toBe("PRINT_ME");
}, 1_800_000);
