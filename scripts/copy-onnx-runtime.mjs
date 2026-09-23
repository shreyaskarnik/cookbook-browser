#!/usr/bin/env node
/**
 * Copies ONNX Runtime Web's WASM binary and its loader script out of
 * `onnxruntime-web` (a transitive dependency of `@huggingface/transformers`,
 * not one of ours) into `public/onnxruntime/`, so Vite serves them from our
 * own origin at a stable, unhashed path in both `vite dev` and `vite build`.
 *
 * Without this, `@huggingface/transformers` points `env.backends.onnx.wasm.wasmPaths`
 * at `cdn.jsdelivr.net` by default (see `src/engine/worker.ts`, which overrides it
 * to this stable path before loading a model) — every visitor's IP and user agent
 * would otherwise go to a host we don't control, breaking this app's "nothing
 * leaves your machine" claim.
 *
 * Run before `vite dev` / `vite build` (see package.json); never committed — see
 * .gitignore. The two files total ~25.6 MB, already part of every visitor's
 * download regardless of which origin serves them (ORT's WASM is what runs the
 * model), so this changes only the origin, not the byte count.
 *
 * Resolved via Node's own module resolution rather than a hardcoded pnpm store
 * path or version, so the copy always matches whatever `onnxruntime-web` version
 * `@huggingface/transformers` actually pulls in — including after an upgrade.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** Walk up from `startFile` until a `package.json` with the given `name` is
 *  found, without going through `exports`-restricted `require.resolve`. */
function findPackageRoot(startFile, name) {
  let dir = dirname(startFile);
  while (true) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === name) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find the "${name}" package above ${startFile}`);
    }
    dir = parent;
  }
}

const transformersRoot = findPackageRoot(
  require.resolve("@huggingface/transformers"),
  "@huggingface/transformers"
);

// Resolved starting from transformers' own install location, not ours: under
// pnpm, onnxruntime-web is nested inside transformers' dependency tree rather
// than hoisted to our top-level node_modules.
const onnxRoot = findPackageRoot(
  require.resolve("onnxruntime-web", { paths: [transformersRoot] }),
  "onnxruntime-web"
);
const onnxVersion = JSON.parse(readFileSync(join(onnxRoot, "package.json"), "utf8")).version;
const onnxDist = join(onnxRoot, "dist");

const FILES = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];
const destDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "onnxruntime");

mkdirSync(destDir, { recursive: true });
for (const file of FILES) {
  copyFileSync(join(onnxDist, file), join(destDir, file));
}

console.log(
  `Copied ONNX Runtime Web ${onnxVersion} assets (${FILES.join(", ")}) into public/onnxruntime/`
);
