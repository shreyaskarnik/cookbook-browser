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

The design and the Phase 1 implementation plan are in `docs/superpowers/`:

- [Design](docs/superpowers/specs/2026-09-22-browser-cookbook-design.md)
- [Phase 1 plan](docs/superpowers/plans/2026-09-22-browser-cookbook.md)
