import { defineConfig } from "vitest/config";

/** The citations card's own items against the real model. Separate from
 *  `pnpm test` for the same reason the other smoke configs are. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/citations.smoke.ts"],
    testTimeout: 1_800_000,
  },
});
