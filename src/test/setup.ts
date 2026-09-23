import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts does not set test.globals, so @testing-library/react's own
// auto-cleanup (which looks for a global afterEach) never registers. Without
// this, each render() in a test file stays mounted for the rest of the file,
// and later tests see duplicate copies of earlier screens.
afterEach(() => {
  cleanup();
});
