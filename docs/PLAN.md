# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

`M0`, `M1`, `M2`, and `M3` are complete (`v0.1.0` core runtime in `src/index.ts` and browser IIFE entry `src/iife.ts`, tracked `dist/naka.js` artifact with root `naka.js` removed, `site/index.html` playground, `examples/starter.html` and `examples/checklist.html` starter templates, Vite+ `vp check` / `vp test` / `vp pack` pipeline, and 7/7 passing tests in `tests/naka.test.ts`). Following the source/architecture reviews and ecosystem viability analysis on 2026-10-18, the owner adopted `D27` (consolidating `D12`–`D17` and the lean subset of `D21`–`D26` while rejecting `D18`, `D19`, `D20`, `D22` HTML sanitizer, and `D25` adapter/server bloat).

Next action: implement `M4.1`–`M4.4` in sequence (`M4.1` in-memory store, synchronous boot, and `O(1)` event-targeted capture; `M4.2` surgical `#nakadb` disk sync, live `file.lastModified` watch, shallow top-level key merge, and truthful status pill UX with `Naka.copyJSON()`; `M4.3` element bindings, list repeater polish, and public `window.Naka` API; `M4.4` automated regression verification and edge-case closure).

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

## M3 — Repository reorganization & build output cleanup (`D09`, `D17`, `D25`, `D27`) ✅ done 2026-10-18

- [x] **M3.1 — Emit and track `dist/naka.js` via Vite+ and remove root `naka.js` (`D09`, `D17`, `D25`, `EC30`, `EC37`)** (landed 2026-10-18):
  - Added dedicated IIFE entry `src/iife.ts` (sets `window.Naka` / `window.NakaDB`, no `NakaBundle` namespace global, honors `data-naka-manual` / `naka-manual` opt-out) while keeping `src/index.ts` (`dist/index.mjs`) side-effect free (`D25`, `EC37`).
  - Configured `vite.config.ts` (`pack`) and `package.json` (`main`, `module`, `types`, `unpkg`, `jsdelivr`, `files`, `exports`, `prepublishOnly` — excluding maintainer `AGENTS.md` from npm `files`) so `vp pack` emits `dist/naka.js` (IIFE), `dist/index.mjs` (ESM), and `dist/index.d.mts`.
  - Un-ignored `dist/naka.js` only in `.gitignore`, removed tracked root `naka.js`, and updated `AGENTS.md`, `README.md`, and `docs/PRODUCT.md`.
- [x] **M3.2 — Separate `site/` playground and `examples/` starter templates (`D09`, `EC39`)** (landed 2026-10-18):
  - Moved root `index.html` into `site/index.html` and configured `vite.config.ts` dev/build paths.
  - Added clean, copy-ready starter HTML artifacts in `examples/` (`examples/starter.html`, `examples/checklist.html`) using wrapping `<label>` elements (`EC39`) and explicit `naka` / `naka-list` bindings, verified in `tests/naka.test.ts`.

## M4 — Core runtime re-architecture & hardening (`D12`–`D17`, `D21`–`D27`, `EC02`, `EC04`, `EC06`–`EC40`)

Sequence is binding: `M4.1` and `M4.2` establish the in-memory store, event-targeted capture, and surgical `#nakadb` disk sync so `M4.3` bindings and list controls are implemented once on top of the store.

