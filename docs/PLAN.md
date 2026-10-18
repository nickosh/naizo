# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

`M0`, `M1`, and `M2` are complete (`v0.1.0` core runtime in `src/index.ts` and root `naka.js`, dual `naka` / `data-naka` attributes, `index.html` playground, Vite+ `vp check` / `vp test` / `vp pack` pipeline, and automated test coverage for `EC01`, `EC03`, `EC04`, and `EC05` in `tests/naka.test.ts`). A second source review on 2026-10-18 reproduced `EC06`, `EC09`, `EC11`, and new cases `EC14`–`EC17`, and the owner adopted `D15` (in-memory store with merge semantics, pass-through keys, and a single-attribute key contract), `D16` (surgical `#nakadb` block writes for disk sync; full serialization only in `Naka.exportHTML()`), and `D17` (tracked `dist/naka.js` with a CI freshness check). `M4` was restructured so the store (`M4.1`) and surgical sync (`M4.2`) land first and every other hardening item is implemented once against them.

Next action: execute `M3.1` and `M3.2` (`dist/naka.js` emitted from `src/iife.ts` and tracked per `D17`, remove root `naka.js`, move `index.html` into `site/`, add starter templates in `examples/`), then implement `M4.1` before any other `M4` work.

## M0 — Project definition & foundation ✅ done 2026-10-18

- [x] **M0.1 — Project memory structure** (landed 2026-10-18): hybrid memory layout (`PRODUCT.md`, `PLAN.md`, `DECISIONS.md`, `EDGE_CASES.md`, `JOURNAL.md`), `AGENTS.md` + `CLAUDE.md` symlink, initial decisions `D01`–`D02`, and `.agents/skills/nakajs-closeout/SKILL.md`.
- [x] **M0.2 — Product & architecture definition** (landed 2026-10-18): recorded problem statement, target users, core invariants, and architectural decisions (`D03`–`D08`) in `docs/PRODUCT.md`, `docs/DECISIONS.md`, and `AGENTS.md`, plus boundary ledger `EC01`–`EC05` in `docs/EDGE_CASES.md`.
- [x] **M0.3 — Repository & Vite+ toolchain configuration** (landed 2026-10-18): reset initial version to `0.1.0` (`D07`), configured `package.json`, `vite.config.ts` (`dev`, `fmt`, `lint`, `test`, `pack`), `tsconfig.json`, `.gitignore`, and `README.md` (`D06`).

## M1 — Core library (`naka.js` v0.1.0) & interactive playground ✅ done 2026-10-18

- [x] **M1.1 — Core `v0.1.0` runtime (`src/index.ts` & `naka.js`)** (landed 2026-10-18):
  - Dual attribute support (`naka` / `naka-*` and `data-naka` / `data-naka-*`, `D08`).
  - IndexedDB `FileSystemFileHandle` persistence (`NakaDB_Handles`).
  - Automatic creation, parsing, and 2-space formatting of `<script id="nakadb" type="application/json">`.
  - Scalar element binding (`input`, `textarea`, `select`, `[contenteditable="true"]`, `[naka]`, `[data-naka]`) and attribute baking.
  - Declarative list repeater (`[naka-list]` / `[data-naka-list]`, `[naka-item]` / `[data-naka-item]`, `[naka-template]` / `[data-naka-template]`, auto-injected controls, `+ Add Item`, `↑`/`↓`/`×`).
  - Dual-layer persistence (`localStorage` + File System Access API / Blob download fallback), safe `localStorage` JSON parsing (`EC05`), and external-edit conflict resolution (`D04`, `EC01`).
  - Shadow DOM status pill (`#__nakadb_host__`) and clean HTML serialization (`getCleanHtmlString()`).
  - Public `window.Naka` / `window.NakaDB` API (`get`, `set`, `getList`, `addItem`, `removeItem`, `moveItem`, `save`, `exportHTML`) and `naka:hydrate` custom event.
- [x] **M1.2 — Interactive playground (`index.html`)** (landed 2026-10-18): demo updated to use concise `naka` / `naka-*` attributes covering standalone inputs, `naka-list="tasks"` checklist repeater, `contenteditable="true"` notes, and custom range slider widget using `Naka.get`/`Naka.set` and `naka:hydrate`.

## M2 — Automated verification & edge-case hardening ✅ done 2026-10-18

- [x] **M2.1 — Execute Vite+ verification suite** (landed 2026-10-18): installed dependencies via `vp install`, resolved Oxlint/tsgolint warnings in `src/index.ts` and `naka.js`, aligned `package.json` `"types"` with `dist/index.d.mts`, and verified clean `vp check`, `vp test`, and `vp pack` runs.
- [x] **M2.2 — Close `EC01`–`EC05` with observed test evidence** (landed 2026-10-18): verified 5/5 passing tests in `tests/naka.test.ts` under Vitest `jsdom` and promoted `EC01`, `EC03`, `EC04`, and `EC05` to `fix` in `docs/EDGE_CASES.md`.

