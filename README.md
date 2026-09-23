# Cookbook in the browser

[TypeSafe's cookbooks](https://docs.typesafe.ai/cookbooks), runnable in a browser tab.
The model downloads into the page and runs on your machine, so the text you paste never
leaves the tab — no key, no account, no upload.

Built on [`open-jev`](https://github.com/nico-martin/open-jev) over
[Transformers.js](https://github.com/huggingface/transformers.js).

## Status

Not built yet. The design and the Phase 1 implementation plan are in `docs/superpowers/`:

- [Design](docs/superpowers/specs/2026-09-22-browser-cookbook-design.md)
- [Phase 1 plan](docs/superpowers/plans/2026-09-22-browser-cookbook.md)

Phase 1 ships the shell, the model load gate, and one fully interactive card —
[Self-consistency: nouls](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook) —
with a draggable uncertainty band. The other seventeen cookbooks are listed and follow.