- [ ] **M4.1 — In-memory store, synchronous boot, and `O(1)` event-targeted capture (`D12`, `D15`, `D21`–`D23`, `D27`; `EC04`, `EC06`, `EC11`, `EC14`–`EC16`, `EC18`–`EC25`, `EC32`–`EC35`, `EC38`)**:
  - Build one in-memory `NakaDatabase` (`{ _meta, fields, lists, custom }`) in `initNaka()`, validating root/bucket shapes (`EC33`) and installing all four buckets from resolved disk or `localStorage` cache before hydrating or firing `naka:hydrate` (`EC32`). If startup `#nakadb` has a JSON syntax error (`EC04`), preserve the raw script text, surface an error state in the status pill, and block automatic write-back until resolved.
  - Attach delegated `input` / `change` / `click` listeners synchronously before awaiting IndexedDB handle lookup (`EC34`), and wrap all `localStorage` / `indexedDB` accesses in `try/catch` so blocked storage or quota errors never break in-memory operation (`EC22`).
  - Route `O(1)` event capture from `event.target` to its bound scalar key or `[naka-item]` row object (`WeakMap<HTMLElement, Record<string, unknown>>`), propagating scalar changes to duplicate bindings (`EC19`), preserving unbound fields/lists/item keys (`EC14`), and using `Object.hasOwn()` / own-property writes (`EC24`, `EC38`).
  - Bind exclusively via `naka` / `data-naka` / `data-naka-field` (`EC11`); skip `password`, `file`, and button input types (`EC21`); exclude `[naka-ignore]` / `[data-naka-ignore]` subtrees via `closest()` (`EC23`); default `contenteditable` to plain text (`textContent`, `D22`, `EC18`).
  - Bump `_meta.updatedAt` only when serialized content changes (`EC06`), preserve stored numeric/boolean types on no-op round-trips (`EC25`) and unknown `<select>` values (`EC15`), debounce persistence (~150 ms) with synchronous cache/DOM flush on `pagehide` / `visibilitychange: hidden`, and bake HTML attributes only on the export clone (`D23`).
- [ ] **M4.2 — Surgical `#nakadb` disk sync, live `file.lastModified` watch, conflict recovery, and truthful status pill UX (`D13`, `D16`, `D20`, `D24`, `D27`; `EC02`, `EC08`, `EC10`, `EC17`, `EC26`–`EC28`, `EC36`)**:
  - Queue disk writes single-flight (`EC26`); read `await fileHandle.getFile()` before writing, on window `focus` / `visibilitychange`, and via a lightweight ~2 s `file.lastModified` watch timer while `document.visibilityState === 'visible'` and a granted `fileHandle` is linked (`EC10`).
  - Escape `<` as `\u003c` when serializing `#nakadb` JSON (`EC08`); replace only the `<script id="nakadb">` block in the file text (preserving a leading UTF-8 BOM if present, and refusing to modify an existing file that lacks `#nakadb` without confirmation, `EC28`); record the disk snapshot from the exact payload written (`EC26`).
  - Normalize storage keys (`/index.html` → `/`, optional `naka-id` / `data-naka-id` / `_meta.id`, `EC11`), and refresh the store on cross-tab `storage` events (`EC27`).
  - On external disk updates or three-way divergence (`cache ≠ snapshot` and `disk ≠ snapshot`), perform a shallow top-level key merge (`fields[k]`, `lists[k]`, `custom[k]`) against the last disk state so concurrent edits to different keys both survive, guard `document.activeElement` against mid-keystroke overwrite, and on same-key collisions let disk win while saving the pre-merge browser state under `nakadb_backup_<key>` with a 1-click **`↺ Restore`** action in the status pill (`EC17`).
  - Update the Shadow DOM status pill (`#__nakadb_host__`) to distinguish **amber** (`Browser Cache · Click to Link Disk`) whenever edits are not yet written to disk from **green** (`Synced to Disk`) after `writable.close()` completes (`EC36`), and add **`📋 Copy`** (`Naka.copyJSON()`) and **`× Unlink`** (`Naka.unlink()`) actions.
  - Keep full HTML serialization (with attribute baking and `[data-naka-runtime]` / auto-template stripping) in `Naka.exportHTML()` and the Blob download fallback, calling `URL.revokeObjectURL()` (`EC02`).
