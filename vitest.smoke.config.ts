import { defineConfig } from "vitest/config";

/** Separate config so `pnpm test` never touches this file: the smoke check
 *  downloads a real model and is only ever run by hand via `pnpm smoke`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/model.smoke.ts"],
    testTimeout: 1_800_000,
  },
});
