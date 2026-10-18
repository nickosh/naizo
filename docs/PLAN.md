# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

`M0`, `M1`, and `M2` are complete (`v0.1.0` core runtime in `src/index.ts` and root `naka.js`, dual `naka` / `data-naka` attributes, `index.html` playground, Vite+ `vp check` / `vp test` / `vp pack` pipeline, and automated test coverage for `EC01`, `EC03`, `EC04`, and `EC05` in `tests/naka.test.ts`). Milestones `M3`–`M7` are planned below (`D09`–`D14`), sequencing repository reorganization (`M3`) first so runtime and architecture hardening (`M4`, covering `EC02` and `EC06`–`EC13`) is implemented once in `src/index.ts` after the duplicate root `naka.js` is removed.

Next action: execute `M3.1` and `M3.2` to emit `dist/naka.js` via `vp pack`, remove root `naka.js`, move `index.html` into `site/`, and add starter templates in `examples/` (`D09`), then proceed to `M4` runtime hardening.

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

- [ ] **M3.1 — Emit `dist/naka.js` via Vite+ and remove root `naka.js`**: configure `vite.config.ts` (`pack`) and `package.json` (`main`, `module`, `types`, `unpkg`, `jsdelivr`, `files`, `exports`) so `vp pack` emits `dist/naka.js` (IIFE), `dist/index.mjs` (ESM), and `dist/index.d.mts`; remove the tracked root `naka.js` copy and update `AGENTS.md`, `README.md`, and `docs/PRODUCT.md` in the same change.
- [ ] **M3.2 — Separate `site/` playground and `examples/` starter templates**: move root `index.html` into `site/index.html` (updating `vite.config.ts` dev/build paths as needed) and add clean, copy-ready starter HTML artifacts in `examples/` (e.g., `examples/starter.html`, `examples/checklist.html`).

## M4 — Core runtime & architecture hardening (`D12`–`D14`, `EC02`, `EC06`–`EC13`)

- [ ] **M4.1 — Persistence, conflict resolution, and serialization hardening (`D13`, `EC02`, `EC06`, `EC08`, `EC10`, `EC11`, `EC13`)**:
  - Record unmutated disk `#nakadb` payload in `nakadb_disk_hash_<key>` before `captureDomToState()` runs and avoid bumping `_meta.updatedAt` during read-only hydration so `localStorage` edits survive browser refreshes (`EC06`).
  - Escape `</script` (`<\/script`, case-insensitive) and `<!--` (`<\!--`) when serializing `#nakadb` JSON (`EC08`).
  - Normalize storage keys (`/index.html` → `/`) and support optional document ID scoping (`naka-id`, `data-naka-id`, `_meta.id`) (`EC11`).
  - Add live external disk edit detection via `fileHandle.getFile()` on window `focus` / `visibilitychange` and pre-write checks in `writeToDisk()` (`EC10`).
  - Call `URL.revokeObjectURL()` in the Blob download fallback (`EC02`, `EC13`).
- [ ] **M4.2 — Explicit binding, `naka-ignore` vs. `data-naka-runtime` separation, and element type support (`D12`, `D14`, `EC07`, `EC11`, `EC12`)**:
  - Separate `naka-ignore` / `data-naka-ignore` (skip state binding, preserve element in saved HTML) from `data-naka-runtime` (strip injected runtime UI in `getCleanHtmlString()`, `EC07`).
  - Require explicit `naka` / `data-naka` / `data-naka-field` attributes on standalone fields while allowing `name` fallback inside `[naka-item]` (with `name` prioritized over `id` on radio inputs, `EC11`).
  - Split `readElementValue()` from `bakeElementAttributes()` so DOM attribute baking (`setAttribute`, `textarea.textContent`) only runs on hydration and HTML export (`getCleanHtmlString()`), preventing `<textarea>` cursor jumps on live `input` events (`EC12`).
  - Support numeric coercion (`number | null`) for `input[type="number"|"range"]`, boolean `open` state for `<details>`, `<select multiple>`, `contenteditable` variants (`""`, `"true"`, `"plaintext-only"` vs `"false"`), and non-leaf element guards (`EC12`).
