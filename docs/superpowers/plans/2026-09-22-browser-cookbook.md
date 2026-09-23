# Cookbook in the Browser — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static web app where a visitor runs TypeSafe's "Self-consistency: nouls" cookbook against their own text, on a model that downloads into their browser, and drags the uncertainty band to watch cases move between auto-decided and escalated.

**Architecture:** A Vite/React single-page app. All model work sits behind one `Engine` interface; the only Phase 1 implementation wraps `open-jev` inside a Web Worker so WebGPU inference never blocks the UI, and a deterministic `FakeEngine` backs every test so the suite runs in milliseconds with no model download. Cookbooks are data (`CookbookDefinition` objects), so adding the other seventeen later means adding files, not changing components.

**Tech Stack:** TypeScript 5.9, React 19.3, Vite 8, Tailwind 4.3 (`@tailwindcss/vite`), `open-jev` 0.1.2 over `@huggingface/transformers` 4.3, Vitest 5 + Testing Library 16, pnpm, Node 20.19+ (CI uses 24). Deployed as a static Hugging Face Space.

**Spec:** `docs/superpowers/specs/2026-09-22-browser-cookbook-design.md`

## Global Constraints

- **Never compare Kev to Jev.** No local number appears beside a TypeSafe published benchmark, anywhere in UI copy, comments, or the README. Cards link to their cookbook; benchmark claims stay on the cookbook.
- **No accuracy claims.** Copy describes patterns ("route uncertain cases to review"), never quality ("as good as").
- **Local is the default on every visit.** No setting makes a remote engine the default.
- **No API key in Phase 1.** The TypeSafe engine is deliberately out of scope (see Scope below). The `Engine` interface must accommodate it without change.
- **Nothing leaves the tab.** No analytics, no telemetry, no error reporting service, no font or asset fetched from a host other than Hugging Face (model weights) and Google Fonts (typeface). State text is never logged, never put in a URL, never persisted anywhere but React state.
- **Versions are floors, matched to the reference implementation:** `open-jev@^0.1.2`, `@huggingface/transformers@^4.3.0`, `react@^19.3.0`, `vite@^8.3.0`, `tailwindcss@^4.3.3`, `typescript@^5.9.3`. CI uses Node 24; Vite 8 requires Node `^20.19.0 || >=22.12.0`, which is the real floor.
- **Test toolchain:** `vitest@^5.0.1` (its peer range is `vite ^6.4.0 || ^7.0.0 || ^8.0.0`; vitest 3 does not pair with Vite 8) and `@testing-library/react@^16.3.0` (16.3.3 is the latest published; there is no 17).
- **Vite config is not optional:** `optimizeDeps.exclude: ["@huggingface/transformers"]` and `build.target: "esnext"`. Without both, the ONNX runtime fails at runtime.
- **Repo:** `/Users/shreyas/work/rnd/jev-mario/cookbook-browser`, pushed to `github.com/shreyaskarnik/cookbook-browser` (public). The copies of this plan and the design under `docs/superpowers/` in that repo are canonical; the copies in the parent directory are historical.

## Scope

**In Phase 1:** the app shell, the sidebar listing all 18 cookbooks (17 marked "coming soon", not clickable), the model load gate, the worker-backed local engine, and one fully interactive card — Self-consistency: nouls.

**Deferred to later plans, deliberately:**
- The other 17 cards. The card contract this plan establishes is what they plug into.
- **The TypeSafe API engine.** Implementing it needs the exact request/response shape of TypeSafe's API, which is not yet established; writing it now would mean guessing. The `Engine` interface, the engine-selection state and the `runtime.engine` field all exist in Phase 1 so adding it is an added file, not a refactor. When it is built it must follow the spec's key rules: `sessionStorage` only, never a URL parameter, never logged, a visible "clear key" control, and a plain sentence stating what leaves the machine.
- The DuckDB-WASM card from the spec's open questions.

## File Structure

```
cookbook-browser/
  package.json, pnpm-lock.yaml, .gitignore, .prettierrc
  tsconfig.json, tsconfig.app.json, tsconfig.node.json
  vite.config.ts             Vite + React + Tailwind; the two required ONNX settings
  vitest.config.ts           jsdom environment, setup file
  index.html
  .github/workflows/deploy-hugging-face-space.yml
  scripts/smoke.ts           opt-in real-model check in Node; never runs in CI
  src/
    main.tsx                 mounts App
    App.tsx                  load gate -> shell; owns the Engine instance
    index.css                Tailwind import + design tokens
    test/setup.ts            Testing Library matchers
    engine/
      types.ts               Engine, EngineRuntime, EngineStatus; re-exports open-jev's Question/Answer
      fake.ts                FakeEngine: deterministic, no model, used by every test
      protocol.ts            Worker request/response messages + pure encode/decode. No DOM, no worker.
      worker.ts              The worker entry: owns the OpenJev instance, speaks protocol.ts
      localEngine.ts         Engine implementation that talks to worker.ts
      index.ts               createEngine(), isWebGpuAvailable(), inspectModel()
    cookbooks/
      types.ts               CookbookDefinition, CookbookCategory, CookbookStub
      catalog.ts             All 18 entries: title, slug, category, description, status
      consistencyNoul.ts     The one built card: questions, samples, docs link, code sample
      index.ts               registry lookup
    lib/
      routing.ts             Uncertainty-band maths. Pure. The most-tested file here.
      format.ts              percentages, byte sizes, durations
    components/
      load/LoadGate.tsx      model choice, size/cache disclosure, progress, device
      load/ModelChoice.tsx
      shell/Shell.tsx        sidebar + body + right rail layout
      shell/Sidebar.tsx      the 18, grouped by category
      shell/TopBar.tsx       runtime badge (model, device, engine)
      panes/StatePane.tsx    editable state + token count
      panes/QuestionsPane.tsx  the typed questions, read-only in Phase 1
      panes/AnswersPane.tsx  probability bars + verdict chips
      panes/SamplesRail.tsx  sample states + "bring your own"
      cards/ConsistencyNoulCard.tsx  composes the panes, owns the band slider
      ui/                    Bar, Chip, Button, Slider, Progress — small and unexported elsewhere
```

Tests live beside their subject as `*.test.ts(x)`.

---

### Task 1: Project scaffold that builds and tests

**Files:**
- Create: `cookbook-browser/package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `.gitignore`, `.prettierrc`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`
- Test: `src/lib/format.test.ts`, `src/lib/format.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatBytes(bytes: number): string`, `formatPercent(fraction: number): string`, `formatDuration(ms: number): string` from `src/lib/format.ts`. A working `pnpm test`, `pnpm build`, `pnpm dev`.

- [ ] **Step 1: Create the repo and install dependencies**

The repo already exists at `/Users/shreyas/work/rnd/jev-mario/cookbook-browser`, is on
`main`, and has `origin` set to `github.com/shreyaskarnik/cookbook-browser` with the design
and this plan committed. Do not re-create it; work inside it.

```bash
cd /Users/shreyas/work/rnd/jev-mario/cookbook-browser
pnpm init
pnpm add react@^19.3.0 react-dom@^19.3.0 open-jev@^0.1.2 @huggingface/transformers@^4.3.0 lucide-react@^1.47.0
pnpm add -D typescript@^5.9.3 vite@^8.3.0 @vitejs/plugin-react@^6.1.1 tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 \
  vitest@^5.0.1 jsdom@^27.0.0 @testing-library/react@^16.3.0 @testing-library/jest-dom@^6.9.0 @testing-library/user-event@^14.6.0 \
  @types/react@^19.3.0 @types/react-dom@^19.3.0 prettier@^3.9.8
```

- [ ] **Step 2: Write the config files**

`package.json` scripts block:

```json
{
  "name": "cookbook-browser",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "vitest run --config vitest.smoke.config.ts",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  }
}
```

`vite.config.ts` — both settings below are required for the ONNX runtime, do not remove them:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: { target: "esnext", chunkSizeWarningLimit: 4000 },
  worker: { format: "es" },
});
```

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

`src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "scripts"]
}
```

`.gitignore`:

```
node_modules
dist
*.tsbuildinfo
.DS_Store
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cookbook in the browser</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-ink: #1c1917;
  --color-stone: #78716c;
  --color-paper: #fafaf9;
  --color-line: #e7e5e4;
  --color-auto: #4d7c0f;
  --color-review: #b45309;
}

body {
  @apply bg-paper text-ink antialiased;
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx` (a placeholder replaced in Task 8):

```tsx
export default function App() {
  return <main className="p-8">Cookbook in the browser</main>;
}
```

- [ ] **Step 3: Write the failing test**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatPercent } from "./format";

describe("formatBytes", () => {
  it("uses GB above a gigabyte", () => {
    expect(formatBytes(2_300_000_000)).toBe("2.3 GB");
  });
  it("uses MB below a gigabyte", () => {
    expect(formatBytes(340_000_000)).toBe("340 MB");
  });
  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 MB");
  });
});

describe("formatPercent", () => {
  it("renders a fraction as a whole percent", () => {
    expect(formatPercent(0.732)).toBe("73%");
  });
  it("keeps a decimal below one percent so tiny probabilities are visible", () => {
    expect(formatPercent(0.004)).toBe("0.4%");
  });
  it("renders one", () => {
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("formatDuration", () => {
  it("uses milliseconds under a second", () => {
    expect(formatDuration(412)).toBe("412 ms");
  });
  it("uses seconds above a second", () => {
    expect(formatDuration(2480)).toBe("2.5 s");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 5: Write the implementation**

`src/lib/format.ts`:

```ts
/** Human-readable download sizes. Decimal units, to match what Hugging Face reports. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** A probability as a percent. Below 1% keeps one decimal, so a small but non-zero
 *  probability does not render as a flat "0%". */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent > 0 && percent < 1) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