- [ ] **M4.3 — Element bindings, list repeater polish, and public `window.Naka` API (`D14`, `D15`, `D27`; `EC07`, `EC09`, `EC12`, `EC13`, `EC29`, `EC31`, `EC40`)**:
  - Support numeric coercion (`number | null`) for `input[type="number"|"range"]`, boolean `open` for `<details>`, `<select multiple>`, `contenteditable` variants (`""`, `"true"`, `"plaintext-only"` vs `"false"`), native `form.reset()` handling, and non-leaf element guards (`EC12`).
  - Auto-template lifecycle: mark inferred templates with `data-naka-auto-template="true"`, regenerate from the first `[naka-item]` on boot when no direct-child `<template naka-template>` is authored, and strip on `Naka.exportHTML()` only when the list has $\ge 1$ item (`EC09`).
  - Support self-bound `[naka-item]` roots (`<li naka-item naka="label">`), per-row radio `name` scoping, valid control placement for `<table>` / `<tbody naka-list>` / `<tr naka-item>` (`EC13`), `@media print` hiding of runtime UI (`EC29`), focus only on user-clicked `[naka-add]` (`EC31`), and `aria-label` / `aria-live` attributes.
  - Finalize `window.Naka` (`window.NakaDB`): `get`, `set`, `getField`, `setField`, `deleteField`, `getList`, `addItem`, `updateItem`, `moveItem`, `removeItem`, `bind`, `save` (`Promise<boolean>`), `unlink`, `copyJSON`, `exportHTML`, plus `naka:hydrate` and `naka:change` events (`EC40`). Update `AGENTS.md`, `README.md`, and `docs/PRODUCT.md` in the same change.
- [ ] **M4.4 — Automated verification and edge-case closure (`EC02`, `EC04`, `EC06`–`EC40`)**:
  - Expand `tests/naka.test.ts` (running against both `src/` and built `dist/naka.js`, `EC30`, `EC37`) to cover store merge/pass-through, synchronous boot before async IDB, `O(1)` event capture, duplicate scalar bindings, `contenteditable` plain text, `<select>` preservation, `\u003c` escaping, surgical `#nakadb` block replacement, single-flight write queue, `file.lastModified` live watch + shallow key merge + conflict backup/restore, `copyJSON()`, `unlink()`, and `exportHTML()` baking/stripping.
  - Promote all verified cases to `fix` in `docs/EDGE_CASES.md`.

## M5 — Consumer AI skill & usage documentation (`D09`, `D12`–`D14`)

- [ ] **M5.1 — Author comprehensive usage reference (`docs/USAGE.md`)**: document `#nakadb` schema, explicit scalar and `[naka-list]` binding rules, `<template naka-template>` vs auto-templates, `naka-ignore` vs `data-naka-runtime`, programmatic `window.Naka` API, conflict resolution and live disk sync, and step-by-step instructions for AI agents reading and mutating `#nakadb` on disk.
- [ ] **M5.2 — Create distributable `nakajs` AI skill (`skills/nakajs/SKILL.md`)**: author an installable consumer skill in `skills/nakajs/SKILL.md` (with references/examples) so users can equip Claude Code, Antigravity, Cursor, Gemini CLI, and Codex to build self-persisting HTML artifacts with `naka.js`.

## M6 — Project website, AI-agent endpoints (`llms.txt`), & `js.org` preparation (`D11`)

- [ ] **M6.1 — Build documentation & interactive demo website (`site/`)**: expand `site/index.html` into the public `naka.js` project site featuring an interactive live demo, `#nakadb` live state viewer, CDN copy snippets, and documentation.
- [ ] **M6.2 — Add AI-agent discovery endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`) & `js.org` `CNAME`**: generate/serve `/llms.txt` (concise index and core authoring contract), `/llms-full.txt` (complete single-file documentation and templates for LLM ingestion), and `/SKILL.md` in the built site alongside the `CNAME` file for `js.org` registration.

## M7 — CI/CD & maintainer-controlled CDN release workflows (`D10`, `D11`)

- [ ] **M7.1 — CI verification & GitHub Pages deployment workflows (`.github/workflows/ci.yml`, `.github/workflows/pages.yml`)**: run `vp install`, `vp check`, `vp test`, `vp pack`, the browser-level suite from `M4.4`, and a `dist/naka.js` freshness check (`git diff --exit-code dist/naka.js` after `vp pack`, `D17`) on pushes and pull requests, and deploy the built `site/` directory (including `dist/naka.js`, `/llms.txt`, `/llms-full.txt`, `/SKILL.md`) to GitHub Pages on `main`.
- [ ] **M7.2 — Maintainer-controlled CDN release workflow (`.github/workflows/release.yml`)**: support both manual `workflow_dispatch` (select `patch` / `minor` / `major` or explicit version to run verification, bump `package.json`, tag, and create a GitHub Release with `dist/naka.js` attached) and `release: types: [published]` to publish `nakajs` to npm, automatically populating `jsDelivr` and `unpkg` CDNs.