- [ ] **M4.3 — List repeater hardening & symmetrical `window.Naka` API (`D14`, `EC09`, `EC13`)**:
  - Mark inferred list templates with `data-naka-auto-template="true"`, regenerate from the first `[naka-item]` on boot when no explicit `<template naka-template>` is authored, and strip `template[data-naka-auto-template]` in `getCleanHtmlString()` when the list has $\ge 1$ item while preserving it when the list has $0$ items (`EC09`).
  - Support self-bound `[naka-item]` root elements (`<li naka-item naka="label">`), scope radio input `name` attributes per list item row, and place list controls in valid table DOM positions for `<table>` / `<tbody naka-list>` / `<tr naka-item>` (`EC13`).
  - Add `Naka.getField(key)`, `Naka.setField(key, value)`, and `Naka.updateItem(listName, index, partialData)` to `window.Naka` / `window.NakaDB` (`D14`), and update `AGENTS.md`, `README.md`, and `docs/PRODUCT.md` contracts in the same change.
- [ ] **M4.4 — Automated verification & edge-case closure (`EC02`, `EC06`–`EC13`)**:
  - Expand `tests/naka.test.ts` with deterministic Vitest coverage for `EC02` and `EC06`–`EC13` and promote all verified cases to `fix` in `docs/EDGE_CASES.md`.

## M5 — Consumer AI skill & usage documentation (`D09`, `D12`–`D14`)

- [ ] **M5.1 — Author comprehensive usage reference (`docs/USAGE.md`)**: document `#nakadb` schema, explicit scalar and `[naka-list]` binding rules, `<template naka-template>` vs auto-templates, `naka-ignore` vs `data-naka-runtime`, programmatic `window.Naka` API, conflict resolution and live disk sync, and step-by-step instructions for AI agents reading and mutating `#nakadb` on disk.
- [ ] **M5.2 — Create distributable `nakajs` AI skill (`skills/nakajs/SKILL.md`)**: author an installable consumer skill in `skills/nakajs/SKILL.md` (with references/examples) so users can equip Claude Code, Antigravity, Cursor, Gemini CLI, and Codex to build self-persisting HTML artifacts with `naka.js`.

## M6 — Project website, AI-agent endpoints (`llms.txt`), & `js.org` preparation (`D11`)

- [ ] **M6.1 — Build documentation & interactive demo website (`site/`)**: expand `site/index.html` into the public `naka.js` project site featuring an interactive live demo, `#nakadb` live state viewer, CDN copy snippets, and documentation.
- [ ] **M6.2 — Add AI-agent discovery endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`) & `js.org` `CNAME`**: generate/serve `/llms.txt` (concise index and core authoring contract), `/llms-full.txt` (complete single-file documentation and templates for LLM ingestion), and `/SKILL.md` in the built site alongside the `CNAME` file for `js.org` registration.

## M7 — CI/CD & maintainer-controlled CDN release workflows (`D10`, `D11`)

- [ ] **M7.1 — CI verification & GitHub Pages deployment workflows (`.github/workflows/ci.yml`, `.github/workflows/pages.yml`)**: run `vp install`, `vp check`, `vp test`, and `vp pack` on pushes and pull requests, and deploy the built `site/` directory (including `dist/naka.js`, `/llms.txt`, `/llms-full.txt`, `/SKILL.md`) to GitHub Pages on `main`.
- [ ] **M7.2 — Maintainer-controlled CDN release workflow (`.github/workflows/release.yml`)**: support both manual `workflow_dispatch` (select `patch` / `minor` / `major` or explicit version to run verification, bump `package.json`, tag, and create a GitHub Release with `dist/naka.js` attached) and `release: types: [published]` to publish `nakajs` to npm, automatically populating `jsDelivr` and `unpkg` CDNs.