```

- [ ] **Step 6: Run the tests and the build**

Run: `pnpm test && pnpm build`
Expected: 8 tests pass; `dist/` is produced with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + Tailwind app with Vitest"
```

---

### Task 2: Engine interface and a deterministic fake

**Why this shape:** every later task is written against `Engine`, so the whole suite runs without downloading a model, and the deferred TypeSafe engine slots in as one more implementation.

**Files:**
- Create: `src/engine/types.ts`, `src/engine/fake.ts`
- Test: `src/engine/fake.test.ts`

**Interfaces:**
- Consumes: `Question`, `Answer` types from `open-jev`.
- Produces:
  - `type EngineId = "local" | "typesafe"`
  - `interface EngineRuntime { engine: EngineId; model: string; device: string; dtype: string }`
  - `interface Engine { readonly runtime: EngineRuntime; decide(state: string, questions: Record<string, Question>): Promise<Record<string, Answer>>; countTokens(state: string): number; dispose(): Promise<void> }`
  - `class FakeEngine implements Engine` with constructor `new FakeEngine(overrides?: Record<string, number>)`.

- [ ] **Step 1: Write the failing test**

`src/engine/fake.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/engine/fake.test.ts`
Expected: FAIL — `Failed to resolve import "./fake"`.

- [ ] **Step 3: Write the interface**

`src/engine/types.ts`:

```ts
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
```

- [ ] **Step 4: Write the fake**

`src/engine/fake.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS — 14 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Engine interface and a deterministic fake engine"
```

---

### Task 3: The uncertainty band

**Why this is its own task:** this is the knob. Everything the card does visually is a rendering of these functions, and they are pure, so they carry the densest tests in the project.

The cookbook (`/cookbooks/consistency_noul_cookbook`) defines the rule: below 0.30 is an automatic "no", above 0.70 an automatic "yes", and 0.30–0.70 inclusive is uncertain and goes to a human. The card makes those two bounds draggable.

**Files:**
- Create: `src/lib/routing.ts`
- Test: `src/lib/routing.test.ts`

**Interfaces:**
- Consumes: `NoulAnswer` from `src/engine/types.ts`.
- Produces:
  - `const DEFAULT_BAND: Band` = `{ low: 0.3, high: 0.7 }`
  - `type Band = { low: number; high: number }`
  - `type Verdict = "yes" | "no" | "uncertain"`
  - `function classify(probability: number, band: Band): Verdict`
  - `function clampBand(band: Band): Band`
  - `type RoutedQuestion = { key: string; probability: number; verdict: Verdict }`
  - `function routeAll(answers: Record<string, NoulAnswer>, band: Band): RoutedQuestion[]`
  - `function bandSummary(routed: RoutedQuestion[]): { yes: number; no: number; uncertain: number; automatedShare: number }`
  - `type ClaimVerdict = { outcome: "auto" | "review"; reason: string }`
  - `const CRITICAL_KEYS: readonly string[]`
  - `function claimVerdict(routed: RoutedQuestion[]): ClaimVerdict`

- [ ] **Step 1: Write the failing test**

`src/lib/routing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NoulAnswer } from "../engine/types";
import {
  DEFAULT_BAND,
  bandSummary,
  clampBand,
  classify,
  routeAll,
} from "./routing";

const answer = (probability: number): NoulAnswer => ({
  type: "noul",
  answer: probability >= 0.5,
  probability,
  confidence: Math.max(probability, 1 - probability),
});

describe("classify", () => {
  it("calls a low probability no", () => {
    expect(classify(0.05, DEFAULT_BAND)).toBe("no");
  });
  it("calls a high probability yes", () => {
    expect(classify(0.95, DEFAULT_BAND)).toBe("yes");
  });
  it("calls a middling probability uncertain", () => {
    expect(classify(0.5, DEFAULT_BAND)).toBe("uncertain");
  });
  it("treats both bounds as inside the band, matching the cookbook", () => {
    expect(classify(0.3, DEFAULT_BAND)).toBe("uncertain");
    expect(classify(0.7, DEFAULT_BAND)).toBe("uncertain");
  });
  it("decides everything when the band is closed to nothing", () => {
    const closed = { low: 0, high: 0 };
    expect(classify(0.4, closed)).toBe("yes");
    expect(classify(0, closed)).toBe("uncertain");
  });
  it("escalates everything when the band spans the range", () => {
    expect(classify(0.99, { low: 0, high: 1 })).toBe("uncertain");
    expect(classify(0.01, { low: 0, high: 1 })).toBe("uncertain");
  });
});

describe("clampBand", () => {
  it("keeps a sane band as it is", () => {
    expect(clampBand({ low: 0.2, high: 0.8 })).toEqual({ low: 0.2, high: 0.8 });
  });
  it("swaps a crossed band rather than producing an empty one", () => {
    expect(clampBand({ low: 0.8, high: 0.2 })).toEqual({ low: 0.2, high: 0.8 });
  });
  it("holds the bounds inside zero and one", () => {
    expect(clampBand({ low: -0.5, high: 1.5 })).toEqual({ low: 0, high: 1 });
  });
});

describe("routeAll", () => {
  it("routes every answer and keeps the keys", () => {
    const routed = routeAll(
      { covered: answer(0.95), fraud: answer(0.5), excluded: answer(0.02) },
      DEFAULT_BAND
    );
    expect(routed).toEqual([
      { key: "covered", probability: 0.95, verdict: "yes" },
      { key: "fraud", probability: 0.5, verdict: "uncertain" },
      { key: "excluded", probability: 0.02, verdict: "no" },
    ]);
  });
  it("preserves insertion order so the card does not reshuffle as the slider moves", () => {
    const routed = routeAll(
      { b: answer(0.1), a: answer(0.9), c: answer(0.5) },
      DEFAULT_BAND
    );
    expect(routed.map((entry) => entry.key)).toEqual(["b", "a", "c"]);
  });
  it("returns nothing for no answers", () => {
    expect(routeAll({}, DEFAULT_BAND)).toEqual([]);
  });
});

describe("bandSummary", () => {
  it("counts each verdict and the automated share", () => {
    const routed = routeAll(
      {
        a: answer(0.95),
        b: answer(0.9),
        c: answer(0.5),
        d: answer(0.02),
      },
      DEFAULT_BAND
    );
    expect(bandSummary(routed)).toEqual({
      yes: 2,
      no: 1,
      uncertain: 1,
      automatedShare: 0.75,
    });
  });
  it("reports a zero share for nothing, without dividing by zero", () => {
    expect(bandSummary([])).toEqual({
      yes: 0,
      no: 0,
      uncertain: 0,
      automatedShare: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/routing.test.ts`
Expected: FAIL — `Failed to resolve import "./routing"`.

- [ ] **Step 3: Write the implementation**

`src/lib/routing.ts`:

```ts
import type { NoulAnswer } from "../engine/types";

/** An uncertainty band. Probabilities inside it, bounds included, go to a human. */
export type Band = { low: number; high: number };

export type Verdict = "yes" | "no" | "uncertain";

/** The cookbook's band: below 0.30 is a no, above 0.70 a yes, the rest a human's call. */
export const DEFAULT_BAND: Band = { low: 0.3, high: 0.7 };

/** Both bounds are inclusive, so widening the band never leaves a probability
 *  unclassified at the edge. */
export function classify(probability: number, band: Band): Verdict {
  if (probability < band.low) return "no";
  if (probability > band.high) return "yes";
  return "uncertain";
}

/** Keep a band usable however the two slider handles are dragged: inside 0..1, and
 *  low below high (a crossed band is a drag past the other handle, not a request
 *  for an empty band). */
export function clampBand(band: Band): Band {
  const low = Math.min(Math.max(band.low, 0), 1);
  const high = Math.min(Math.max(band.high, 0), 1);
  return low <= high ? { low, high } : { low: high, high: low };
}

export type RoutedQuestion = {
  key: string;
  probability: number;
  verdict: Verdict;
};

/** Insertion order is preserved: the card renders this list directly, and
 *  re-sorting it as the slider moves would make rows jump under the cursor. */
export function routeAll(
  answers: Record<string, NoulAnswer>,
  band: Band
): RoutedQuestion[] {
  return Object.entries(answers).map(([key, answer]) => ({
    key,
    probability: answer.probability,
    verdict: classify(answer.probability, band),
  }));
}

export function bandSummary(routed: RoutedQuestion[]): {
  yes: number;
  no: number;
  uncertain: number;
  automatedShare: number;
} {
  const counts = { yes: 0, no: 0, uncertain: 0 };
  for (const entry of routed) counts[entry.verdict] += 1;
  const automated = counts.yes + counts.no;
  return {
    ...counts,
    automatedShare: routed.length === 0 ? 0 : automated / routed.length,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: PASS — 16 new tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add uncertainty-band routing"
```

- [ ] **Step 6: Write the claim-level verdict**

`routeAll` says what happens to each of the 14 questions. The card also needs one line at the
top answering "so what happens to this claim?".

Three rules were considered. **Escalate when any question is uncertain** is the plainest reading
of the cookbook, but with 14 questions almost every claim escalates and the headline never
responds to the slider. **Escalate above a count** keeps the headline moving but treats "is the
loss covered?" as interchangeable with "do the line items add up?". **Escalate only when a
critical question is uncertain** is how a claims desk actually triages and keeps the headline
responsive, because those probabilities are spread rather than clustered. Build the third.

Append to `src/lib/routing.ts`:

```ts
/** What the card says about the claim as a whole, above the per-question rows. */
export type ClaimVerdict = {
  /** "auto" renders green and says the claim can be actioned without a person.
   *  "review" renders amber and says a person needs to look at it. */
  outcome: "auto" | "review";
  /** One short sentence shown beside the outcome. */
  reason: string;
};

/**
 * The questions a person must be sure about before a payout goes out: whether the
 * loss is covered at all, whether an exclusion kills it, whether it smells like
 * fraud, and whether the file itself asks for a supervisor. Uncertainty anywhere
 * else can be absorbed; uncertainty here cannot.
 *
 * This is a judgment call about claims handling rather than a fact about the model.
 * Change this list (or swap the rule in `claimVerdict` for a count over all
 * fourteen) and the headline changes with it.
 */
export const CRITICAL_KEYS: readonly string[] = [
  "covered",
  "exclusionApplies",
  "fraudIndicators",
  "manualReview",
];

export function claimVerdict(routed: RoutedQuestion[]): ClaimVerdict {
  const critical = routed.filter(
    (entry) => CRITICAL_KEYS.includes(entry.key) && entry.verdict === "uncertain"
  );
  if (critical.length === 0) {
    const elsewhere = routed.filter((entry) => entry.verdict === "uncertain").length;
    return {
      outcome: "auto",
      reason:
        elsewhere === 0
          ? "Every question landed outside the band."
          : `${elsewhere} question${elsewhere === 1 ? " is" : "s are"} uncertain, but none of the critical ones.`,
    };
  }
  return {
    outcome: "review",
    reason:
      critical.length === 1
        ? `${critical[0].key} is uncertain.`
        : `${critical.length} critical questions are uncertain.`,
  };
}
```

- [ ] **Step 7: Write the failing test for it**

`src/lib/claimVerdict.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CRITICAL_KEYS, claimVerdict } from "./routing";
import type { RoutedQuestion } from "./routing";

const entry = (key: string, verdict: RoutedQuestion["verdict"]): RoutedQuestion => ({
  key,
  probability: verdict === "uncertain" ? 0.5 : verdict === "yes" ? 0.9 : 0.1,
  verdict,
});

describe("claimVerdict", () => {
  it("actions a claim where nothing is uncertain", () => {
    const verdict = claimVerdict([entry("covered", "yes"), entry("fraudIndicators", "no")]);
    expect(verdict.outcome).toBe("auto");
    expect(verdict.reason).toMatch(/outside the band/);
  });

  it("escalates when a critical question is uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("lineItemsAddUp", "yes")]).outcome
    ).toBe("review");
  });

  it("names the one critical question that is uncertain", () => {
    expect(claimVerdict([entry("fraudIndicators", "uncertain")]).reason).toBe(
      "fraudIndicators is uncertain."
    );
  });

  it("counts them when several critical questions are uncertain", () => {
    expect(
      claimVerdict([entry("covered", "uncertain"), entry("manualReview", "uncertain")]).reason
    ).toBe("2 critical questions are uncertain.");
  });

  it("still actions a claim when only non-critical questions are uncertain — the point of the rule", () => {
    const verdict = claimVerdict([
      entry("covered", "yes"),
      entry("lineItemsAddUp", "uncertain"),
      entry("subrogation", "uncertain"),
    ]);
    expect(verdict.outcome).toBe("auto");
    expect(verdict.reason).toBe("2 questions are uncertain, but none of the critical ones.");
  });

  it("uses the singular for one non-critical uncertainty", () => {
    expect(
      claimVerdict([entry("covered", "yes"), entry("subrogation", "uncertain")]).reason
    ).toBe("1 question is uncertain, but none of the critical ones.");
  });

  it("actions an empty list rather than throwing", () => {
    expect(claimVerdict([]).outcome).toBe("auto");
  });

  it("keeps every critical key among the card's fourteen question keys", async () => {
    const { default: definition } = await import("../cookbooks/consistencyNoul");
    for (const key of CRITICAL_KEYS) {
      expect(Object.keys(definition.questions)).toContain(key);
    }
  });
});
```

Note: the last test imports the cookbook definition from `src/cookbooks/consistencyNoul.ts`,
which Task 4 creates. **Task 4 is executed before Task 3** so that file already exists — write
the test normally, with no skip. (Task 4 has no dependency on this file in return, so the order
is safe in one direction only.)

- [ ] **Step 8: Run the tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add the claim-level verdict rule"
```

---

### Task 4: The cookbook catalog and the one built card's definition

**Files:**
- Create: `src/cookbooks/types.ts`, `src/cookbooks/catalog.ts`, `src/cookbooks/consistencyNoul.ts`, `src/cookbooks/index.ts`
- Test: `src/cookbooks/catalog.test.ts`

**Interfaces:**
- Consumes: `Question` from `src/engine/types.ts`.
- Produces:
  - `type CookbookCategory = "Self-consistency" | "Batching" | "How-to" | "Extraction" | "Classification"`
  - `type CookbookEntry = { id: string; title: string; slug: string; category: CookbookCategory; description: string; status: "built" | "planned" }`
  - `const CATALOG: readonly CookbookEntry[]` — all 18
  - `const CATEGORIES: readonly CookbookCategory[]` — the five, in docs order
  - `function docsUrl(entry: CookbookEntry): string`
  - `function builtCookbooks(): CookbookEntry[]`
  - `type CookbookDefinition = { id: string; questions: Record<string, Question>; labels: Record<string, string>; samples: Sample[]; code: string }`
  - `type Sample = { id: string; label: string; meta: string; text: string }`
  - `const consistencyNoul: CookbookDefinition`

- [ ] **Step 1: Write the failing test**

`src/cookbooks/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CATALOG, CATEGORIES, builtCookbooks, docsUrl } from "./catalog";
import consistencyNoul from "./consistencyNoul";

describe("CATALOG", () => {
  it("lists all eighteen documented cookbooks", () => {
    expect(CATALOG).toHaveLength(18);
  });

  it("has a unique id and slug for each", () => {
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(18);
    expect(new Set(CATALOG.map((entry) => entry.slug)).size).toBe(18);
  });

  it("puts every entry in one of the five documented categories", () => {
    for (const entry of CATALOG) {
      expect(CATEGORIES).toContain(entry.category);
    }
  });

  it("keeps the categories in the order the docs use", () => {
    expect(CATEGORIES).toEqual([
      "Self-consistency",
      "Batching",
      "How-to",
      "Extraction",
      "Classification",
    ]);
  });

  it("marks exactly one cookbook built in Phase 1", () => {
    expect(builtCookbooks().map((entry) => entry.id)).toEqual([
      "consistency-noul",
    ]);
  });

  it("links each entry to its cookbook page", () => {
    expect(docsUrl(CATALOG[0])).toBe(
      "https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook"
    );
  });
});