## M3 — Repository reorganization & build output cleanup (`D09`)

- [ ] **M3.1 — Emit and track `dist/naka.js` via Vite+ and remove root `naka.js` (`D09`, `D17`)**: add a dedicated IIFE entry `src/iife.ts` (sets `window.Naka` / `window.NakaDB`, no `NakaBundle` namespace global, honors an auto-init opt-out attribute such as `data-naka-manual` on the script tag), configure `vite.config.ts` (`pack`) and `package.json` (`main`, `module`, `types`, `unpkg`, `jsdelivr`, `files`, `exports`, `prepublishOnly`) so `vp pack` emits `dist/naka.js` (IIFE), `dist/index.mjs` (ESM), and `dist/index.d.mts`; un-ignore `dist/naka.js` only and commit the built copy; remove the tracked root `naka.js`; update the jsDelivr `gh` URL to `@main/dist/naka.js` in `AGENTS.md`, `README.md`, and `docs/PRODUCT.md` in the same change.
- [ ] **M3.2 — Separate `site/` playground and `examples/` starter templates**: move root `index.html` into `site/index.html` (updating `vite.config.ts` dev/build paths as needed) and add clean, copy-ready starter HTML artifacts in `examples/` (e.g., `examples/starter.html`, `examples/checklist.html`).

## M4 — Core runtime re-architecture & hardening (`D12`–`D17`, `EC02`, `EC06`–`EC17`)

Sequence is binding: `M4.1` and `M4.2` replace the DOM-as-truth capture loop and the full-document disk write. Items in `M4.3` are implemented only against the store so no hardening is done twice.

- [ ] **M4.1 — In-memory store, merge semantics, and single-attribute key contract (`D15`, `D12`; `EC06`, `EC11`, `EC14`, `EC15`, `EC16`)**:
  - Build one in-memory `NakaDatabase` in `initNaka()` from the resolved source; route `Naka.get` / `set` / `getList` / `getField` / `setField` / `updateItem` / `deleteField` through it; serialize to `#nakadb` text, `localStorage`, and disk only on save.
  - Merge DOM reads into `store.fields` and per-item source objects (`WeakMap` from rendered `[naka-item]` to its object); never reset `fields` / `lists`; pass unknown fields, lists, and item keys through untouched; key removal is explicit.
  - Bind exclusively via `naka` / `data-naka` / `data-naka-field` inside and outside items; remove the `id`, `name`, and `field_${idx}` fallbacks; leave unannotated inputs untracked.
  - Bump `_meta.updatedAt` only when serialized `fields` / `lists` / `custom` changed; never on hydration or boot.
  - Debounce capture (about 150 ms) and flush synchronously on `pagehide` / `visibilitychange: hidden`; split `readElementValue()` from `bakeElementAttributes()` so baking runs only in hydration and export (`D14`).
  - Preserve stored `<select>` values with no matching `<option>` and warn instead of coercing to `""`.
  - Keep `naka-ignore` / `data-naka-ignore` strictly as a binding exclusion; mark injected runtime UI with `data-naka-runtime` (`D12`, `EC07`).
- [ ] **M4.2 — Surgical disk sync, conflict handling, and storage keys (`D16`, `D13`; `EC02`, `EC08`, `EC10`, `EC13`, `EC17`)**:
  - `writeToDisk()` reads the file via `fileHandle.getFile()`, replaces only the first `<script id="nakadb">` block (insert after `<head>` when absent), and writes the otherwise byte-identical text; escape `</script` and `<!--` in the serialized JSON (`EC08`).
  - Treat read-before-write and the window `focus` / `visibilitychange` check as the external-change detector (`EC10`); hydrate from disk when the on-disk block differs from the snapshot hash.
  - Store a synchronous string hash of the canonical JSON in `nakadb_disk_hash_<key>`; normalize `/index.html` → `/` and support optional `naka-id` / `data-naka-id` / `_meta.id` scoping in `getPageKey()` / `getSnapshotKey()`.
  - On three-way divergence keep the discarded browser state under `nakadb_backup_<key>` and surface a conflict notice with a restore action in the status pill (`EC17`); add an unlink action that clears the persisted handle; evaluate `showOpenFilePicker` as the link gesture to avoid the overwrite prompt.
  - Keep full `Naka.exportHTML()` serialization (with `data-naka-runtime` and auto-template stripping) for the Blob-download fallback and call `URL.revokeObjectURL()` after download (`EC02`, `EC13`).
