import { defineConfig } from "vitest/config";

/** Wave 1b's viability probe. Separate from `pnpm test` for the same reason
 *  vitest.smoke.config.ts is: it downloads a real model. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/wave1b.smoke.ts"],
    testTimeout: 1_800_000,
  },
});