describe("consistencyNoul", () => {
  it("matches a catalog entry", () => {
    expect(CATALOG.some((entry) => entry.id === consistencyNoul.id)).toBe(true);
  });

  it("asks the cookbook's fourteen noul questions", () => {
    const keys = Object.keys(consistencyNoul.questions);
    expect(keys).toHaveLength(14);
    for (const question of Object.values(consistencyNoul.questions)) {
      expect(question.type).toBe("noul");
    }
  });

  it("gives every question a short label for the answer rows", () => {
    for (const key of Object.keys(consistencyNoul.questions)) {
      expect(consistencyNoul.labels[key]).toBeTruthy();
    }
  });

  it("ships sample states to start from", () => {
    expect(consistencyNoul.samples.length).toBeGreaterThanOrEqual(3);
    for (const sample of consistencyNoul.samples) {
      expect(sample.text.length).toBeGreaterThan(80);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/cookbooks`
Expected: FAIL — `Failed to resolve import "./catalog"`.

- [ ] **Step 3: Write the types**

`src/cookbooks/types.ts`:

```ts
import type { Question } from "../engine/types";

/** The five section headings on docs.typesafe.ai/cookbooks, in their order there. */
export type CookbookCategory =
  | "Self-consistency"
  | "Batching"
  | "How-to"
  | "Extraction"
  | "Classification";

export type CookbookEntry = {
  id: string;
  title: string;
  /** Path segment under docs.typesafe.ai/cookbooks/. */
  slug: string;
  category: CookbookCategory;
  description: string;
  /** "built" is clickable; "planned" shows in the sidebar but is not. */
  status: "built" | "planned";
};

export type Sample = {
  id: string;
  label: string;
  meta: string;
  text: string;
};

/** The runnable half of a cookbook: what gets asked, what to try it on, and the
 *  code a reader would write to do the same thing themselves. */
export type CookbookDefinition = {
  /** Matches a CookbookEntry.id. */
  id: string;
  questions: Record<string, Question>;
  /** Short row labels, keyed like `questions`. */
  labels: Record<string, string>;
  samples: Sample[];
  code: string;
};
```

- [ ] **Step 4: Write the catalog**

`src/cookbooks/catalog.ts`:

```ts
import type { CookbookCategory, CookbookEntry } from "./types";

export const CATEGORIES: readonly CookbookCategory[] = [
  "Self-consistency",
  "Batching",
  "How-to",
  "Extraction",
  "Classification",
];

/** Every cookbook TypeSafe documents, in the order the index page lists them.
 *  Titles and descriptions follow the docs so someone arriving from a cookbook
 *  page recognises the entry. */
export const CATALOG: readonly CookbookEntry[] = [
  {
    id: "consistency-noul",
    title: "Self-consistency: nouls",
    slug: "consistency_noul_cookbook",
    category: "Self-consistency",
    description:
      "Route uncertain probabilities to human review while keeping the underlying noul values visible.",
    status: "built",
  },
  {
    id: "consistency-choice",
    title: "Self-consistency: choices",
    slug: "consistency_choice_cookbook",
    category: "Self-consistency",
    description:
      "Add uncertain outcomes to moderation decisions and compare label agreement with automatic action rates.",
    status: "planned",
  },
  {
    id: "parallel-questions",
    title: "Parallel questions",
    slug: "parallel_questions",
    category: "Batching",
    description: "Ask many questions about one state in a single request.",
    status: "planned",
  },
  {
    id: "rerank",
    title: "Re-ranking",
    slug: "rerank_typesafe",
    category: "How-to",
    description: "Score a retrieval shortlist and reorder it.",
    status: "planned",
  },
  {
    id: "semantic-find",
    title: "Line-by-line search",
    slug: "semantic_find",
    category: "How-to",
    description:
      "Score every line of a document against a query in one request, with confidence checks.",
    status: "planned",
  },
  {
    id: "autoformat",
    title: "Structure recovery",
    slug: "autoformat",
    category: "How-to",
    description:
      "Reconstruct Markdown from plain text by stitching lines and classifying blocks.",
    status: "planned",
  },
  {
    id: "function-calling",
    title: "Function calling",
    slug: "function_calling",
    category: "How-to",
    description:
      "Map a natural-language request to a typed function with confidence-aware questions.",
    status: "planned",
  },
  {
    id: "skill-suggestion",
    title: "Skill suggestion",
    slug: "skill_suggestion",
    category: "How-to",
    description: "Pick one skill from a large set by ranking and then verifying.",
    status: "planned",
  },
  {
    id: "entity-alignment",
    title: "Knowledge graph entity alignment",
    slug: "entity_alignment",
    category: "How-to",
    description:
      "Match catalog pairs with score questions that reveal which fields disagree.",
    status: "planned",
  },
  {
    id: "classifying-rag-passages",
    title: "Classifying RAG passages",
    slug: "classifying_rag_passages",
    category: "How-to",
    description:
      "Score retrieved passages to filter which ones reach the answering model.",
    status: "planned",
  },
  {
    id: "citation-check",
    title: "Double-checking citations",
    slug: "citation_check",
    category: "How-to",
    description: "Verify that a quote's context supports the claim it is cited for.",
    status: "planned",
  },
  {
    id: "llm-guardrails",
    title: "Guardrails for LLMs",
    slug: "llm_guardrails",
    category: "How-to",
    description:
      "Screen input and output by thresholding hazard probabilities and severity levels.",
    status: "planned",
  },
  {
    id: "sde-cascade",
    title: "SDE cascade",
    slug: "sde_cascade",
    category: "Extraction",
    description: "Extract, verify, then reason — a two-stage cascade.",
    status: "planned",
  },
  {
    id: "date-extraction",
    title: "Date extraction",
    slug: "date_extraction_cookbook",
    category: "Extraction",
    description:
      "Extract date parts, resolve them in code, and route low-confidence cases to review.",
    status: "planned",
  },
  {
    id: "pre-parsed-value-extraction",
    title: "Pre-parsed value extraction",
    slug: "pre_parsed_value_extraction_cookbook",
    category: "Extraction",
    description:
      "Filter regex candidates down to the right verbatim value.",
    status: "planned",
  },
  {
    id: "hierarchical-classification",
    title: "Hierarchical classification",
    slug: "hierarchical_classification",
    category: "Classification",
    description:
      "Classify through a deep hierarchy with a parallel beam search over probabilities.",
    status: "planned",
  },
  {
    id: "autoresearch-feature-discovery",
    title: "Autoresearch feature discovery",
    slug: "autoresearch_feature_discovery",
    category: "Classification",
    description:
      "Propose questions iteratively to improve a supervised model's features.",
    status: "planned",
  },
  {
    id: "classification-using-confidence",
    title: "Classification using confidence",
    slug: "classification_using_confidence",
    category: "Classification",
    description:
      "Classify into a large label set and read confidence to decide how specific to be.",
    status: "planned",
  },
];

export function docsUrl(entry: CookbookEntry): string {
  return `https://docs.typesafe.ai/cookbooks/${entry.slug}`;
}

export function builtCookbooks(): CookbookEntry[] {
  return CATALOG.filter((entry) => entry.status === "built");
}

export function entriesInCategory(category: CookbookCategory): CookbookEntry[] {
  return CATALOG.filter((entry) => entry.category === category);
}
```

- [ ] **Step 5: Write the card's definition**

`src/cookbooks/consistencyNoul.ts`. The fourteen statements are the cookbook's own; keep them verbatim.

```ts
import { noul } from "open-jev";
import type { CookbookDefinition } from "./types";

const consistencyNoul: CookbookDefinition = {
  id: "consistency-noul",
  questions: {
    covered: noul("Is the loss covered under the policy's collision coverage?"),
    exclusionApplies: noul("Does a policy exclusion apply to this loss?"),
    onTrack: noul(
      "Did the collision happen while the vehicle was being driven on the racetrack itself?"
    ),
    deductible: noul(
      "Would the $500 deductible be correctly applied before any payout?"
    ),
    documentation: noul(
      "Is the attached documentation sufficient to adjudicate the claim as-is?"
    ),
    withinLimit: noul("Is the amount claimed within the per-incident coverage limit?"),
    inPeriod: noul("Did the loss occur within the policy's active coverage period?"),
    reportedInWindow: noul(
      "Was the loss reported within the policy's required window?"
    ),
    rentalEligible: noul(
      "Is the rental-car cost eligible for reimbursement under this policy?"
    ),
    fraudIndicators: noul("Are there indicators that warrant a fraud review?"),
    autoApproved: noul(
      "Was payment approved by automated triage without a human adjuster's review?"
    ),
    manualReview: noul(
      "Should this claim be routed for manual/supervisor review before payout?"
    ),
    lineItemsAddUp: noul(
      "Do the claimed line-item costs add up to the total amount claimed?"
    ),
    subrogation: noul(
      "Is there a potentially at-fault third party the insurer could pursue for subrogation recovery?"
    ),
  },
  labels: {
    covered: "Covered",
    exclusionApplies: "Exclusion applies",
    onTrack: "On the track itself",
    deductible: "Deductible applied",
    documentation: "Documentation sufficient",
    withinLimit: "Within limit",
    inPeriod: "In coverage period",
    reportedInWindow: "Reported in time",
    rentalEligible: "Rental eligible",
    fraudIndicators: "Fraud indicators",
    autoApproved: "Auto-approved",
    manualReview: "Needs manual review",
    lineItemsAddUp: "Line items add up",
    subrogation: "Subrogation possible",
  },
  samples: [
    {
      id: "track-day",
      label: "Track-day parking lot",
      meta: "the cookbook's own scenario",
      text: `Claim #AC-88213. Policy P-4471, collision coverage active 2026-01-01 to 2026-12-31, $500 deductible, $25,000 per-incident limit.

Loss date 2026-08-14, reported 2026-08-29. The insured attended a track day at Sonoma Raceway. The collision occurred in the venue's paved parking lot, not on the circuit: a third-party vehicle reversed into the insured's rear bumper while both were leaving. The third party admitted fault at the scene but no police report was filed.

Claimed: bumper and rear quarter panel $4,180; paint $1,240; rental car for 9 days $612; track entry fee $395. Total claimed $6,427.

Notes: the policy excludes "competitive driving, racing, speed trials or track use". Rental reimbursement is available only on the Premium endorsement, which this policy does not carry. Photographs were supplied; no repair estimate from an approved shop is attached. Automated triage marked this claim approved for payment on 2026-08-30 without adjuster review.`,
    },
    {
      id: "clean-rear-end",
      label: "Straightforward rear-end",
      meta: "everything lines up",
      text: `Claim #AC-90114. Policy P-5520, collision coverage active 2026-03-01 to 2027-02-28, $500 deductible, $25,000 per-incident limit.

Loss date 2026-09-02, reported 2026-09-02. The insured was stopped at a red light on Market Street when a delivery van struck the rear of the vehicle. Police report #SF-2026-44118 filed at the scene; the van driver was cited for following too closely and their insurer has acknowledged liability.

Claimed: rear bumper assembly $1,850; trunk lid $940; labour $720; paint $560. Total claimed $4,070.

An approved-shop estimate matching the claimed total is attached, along with the police report and eleven photographs. No rental was taken. Assigned to adjuster R. Okafor, who inspected the vehicle on 2026-09-04.`,
    },
    {
      id: "thin-file",
      label: "Thin file, late report",
      meta: "documentation is missing",
      text: `Claim #AC-87002. Policy P-3318, collision coverage active 2025-11-15 to 2026-11-14, $500 deductible, $10,000 per-incident limit.

Loss date "sometime in June", reported 2026-09-10. The insured states the vehicle was damaged in a parking garage and that they only noticed the damage later. The policy requires loss to be reported within 30 days.

Claimed: "front end damage, approx $9,800". No itemisation, no estimate, no photographs, no incident location beyond "a garage downtown". The insured has filed three claims in the past fourteen months, two of which were withdrawn after an estimate was requested.

No third party identified. No police report. Automated triage flagged the claim and did not approve payment.`,
    },
  ],
  code: `import { OpenJev, noul } from "open-jev";

const jev = await OpenJev.load({ model: "kev-0.6b" });

// All fourteen questions travel in one request: the state is read once.
const answers = await jev.decide(claim, {
  covered: noul("Is the loss covered under the policy's collision coverage?"),
  exclusionApplies: noul("Does a policy exclusion apply to this loss?"),
  fraudIndicators: noul("Are there indicators that warrant a fraud review?"),
  // ... eleven more
});

const LOW = 0.3;
const HIGH = 0.7;

function decide(probability) {
  if (probability < LOW) return "no";
  if (probability > HIGH) return "yes";
  return "uncertain"; // a person looks at this one
}

const verdicts = Object.fromEntries(
  Object.entries(answers).map(([key, answer]) => [key, decide(answer.probability)])
);`,
};

export default consistencyNoul;
```

- [ ] **Step 6: Write the registry**

`src/cookbooks/index.ts`:

```ts
import { CATALOG } from "./catalog";
import consistencyNoul from "./consistencyNoul";
import type { CookbookDefinition, CookbookEntry } from "./types";

const DEFINITIONS: Record<string, CookbookDefinition> = {
  [consistencyNoul.id]: consistencyNoul,
};

export function getEntry(id: string): CookbookEntry {
  const entry = CATALOG.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown cookbook: ${id}`);
  return entry;
}

export function getDefinition(id: string): CookbookDefinition {
  const definition = DEFINITIONS[id];
  if (!definition) throw new Error(`Cookbook ${id} has no definition yet`);
  return definition;
}

export { CATALOG, CATEGORIES, docsUrl, builtCookbooks, entriesInCategory } from "./catalog";
export type { CookbookCategory, CookbookDefinition, CookbookEntry, Sample } from "./types";
```

- [ ] **Step 7: Run the tests**

Run: `pnpm test`
Expected: PASS — 10 new tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add the cookbook catalog and the self-consistency noul definition"
```

---

### Task 5: The local engine, behind a worker

**Why a worker:** WebGPU inference on the main thread freezes the page while a decision runs — the slider would stick mid-drag. The protocol is a separate, pure module so it can be tested without a worker or a model.

**Files:**
- Create: `src/engine/protocol.ts`, `src/engine/worker.ts`, `src/engine/localEngine.ts`, `src/engine/index.ts`, `scripts/smoke.ts`
- Test: `src/engine/protocol.test.ts`

**Interfaces:**
- Consumes: `Engine`, `EngineRuntime` from `src/engine/types.ts`; `OpenJev`, `LoadProgress`, `OpenJevInfo` from `open-jev`.
- Produces:
  - `type WorkerRequest = { id: number } & ({ kind: "load"; model: string } | { kind: "decide"; state: string; questions: Record<string, Question> } | { kind: "countTokens"; state: string } | { kind: "dispose" })`
  - `type WorkerResponse = { id: number } & ({ kind: "ready"; runtime: EngineRuntime } | { kind: "progress"; progress: LoadProgress } | { kind: "answers"; answers: Record<string, Answer> } | { kind: "tokens"; tokens: number } | { kind: "done" } | { kind: "error"; message: string })`
  - `function nextRequestId(): number`
  - `function describeError(caught: unknown): string`
  - `async function createLocalEngine(model: string, onProgress: (p: LoadProgress) => void): Promise<Engine>`
  - `async function inspectModel(model: string): Promise<OpenJevInfo>`
  - `function isWebGpuAvailable(): boolean`

- [ ] **Step 1: Write the failing test**

`src/engine/protocol.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeError, nextRequestId } from "./protocol";

describe("nextRequestId", () => {
  it("never repeats, so a late reply cannot be matched to a new request", () => {
    const ids = [nextRequestId(), nextRequestId(), nextRequestId()];
    expect(new Set(ids).size).toBe(3);
  });
  it("increases", () => {
    const first = nextRequestId();
    expect(nextRequestId()).toBeGreaterThan(first);
  });
});

describe("describeError", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("out of memory"))).toBe("out of memory");
  });
  it("stringifies anything else, because a worker can reject with a non-Error", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(undefined)).toBe("undefined");
  });
  it("never returns an empty message, so the UI always has something to show", () => {
    expect(describeError(new Error(""))).toBe("The model failed without a message.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/engine/protocol.test.ts`
Expected: FAIL — `Failed to resolve import "./protocol"`.

- [ ] **Step 3: Write the protocol**

`src/engine/protocol.ts`:

```ts
import type { LoadProgress } from "open-jev";
import type { Answer, EngineRuntime, Question } from "./types";

export type WorkerRequest = { id: number } & (
  | { kind: "load"; model: string }
  | { kind: "decide"; state: string; questions: Record<string, Question> }
  | { kind: "countTokens"; state: string }
  | { kind: "dispose" }
);

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
```

- [ ] **Step 4: Write the worker**

`src/engine/worker.ts`:

```ts
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
```

- [ ] **Step 5: Write the client**

`src/engine/localEngine.ts`:

```ts
import { OpenJev } from "open-jev";
import type { LoadProgress, OpenJevInfo } from "open-jev";
import { nextRequestId } from "./protocol";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import type { Answer, Engine, EngineRuntime, Question } from "./types";

type Pending = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: LoadProgress) => void;
};

/** Talks to worker.ts. One request is in flight per id; `open-jev` serialises
 *  decisions internally, so several decide() calls may be outstanding. */
class LocalEngine implements Engine {
  private tokenCache = new Map<string, number>();
  /** Filled in by `create` once the worker reports what it actually loaded:
   *  the device and dtype are resolved from "auto" inside the worker. */
  runtime: EngineRuntime;

  private constructor(
    model: string,
    private readonly worker: Worker,
    private readonly pending: Map<number, Pending>
  ) {
    this.runtime = { engine: "local", model, device: "unknown", dtype: "unknown" };
  }

  static async create(
    model: string,
    onProgress: (progress: LoadProgress) => void
  ): Promise<Engine> {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const pending = new Map<number, Pending>();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return; // a reply to a request nobody is waiting for
      if (response.kind === "progress") {
        entry.onProgress?.(response.progress);
        return; // progress is not the final reply; keep waiting
      }
      pending.delete(response.id);
      if (response.kind === "error") entry.reject(new Error(response.message));
      else entry.resolve(response);
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || "The model worker crashed.");
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    };

    const engine = new LocalEngine(model, worker, pending);
    const ready = await engine.send({ kind: "load", model }, onProgress);
    if (ready.kind !== "ready") throw new Error("The model failed to load.");
    engine.runtime = ready.runtime;
    return engine;
  }

  private send(
    request: Omit<WorkerRequest, "id">,
    onProgress?: (progress: LoadProgress) => void
  ): Promise<WorkerResponse> {
    const id = nextRequestId();
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ ...request, id } as WorkerRequest);
    });
  }

  async decide(
    state: string,
    questions: Record<string, Question>
  ): Promise<Record<string, Answer>> {
    const response = await this.send({ kind: "decide", state, questions });
    if (response.kind !== "answers") throw new Error("The decision failed.");
    return response.answers;
  }

  /** Synchronous by interface, but the tokenizer lives in the worker. The cache is
   *  filled by `primeTokenCount`; an unseen string falls back to a word count so a
   *  freshly typed state still shows a number. */
  countTokens(state: string): number {
    return this.tokenCache.get(state) ?? state.split(/\s+/).filter(Boolean).length;
  }

  async primeTokenCount(state: string): Promise<number> {
    const response = await this.send({ kind: "countTokens", state });
    if (response.kind !== "tokens") throw new Error("Token counting failed.");
    this.tokenCache.set(state, response.tokens);
    return response.tokens;
  }

  async dispose(): Promise<void> {
    try {
      await this.send({ kind: "dispose" });
    } finally {
      this.worker.terminate();
      this.pending.clear();
    }
  }
}

export async function createLocalEngine(
  model: string,
  onProgress: (progress: LoadProgress) => void
): Promise<Engine> {
  return LocalEngine.create(model, onProgress);
}

/** Size and cache status without loading anything, so the first-visit disclosure
 *  is measured rather than hard-coded. */
export async function inspectModel(model: string): Promise<OpenJevInfo> {
  return OpenJev.info({ model });
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
```

`src/engine/index.ts`:

```ts
export { createLocalEngine, inspectModel, isWebGpuAvailable } from "./localEngine";
export { FakeEngine } from "./fake";
export type {
  Answer,
  ChoiceAnswer,
  Engine,
  EngineId,
  EngineRuntime,
  NoulAnswer,
  Question,
  ScoreAnswer,
} from "./types";
```

- [ ] **Step 6: Write the opt-in real-model smoke check**

This downloads about 340 MB, so it is never part of `pnpm test` or CI. It proves the questions and the package actually work together before any UI is trusted.

`scripts/smoke.ts`:

```ts
/**
 * Real-model check, run by hand: `pnpm smoke`.
 * Downloads kev-0.6b (~340 MB) and runs the card's fourteen questions on CPU.
 * Never part of `pnpm test` — CI must not download weights.
 */
import { OpenJev } from "open-jev";
import { expect, it } from "vitest";
import definition from "../src/cookbooks/consistencyNoul";

it("answers the cookbook's fourteen questions on a real claim", async () => {
  const jev = await OpenJev.load({ model: "kev-0.6b", device: "cpu" });
  const lines: string[] = [`runtime: ${JSON.stringify(jev.runtime)}`];

  for (const sample of definition.samples) {
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
```

- [ ] **Step 7: Run the tests and the build**

Run: `pnpm test && pnpm build`
Expected: PASS, and `dist/` contains a separate worker chunk.

- [ ] **Step 8: Run the smoke check once, by hand**

Run: `pnpm smoke`
Expected: a download, then fourteen bars and a timing line. Read them: probabilities should not all be identical. If they are, the questions are not reaching the model and no UI work should proceed until that is understood.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: run open-jev in a worker behind the Engine interface"
```

---

### Task 6: The load gate

**Files:**
- Create: `src/components/load/LoadGate.tsx`, `src/components/load/ModelChoice.tsx`
- Test: `src/components/load/LoadGate.test.tsx`

**Interfaces:**
- Consumes: `inspectModel`, `isWebGpuAvailable`, `createLocalEngine` from `src/engine`; `formatBytes` from `src/lib/format`.
- Produces:
  - `type ModelOption = { alias: string; name: string; note: string; approximateBytes: number }`
  - `const MODEL_OPTIONS: readonly ModelOption[]` — `kev-0.6b`, `kev-4b`, `open-jev`
  - `function LoadGate(props: { onReady: (engine: Engine) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

`src/components/load/LoadGate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FakeEngine } from "../../engine/fake";
import LoadGate, { MODEL_OPTIONS } from "./LoadGate";

vi.mock("../../engine", async () => ({
  createLocalEngine: vi.fn(async () => new (await import("../../engine/fake")).FakeEngine()),
  inspectModel: vi.fn(async () => ({
    model: "onnx-community/kev-0.6b-ONNX",
    family: "kev",
    device: "webgpu",
    dtype: "q4f16",
    isCached: false,
    downloadSize: 340_000_000,
    files: ["model.onnx"],
  })),
  isWebGpuAvailable: vi.fn(() => true),
}));

describe("LoadGate", () => {
  it("offers the three models with 0.6b first", () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(MODEL_OPTIONS[0].alias).toBe("kev-0.6b");
    expect(screen.getByRole("radio", { name: /Kev 0.6B/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Kev 4B/ })).toBeInTheDocument();
  });

  it("states the download size before anything is fetched", async () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(await screen.findByText(/340 MB/)).toBeInTheDocument();
  });

  it("says the text never leaves the tab", () => {
    render(<LoadGate onReady={vi.fn()} />);
    expect(screen.getByText(/never leaves this tab/i)).toBeInTheDocument();
  });

  it("hands the engine to its parent once loading finishes", async () => {
    const onReady = vi.fn();
    render(<LoadGate onReady={onReady} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onReady.mock.calls[0][0]).toBeInstanceOf(FakeEngine);
  });

  it("shows the failure instead of a blank screen when loading throws", async () => {
    const engineModule = await import("../../engine");
    vi.mocked(engineModule.createLocalEngine).mockRejectedValueOnce(
      new Error("WebGPU device lost")
    );
    render(<LoadGate onReady={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(await screen.findByText(/WebGPU device lost/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/load`
Expected: FAIL — `Failed to resolve import "./LoadGate"`.

- [ ] **Step 3: Write the model choice**

`src/components/load/ModelChoice.tsx`:

```tsx
import type { ModelOption } from "./LoadGate";

export default function ModelChoice({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly ModelOption[];
  value: string;
  onChange: (alias: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="sr-only">Model</legend>
      {options.map((option) => (
        <label
          key={option.alias}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
            value === option.alias ? "border-ink bg-white" : "border-line"
          }`}
        >
          <input
            type="radio"
            name="model"
            className="mt-1"
            checked={value === option.alias}
            onChange={() => onChange(option.alias)}
          />
          <span>
            <span className="block font-semibold">{option.name}</span>
            <span className="block text-sm text-stone">{option.note}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
```

- [ ] **Step 4: Write the gate**

`src/components/load/LoadGate.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { LoadProgress, OpenJevInfo } from "open-jev";
import { createLocalEngine, inspectModel, isWebGpuAvailable } from "../../engine";
import type { Engine } from "../../engine";
import { formatBytes, formatPercent } from "../../lib/format";
import ModelChoice from "./ModelChoice";

export type ModelOption = {
  alias: string;
  name: string;
  note: string;
  approximateBytes: number;
};

/** 0.6B first: it is the one that has a card running within a minute. */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    alias: "kev-0.6b",
    name: "Kev 0.6B",
    note: "Small and quick. The fastest way to see a card run.",
    approximateBytes: 340_000_000,
  },
  {
    alias: "kev-4b",
    name: "Kev 4B",
    note: "A larger download for a machine that can hold it.",
    approximateBytes: 2_300_000_000,
  },
  {
    alias: "open-jev",
    name: "open-jev",
    note: "An encoder with a short context. Suited to brief states.",
    approximateBytes: 350_000_000,
  },
];

export default function LoadGate({ onReady }: { onReady: (engine: Engine) => void }) {
  const [alias, setAlias] = useState(MODEL_OPTIONS[0].alias);
  const [info, setInfo] = useState<OpenJevInfo | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webgpu = isWebGpuAvailable();

  useEffect(() => {
    let current = true;
    setInfo(null);
    inspectModel(alias)
      .then((result) => {
        if (current) setInfo(result);
      })
      .catch(() => {
        if (current) setInfo(null); // the size line is omitted rather than wrong
      });
    return () => {
      current = false;
    };
  }, [alias]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      onReady(await createLocalEngine(alias, setProgress));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Cookbook in the browser
        </h1>
        <p className="mt-2 text-stone">
          TypeSafe&rsquo;s cookbooks, runnable. The model downloads into this tab and
          runs on your machine: what you paste never leaves this tab, and there is no
          key and no account.
        </p>
      </header>

      <ModelChoice
        options={MODEL_OPTIONS}
        value={alias}
        onChange={setAlias}
        disabled={loading}
      />

      <p className="text-sm text-stone">
        {info
          ? info.isCached
            ? `Already downloaded — loads from this browser's cache. Runs on ${info.device}.`
            : `${formatBytes(info.downloadSize)} to download, once. Runs on ${info.device}.`
          : "Checking the download size…"}
      </p>

      {!webgpu && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          This browser has no WebGPU, so the model runs on the CPU instead. It will
          work, but expect each decision to take a while.
        </p>
      )}

      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading
          ? progress
            ? `Loading ${formatPercent(progress.progress)}`
            : "Loading…"
          : "Load the model"}
      </button>

      {error && (
        <p className="rounded-xl bg-rose-50 p-3 text-sm">
          <span className="font-semibold">The model did not load. </span>
          {error}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS — 5 new tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the model load gate with a measured size disclosure"
```

---

### Task 7: The card

**Files:**
- Create: `src/components/panes/StatePane.tsx`, `src/components/panes/QuestionsPane.tsx`, `src/components/panes/AnswersPane.tsx`, `src/components/panes/SamplesRail.tsx`, `src/components/cards/ConsistencyNoulCard.tsx`
- Test: `src/components/cards/ConsistencyNoulCard.test.tsx`

**Interfaces:**
- Consumes: `Engine` from `src/engine`; `getDefinition`, `getEntry`, `docsUrl` from `src/cookbooks`; `DEFAULT_BAND`, `clampBand`, `routeAll`, `bandSummary`, `claimVerdict` from `src/lib/routing`; `formatPercent`, `formatDuration` from `src/lib/format`.
- Produces: `function ConsistencyNoulCard(props: { engine: Engine }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

`src/components/cards/ConsistencyNoulCard.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FakeEngine } from "../../engine/fake";
import ConsistencyNoulCard from "./ConsistencyNoulCard";

/** Three questions straddling the default band, so a widening slider must move rows. */
const pinned = new FakeEngine({
  covered: 0.95,
  exclusionApplies: 0.5,
  fraudIndicators: 0.02,
});

describe("ConsistencyNoulCard", () => {
  it("starts with a sample state in an editable box", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i }) as HTMLTextAreaElement;
    expect(state.value).toContain("Claim #AC-88213");
  });

  it("shows the fourteen questions before anything is run", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    expect(screen.getByText(/Fraud indicators/)).toBeInTheDocument();
    expect(screen.getAllByTestId("question-row")).toHaveLength(14);
  });

  it("renders a probability per question after running", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(within(row).getByText("95%")).toBeInTheDocument();
  });

  it("puts a probability outside the band on the automatic side", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");
  });

  it("escalates a probability inside the band", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-exclusionApplies");
    expect(row).toHaveAttribute("data-verdict", "uncertain");
  });

  it("moves a row to review when the band widens, without re-running the model", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    const row = await screen.findByTestId("answer-covered");
    expect(row).toHaveAttribute("data-verdict", "yes");

    // A range input takes a change event; it cannot be cleared and typed into.
    fireEvent.change(screen.getByRole("slider", { name: /upper bound/i }), {
      target: { value: "0.99" },
    });

    expect(await screen.findByTestId("answer-covered")).toHaveAttribute(
      "data-verdict",
      "uncertain"
    );
  });

  it("lets a visitor replace the state with their own text", async () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    const state = screen.getByRole("textbox", { name: /state/i });
    await userEvent.clear(state);
    await userEvent.type(state, "my own claim text");
    expect(state).toHaveValue("my own claim text");
  });

  it("links to the cookbook it comes from", () => {
    render(<ConsistencyNoulCard engine={pinned} />);
    expect(screen.getByRole("link", { name: /cookbook/i })).toHaveAttribute(
      "href",
      "https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook"
    );
  });

  it("reports a failed decision rather than showing nothing", async () => {
    const broken = {
      runtime: { engine: "local" as const, model: "x", device: "x", dtype: "x" },
      decide: async () => {
        throw new Error("The model ran out of memory.");
      },
      countTokens: () => 10,
      // no primeTokenCount: the card must work with an engine that lacks it
      dispose: async () => {},
    };
    render(<ConsistencyNoulCard engine={broken} />);
    await userEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(await screen.findByText(/ran out of memory/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/components/cards`
Expected: FAIL — `Failed to resolve import "./ConsistencyNoulCard"`.

- [ ] **Step 3: Write the panes**

`src/components/panes/StatePane.tsx`:

```tsx
export default function StatePane({
  value,
  onChange,
  tokens,
  exact,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  tokens: number;
  /** Whether `tokens` came from the real tokenizer. An unprimed estimate
   *  undercounts by roughly 1.8x to 2.2x, so it is marked rather than shown
   *  as though it were the true figure. */
  exact: boolean;
  disabled: boolean;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor="state" className="font-semibold">
          State
        </label>
        <span className="text-sm text-stone">
          {exact ? "" : "≈"}
          {tokens} tokens
        </span>
      </div>
      <textarea
        id="state"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        className="w-full resize-y rounded-xl border border-line p-3 font-mono text-sm"
      />
    </section>
  );
}
```

`src/components/panes/QuestionsPane.tsx`:

```tsx
import type { Question } from "../../engine";

export default function QuestionsPane({
  questions,
  labels,
}: {
  questions: Record<string, Question>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(questions);
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="mb-2 font-semibold">
        Questions{" "}
        <span className="font-normal text-stone">
          — {entries.length}, all in one request
        </span>
      </h2>
      <ul className="flex flex-col gap-1">
        {entries.map(([key, question]) => (
          <li
            key={key}
            data-testid="question-row"
            className="flex gap-2 text-sm text-stone"
          >
            <span className="w-44 shrink-0 font-medium text-ink">{labels[key]}</span>
            <span>{question.instructions}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/components/panes/AnswersPane.tsx`:

```tsx
import { formatPercent } from "../../lib/format";
import type { Band, RoutedQuestion } from "../../lib/routing";

const VERDICT_STYLE: Record<string, string> = {
  yes: "bg-auto",
  no: "bg-stone",
  uncertain: "bg-review",
};

export default function AnswersPane({
  routed,
  labels,
  band,
}: {
  routed: RoutedQuestion[];
  labels: Record<string, string>;
  band: Band;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <h2 className="mb-3 font-semibold">Answers</h2>
      <ul className="flex flex-col gap-2">
        {routed.map((entry) => (
          <li
            key={entry.key}
            data-testid={`answer-${entry.key}`}
            data-verdict={entry.verdict}
            className="grid grid-cols-[11rem_1fr_3rem_5rem] items-center gap-3 text-sm"
          >
            <span className="font-medium">{labels[entry.key]}</span>
            <span className="relative h-2 rounded-full bg-line">
              {/* The band, drawn behind the bar, so a row's position relative to
                  it is visible without reading the numbers. */}
              <span
                className="absolute inset-y-0 rounded-full bg-review/20"
                style={{
                  left: `${band.low * 100}%`,
                  width: `${(band.high - band.low) * 100}%`,
                }}
              />
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${VERDICT_STYLE[entry.verdict]}`}
                style={{ width: `${entry.probability * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {formatPercent(entry.probability)}
            </span>
            <span
              className={
                entry.verdict === "uncertain"
                  ? "text-review font-medium"
                  : "text-stone"
              }
            >
              {entry.verdict === "uncertain" ? "review" : entry.verdict}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/components/panes/SamplesRail.tsx`:

```tsx
import type { Sample } from "../../cookbooks";

export default function SamplesRail({
  samples,
  onPick,
  disabled,
}: {
  samples: Sample[];
  onPick: (sample: Sample) => void;
  disabled: boolean;
}) {
  return (
    <aside className="flex flex-col gap-2">
      <h2 className="font-semibold">Try it on</h2>
      {samples.map((sample) => (
        <button
          key={sample.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(sample)}
          className="rounded-xl border border-line bg-white p-3 text-left hover:border-ink disabled:opacity-60"
        >
          <span className="block font-medium">{sample.label}</span>
          <span className="block text-sm text-stone">{sample.meta}</span>
        </button>
      ))}
      <p className="mt-2 rounded-xl bg-white p-3 text-sm text-stone">
        Or replace the state with your own. It is read in this tab and goes nowhere
        else, so a real document costs nothing to try.
      </p>
    </aside>
  );
}
```

- [ ] **Step 4: Write the card**

`src/components/cards/ConsistencyNoulCard.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { docsUrl, getDefinition, getEntry } from "../../cookbooks";
import type { Engine, NoulAnswer } from "../../engine";
import { formatDuration, formatPercent } from "../../lib/format";
import {
  DEFAULT_BAND,
  bandSummary,
  claimVerdict,
  clampBand,
  routeAll,
} from "../../lib/routing";
import AnswersPane from "../panes/AnswersPane";
import QuestionsPane from "../panes/QuestionsPane";
import SamplesRail from "../panes/SamplesRail";
import StatePane from "../panes/StatePane";

const ID = "consistency-noul";

export default function ConsistencyNoulCard({ engine }: { engine: Engine }) {
  const definition = getDefinition(ID);
  const entry = getEntry(ID);

  const [state, setState] = useState(definition.samples[0].text);
  const [tokens, setTokens] = useState(() => engine.countTokens(definition.samples[0].text));
  const [tokensExact, setTokensExact] = useState(false);
  const [answers, setAnswers] = useState<Record<string, NoulAnswer> | null>(null);
  const [band, setBand] = useState(DEFAULT_BAND);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-routing is pure, so dragging the slider re-renders without touching the model.
  const routed = useMemo(
    () => (answers ? routeAll(answers, band) : []),
    [answers, band]
  );
  const summary = bandSummary(routed);
  const verdict = routed.length > 0 ? claimVerdict(routed) : null;

  // The tokenizer lives in the worker, so an exact count is only available
  // asynchronously. Show the synchronous estimate immediately, then replace it
  // once the real count arrives. Debounced so typing does not queue a request
  // per keystroke, and guarded so a slow reply for older text cannot overwrite
  // the count for newer text.
  useEffect(() => {
    setTokens(engine.countTokens(state));
    setTokensExact(false);
    if (!engine.primeTokenCount) return;
    let current = true;
    const timer = setTimeout(() => {
      engine
        .primeTokenCount?.(state)
        .then((exactCount) => {
          if (!current) return;
          setTokens(exactCount);
          setTokensExact(true);
        })
        .catch(() => {
          // An estimate already shows; a failed count is not worth surfacing.
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [engine, state]);

  const run = async () => {
    setRunning(true);
    setError(null);
    const started = performance.now();
    try {
      const result = await engine.decide(state, definition.questions);
      setElapsed(performance.now() - started);
      setAnswers(result as Record<string, NoulAnswer>);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{entry.title}</h1>
          <p className="mt-1 text-stone">
            {entry.description}{" "}
            <a
              href={docsUrl(entry)}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Read the cookbook
            </a>
            .
          </p>
        </header>

        <StatePane
          value={state}
          onChange={setState}
          tokens={tokens}
          exact={tokensExact}
          disabled={running}
        />

        <QuestionsPane
          questions={definition.questions}
          labels={definition.labels}
        />

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {running ? "Running…" : answers ? "Run again" : "Run"}
          </button>
          {elapsed !== null && !running && (
            <span className="text-sm text-stone">
              14 questions in one request, {formatDuration(elapsed)}
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm">
            <span className="font-semibold">The decision failed. </span>
            {error}
          </p>
        )}

        {answers && (
          <>
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="font-semibold">Uncertainty band</h2>
              <p className="mt-1 text-sm text-stone">
                Anything inside the band goes to a person. Drag the bounds and watch
                the answers move — the model is not asked again.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  Lower bound
                  <input
                    type="range"
                    aria-label="Lower bound"
                    min={0}
                    max={1}
                    step={0.01}
                    value={band.low}
                    onChange={(event) =>
                      setBand(
                        clampBand({ ...band, low: Number(event.target.value) })
                      )
                    }
                  />
                  <span className="w-12 tabular-nums">
                    {formatPercent(band.low)}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Upper bound
                  <input
                    type="range"
                    aria-label="Upper bound"
                    min={0}
                    max={1}
                    step={0.01}
                    value={band.high}
                    onChange={(event) =>
                      setBand(
                        clampBand({ ...band, high: Number(event.target.value) })
                      )
                    }
                  />
                  <span className="w-12 tabular-nums">
                    {formatPercent(band.high)}
                  </span>
                </label>
              </div>
              <p className="mt-3 text-sm">
                <strong>{summary.uncertain}</strong> of {routed.length} questions go
                to review; {formatPercent(summary.automatedShare)} are decided
                automatically.
                {verdict && (
                  <>
                    {" "}
                    <span
                      className={
                        verdict.outcome === "review"
                          ? "text-review font-semibold"
                          : "text-auto font-semibold"
                      }
                    >
                      {verdict.outcome === "review"
                        ? "This claim needs a person."
                        : "This claim can be actioned."}
                    </span>{" "}
                    <span className="text-stone">{verdict.reason}</span>
                  </>
                )}
              </p>
            </section>

            <AnswersPane
              routed={routed}
              labels={definition.labels}
              band={band}
            />
          </>
        )}
      </div>

      <SamplesRail
        samples={definition.samples}
        onPick={(sample) => {
          setState(sample.text);
          setAnswers(null);
          setElapsed(null);
        }}
        disabled={running}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS — 9 new tests. If `claimVerdict` still throws, the TODO(human) from Task 3 is outstanding; finish it before continuing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the self-consistency noul card with a draggable band"
```

---

### Task 8: The shell

**Files:**
- Create: `src/components/shell/Shell.tsx`, `src/components/shell/Sidebar.tsx`, `src/components/shell/TopBar.tsx`
- Modify: `src/App.tsx` (replace the Task 1 placeholder entirely)
- Test: `src/components/shell/Sidebar.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `CATALOG`, `CATEGORIES`, `docsUrl` from `src/cookbooks`; `Engine` from `src/engine`; `LoadGate` from Task 6; `ConsistencyNoulCard` from Task 7.
- Produces: `function App(): JSX.Element`, `function Shell(props: { engine: Engine }): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

`src/components/shell/Sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  it("lists all eighteen cookbooks", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    expect(screen.getAllByTestId("cookbook-entry")).toHaveLength(18);
  });

  it("groups them under the five documented categories", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    for (const heading of [
      "Self-consistency",
      "Batching",
      "How-to",
      "Extraction",
      "Classification",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });

  it("only lets the built cookbook be selected", async () => {
    const onSelect = vi.fn();
    render(<Sidebar selected="consistency-noul" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Re-ranking/ }));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: /Self-consistency: nouls/ })
    );
    expect(onSelect).toHaveBeenCalledWith("consistency-noul");
  });

  it("says plainly which ones are not built yet", () => {
    render(<Sidebar selected="consistency-noul" onSelect={vi.fn()} />);
    expect(screen.getAllByText("soon").length).toBe(17);
  });
});
```

`src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./engine", async () => ({
  createLocalEngine: vi.fn(
    async () => new (await import("./engine/fake")).FakeEngine()
  ),
  inspectModel: vi.fn(async () => ({
    model: "onnx-community/kev-0.6b-ONNX",
    family: "kev",
    device: "webgpu",
    dtype: "q4f16",
    isCached: true,
    downloadSize: 340_000_000,
    files: [],
  })),
  isWebGpuAvailable: vi.fn(() => true),
}));

import App from "./App";

describe("App", () => {
  it("shows the load gate before a model is chosen", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /load the model/i })
    ).toBeInTheDocument();
  });

  it("shows the card once the engine is ready", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /load the model/i }));
    expect(
      await screen.findByRole("heading", { name: "Self-consistency: nouls" })
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/components/shell src/App.test.tsx`
Expected: FAIL — `Failed to resolve import "./Sidebar"`.

- [ ] **Step 3: Write the sidebar**

`src/components/shell/Sidebar.tsx`:

```tsx
import { CATEGORIES, entriesInCategory } from "../../cookbooks";

export default function Sidebar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex w-60 shrink-0 flex-col gap-5 border-r border-line p-4">
      {CATEGORIES.map((category) => (
        <div key={category}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone">
            {category}
          </h2>
          <ul>
            {entriesInCategory(category).map((entry) => {
              const built = entry.status === "built";
              return (
                <li key={entry.id} data-testid="cookbook-entry">
                  <button
                    type="button"
                    // Kept focusable and clickable rather than disabled, so its name
                    // is announced and the "soon" state is discoverable.
                    aria-disabled={!built}
                    aria-current={selected === entry.id ? "page" : undefined}
                    onClick={() => built && onSelect(entry.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                      selected === entry.id
                        ? "bg-white font-semibold"
                        : built
                          ? "hover:bg-white"
                          : "text-stone"
                    }`}
                  >
                    <span>{entry.title}</span>
                    {!built && (
                      <span className="rounded bg-line px-1.5 py-0.5 text-[0.65rem] uppercase">
                        soon
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Write the top bar and the shell**

`src/components/shell/TopBar.tsx`:

```tsx
import type { EngineRuntime } from "../../engine";

export default function TopBar({ runtime }: { runtime: EngineRuntime }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-3">
      <span className="font-semibold">Cookbook in the browser</span>
      <span className="flex items-center gap-3 text-sm text-stone">
        <span className="rounded-full bg-white px-2 py-0.5">{runtime.model}</span>
        <span className="rounded-full bg-white px-2 py-0.5">{runtime.device}</span>
        <span>running on your machine</span>
      </span>
    </header>
  );
}
```

`src/components/shell/Shell.tsx`:

```tsx
import { useState } from "react";
import type { Engine } from "../../engine";
import ConsistencyNoulCard from "../cards/ConsistencyNoulCard";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Shell({ engine }: { engine: Engine }) {
  const [selected, setSelected] = useState("consistency-noul");
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar runtime={engine.runtime} />
      <div className="flex flex-1">
        <Sidebar selected={selected} onSelect={setSelected} />
        <main className="flex-1 p-6">
          {/* One card in Phase 1; the switch grows as cards land. */}
          <ConsistencyNoulCard engine={engine} />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite App.tsx**

`src/App.tsx`:

```tsx
import { useState } from "react";
import LoadGate from "./components/load/LoadGate";
import Shell from "./components/shell/Shell";
import type { Engine } from "./engine";

export default function App() {
  // The engine lives here so it is loaded once and outlives any card.
  const [engine, setEngine] = useState<Engine | null>(null);
  return engine ? <Shell engine={engine} /> : <LoadGate onReady={setEngine} />;
}
```

- [ ] **Step 6: Run the whole suite and the build**

Run: `pnpm test && pnpm build`
Expected: PASS — 6 new tests, and a clean build.

- [ ] **Step 7: Check it by hand**

Run: `pnpm dev`, open the page, load `kev-0.6b`, run the card on each of the three samples, and drag both slider bounds.
Expected: the download reports a size, the run finishes, fourteen bars appear, and dragging moves rows between "review" and a verdict with no visible stall — the worker is why the drag stays smooth. Paste your own text and run it again.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add the shell, the sidebar of all eighteen cookbooks, and the load flow"
```

---

### Task 9: Deploy to a Hugging Face Space

**Files:**
- Create: `.github/workflows/deploy-hugging-face-space.yml`, `README.md`

**Interfaces:**
- Consumes: the `pnpm build` output in `dist/`.
- Produces: a published Space at `shreyask/cookbook-browser`.

- [ ] **Step 1: Write the repository README**

`README.md`:

```markdown
# Cookbook in the browser

[TypeSafe's cookbooks](https://docs.typesafe.ai/cookbooks), runnable in a browser tab.
The model downloads into the page and runs on your machine, so the text you paste never
leaves the tab — no key, no account, no upload.

Built on [`open-jev`](https://github.com/nico-martin/open-jev) over
[Transformers.js](https://github.com/huggingface/transformers.js).

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm test     # the whole suite, no model download
pnpm build
```

`pnpm smoke` runs the card's questions against the real model on CPU. It downloads
about 340 MB, so it is run by hand and never in CI.

## Status

One cookbook is interactive — Self-consistency: nouls. The other seventeen are listed
and are being built.
```

- [ ] **Step 2: Write the workflow**

`.github/workflows/deploy-hugging-face-space.yml`:

```yaml
name: Deploy to Hugging Face Space

on:
  workflow_dispatch:
  push:
    branches: [main]

concurrency:
  group: deploy-hugging-face-space
  cancel-in-progress: true

permissions:
  contents: read

env:
  HF_SPACE: shreyask/cookbook-browser

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11.1.1

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm test

      - run: pnpm run build

      - name: Write the Space metadata
        run: |
          cat > dist/README.md << 'EOF'
          ---
          title: Cookbook in the browser
          emoji: 📓
          colorFrom: yellow
          colorTo: gray
          sdk: static
          pinned: false
          license: apache-2.0
          short_description: TypeSafe's cookbooks, runnable locally in your browser
          models:
            - onnx-community/kev-0.6b-ONNX
            - onnx-community/kev-4b-ONNX
            - onnx-community/open-jev-deberta-v3-large-ONNX
          ---

          # Cookbook in the browser

          [TypeSafe's cookbooks](https://docs.typesafe.ai/cookbooks), runnable. The model
          downloads into this tab and runs on your machine: what you paste never leaves
          the tab, and there is no key and no account.

          Built on [`open-jev`](https://github.com/nico-martin/open-jev) over
          [Transformers.js](https://github.com/huggingface/transformers.js).

          Deployed from the [GitHub repository](https://github.com/${{ github.repository }}).
          EOF

      - name: Push to the Space
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
        run: |
          if [ -z "$HF_TOKEN" ]; then
            echo "The HF_TOKEN repository secret is required."
            exit 1
          fi
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git config --global user.name "github-actions[bot]"
          git lfs install
          GIT_LFS_SKIP_SMUDGE=1 git clone \
            "https://user:${HF_TOKEN}@huggingface.co/spaces/${HF_SPACE}" hf-space --depth 1
          rsync --archive --delete --exclude=.git dist/ hf-space/
          git -C hf-space lfs track "*.wasm"
          git -C hf-space add -A
          if git -C hf-space diff --cached --quiet; then
            echo "No changes to deploy."
          else
            git -C hf-space commit -m "Deploy from GitHub @ ${{ github.sha }}"
            git -C hf-space push origin HEAD:main
          fi
```

- [ ] **Step 3: Create the Space and the secret**

These are manual, in a browser, and need the human's account:
1. Create a static Space at `huggingface.co/new-space` named `cookbook-browser`, SDK **Static**.
2. Create a write token at `huggingface.co/settings/tokens`.
3. Add it as the `HF_TOKEN` secret on the GitHub repository.

Do not put the token in any file.

- [ ] **Step 4: Verify the build output works when served as static files**

Run: `pnpm build && pnpm preview`
Expected: the preview server serves the app, the model loads, and the card runs. This catches asset-path problems before they reach the Space.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "ci: deploy the app to a Hugging Face Space"
git push -u origin main
```

- [ ] **Step 6: Confirm the deployment**

Open `https://huggingface.co/spaces/shreyask/cookbook-browser`, load the model, run the card.
Expected: the same behaviour as local. If the model 404s, the Space is missing `models:` in its front matter.

---

## Done when

- `pnpm test` passes and downloads nothing.
- `pnpm smoke` produces fourteen probabilities that are not all identical.
- The Space loads `kev-0.6b`, runs the card on a pasted claim, and both slider bounds move rows between review and a verdict without re-running the model.
- The sidebar lists all 18 cookbooks under the five documented categories, with 17 marked "soon".
- No page copy compares the local model to Jev or makes an accuracy claim.