- [ ] **M4.3 — Element bindings, list repeater support, and symmetrical API on top of the store (`D14`, `D15`; `EC09`, `EC12`, `EC13`)**:
  - Numeric coercion (`number | null`) for `input[type="number"|"range"]`, boolean `open` for `<details>`, `<select multiple>`, `contenteditable` variants (`""`, `"true"`, `"plaintext-only"` vs `"false"`), and non-leaf element guards.
  - Auto-template lifecycle: mark inferred templates with `data-naka-auto-template`, regenerate from the first `[naka-item]` on boot, scope the template selector to a direct child `template[naka-template]`, and strip on export only when the list has $\ge 1$ item (`EC09`).
  - Self-bound `[naka-item]` roots, per-row radio `name` scoping, valid control placement for `<table>` / `<tbody naka-list>` / `<tr naka-item>`, attribute-escaped list names in injected controls, and a documented guard or rejection for nested lists.
  - Finalize `window.Naka` / `window.NakaDB`: `getField`, `setField`, `updateItem`, `deleteField`, `unlink`, plus a `naka:change` event; update `AGENTS.md`, `README.md`, and `docs/PRODUCT.md` contracts (body is template, JSON is data) in the same change.
- [ ] **M4.4 — Automated verification and edge-case closure (`EC02`, `EC06`–`EC17`)**:
  - Vitest `jsdom`: store merge and pass-through, key contract, change-only `updatedAt`, debounce and flush, select preservation, escaping, block replacement on sample file text, hash snapshot, and conflict backup.
  - Browser-level suite (Playwright or Vitest browser mode) with a mocked `showSaveFilePicker` / `showOpenFilePicker` and an in-memory `FileSystemFileHandle`: handle persistence across reloads, surgical write leaving unrelated bytes untouched, read-before-write detection, conflict notice and restore, unlink, and Blob fallback. `jsdom` cannot exercise these paths.
  - Promote every verified case to `fix` in `docs/EDGE_CASES.md`; keep anything not covered explicitly `OPEN` or `PARTIAL`.

## M5 — Consumer AI skill & usage documentation (`D09`, `D12`–`D14`)

- [ ] **M5.1 — Author comprehensive usage reference (`docs/USAGE.md`)**: document `#nakadb` schema, explicit scalar and `[naka-list]` binding rules, `<template naka-template>` vs auto-templates, `naka-ignore` vs `data-naka-runtime`, programmatic `window.Naka` API, conflict resolution and live disk sync, and step-by-step instructions for AI agents reading and mutating `#nakadb` on disk.
- [ ] **M5.2 — Create distributable `nakajs` AI skill (`skills/nakajs/SKILL.md`)**: author an installable consumer skill in `skills/nakajs/SKILL.md` (with references/examples) so users can equip Claude Code, Antigravity, Cursor, Gemini CLI, and Codex to build self-persisting HTML artifacts with `naka.js`.

## M6 — Project website, AI-agent endpoints (`llms.txt`), & `js.org` preparation (`D11`)

- [ ] **M6.1 — Build documentation & interactive demo website (`site/`)**: expand `site/index.html` into the public `naka.js` project site featuring an interactive live demo, `#nakadb` live state viewer, CDN copy snippets, and documentation.
- [ ] **M6.2 — Add AI-agent discovery endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`) & `js.org` `CNAME`**: generate/serve `/llms.txt` (concise index and core authoring contract), `/llms-full.txt` (complete single-file documentation and templates for LLM ingestion), and `/SKILL.md` in the built site alongside the `CNAME` file for `js.org` registration.

## M7 — CI/CD & maintainer-controlled CDN release workflows (`D10`, `D11`)

- [ ] **M7.1 — CI verification & GitHub Pages deployment workflows (`.github/workflows/ci.yml`, `.github/workflows/pages.yml`)**: run `vp install`, `vp check`, `vp test`, `vp pack`, the browser-level suite from `M4.4`, and a `dist/naka.js` freshness check (`git diff --exit-code dist/naka.js` after `vp pack`, `D17`) on pushes and pull requests, and deploy the built `site/` directory (including `dist/naka.js`, `/llms.txt`, `/llms-full.txt`, `/SKILL.md`) to GitHub Pages on `main`.
- [ ] **M7.2 — Maintainer-controlled CDN release workflow (`.github/workflows/release.yml`)**: support both manual `workflow_dispatch` (select `patch` / `minor` / `major` or explicit version to run verification, bump `package.json`, tag, and create a GitHub Release with `dist/naka.js` attached) and `release: types: [published]` to publish `nakajs` to npm, automatically populating `jsDelivr` and `unpkg` CDNs.
