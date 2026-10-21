# naizo — Decision Log (ADR-style)

Record durable architectural and owner decisions and their rationale. Allocate the next `Dxx` ID for new decisions; supersede an old decision explicitly rather than silently rewriting its history.

Entries marked **Status: Proposed** are recommendations pending owner review. They bind nothing and amend nothing until the owner accepts them; on acceptance, record the date and any changes in the entry and update the decisions it amends.

## D01 — Hybrid project memory structure

Accepted by the owner on 2026-10-18. Use a hybrid project memory layout combining the lean core ledger from `nuance-skills` with the product and edge-case ledgers from `napflow`:

- `AGENTS.md` (with a root `CLAUDE.md -> AGENTS.md` symlink) for repository-wide instructions, architecture, verification, and workflow rules.
- `docs/PRODUCT.md` for product definition, target users, core invariants, and non-goals.
- `docs/PLAN.md` as the single authoritative task, milestone/slice sequencing, and acceptance ledger (omitting a separate `REQUIREMENTS.md` checkbox matrix until needed).
- `docs/DECISIONS.md` for numbered ADR-style design and owner decisions.
- `docs/EDGE_CASES.md` for numbered boundary cases and their resolution status (`ADR`, `fix`, `doc`, `PARTIAL`, `OPEN`).
- `docs/JOURNAL.md` for concise newest-first session/slice handoffs (2–5 bullets: done, decided, verification/blockers, next technical action).
- `.agents/skills/naizo-closeout/SKILL.md` as the repository-scoped maintainer closeout skill.

Keep delivery bookkeeping (branch names, commit SHAs, PR numbers/states, push/pull/merge steps, and CI run/job IDs) and manual release-status markers out of project memory documents; Git history and GitHub Releases/tags own those states.

## D02 — Local auto-commit workflow with descriptive Conventional Commits

Accepted by the owner on 2026-10-18. After completing and verifying each coherent change (including documentation changes) and reconciling project memory, create a local commit automatically without asking again unless the user explicitly requests otherwise.

Every commit must use a Conventional Commit subject (`type(scope): subject`, with scope optional when unhelpful) followed by a blank line and a factual body explaining what changed, why, and any relevant limitations. Subject-only commits are not permitted. Validation output and unrun-check details belong in closeout documentation and chat rather than commit bodies. Pushing, tagging, publishing, or opening pull requests always require separate explicit owner approval.

## D03 — Embedded `<script id="naizodb" type="application/json">` as canonical in-file database

Adopted 2026-10-18 (serialization escaping amended for `M4` by `D13`; deferred attribute baking amended for `M4` by `D14`). Rather than storing state only in browser storage or scattering state solely across DOM attributes, `naizo.js` maintains a canonical JSON document inside `<script id="naizodb" type="application/json">` at the top of `<head>` with four top-level keys: `_meta`, `fields`, `lists`, and `custom`. Simultaneously, `readAndBakeElement()` bakes scalar values into standard HTML attributes (`value`, `checked`, `selected`, `textContent`). This gives AI coding agents a single structured JSON block at the top of the file to read and mutate while keeping the raw HTML markup self-contained.

## D04 — Dual-layer persistence with snapshot-based disk vs. browser conflict resolution

Adopted 2026-10-18 (snapshot timing, storage key normalization, and live `fileHandle.getFile()` sync amended for `M4` by `D13`). Every user edit immediately caches state in `localStorage` (`naizodb_state_<pathname>`) and schedules a debounced (250 ms) disk write via the File System Access API (`FileSystemFileHandle` persisted in IndexedDB `NaizoDB_Handles`). Whenever `naizo.js` writes to disk or hydrates from disk, it records the raw `#naizodb` string in `localStorage` under `naizodb_disk_hash_<pathname>`. On boot, if the current `#naizodb` text in the HTML file differs from `naizodb_disk_hash_<pathname>`, `naizo.js` detects that an external process (such as an AI agent or text editor) modified the file on disk and hydrates from the disk state instead of the browser cache.

## D05 — Runtime UI isolation via Shadow DOM and `naizo-ignore` / `data-naizo-ignore`

Adopted 2026-10-18 (separation of `naizo-ignore` state exclusion from `data-naizo-runtime` export stripping amended for `M4` by `D12`). The floating status/sync pill (`#__naizodb_host__`) mounts inside an open Shadow DOM root so its styles never collide with the host document. Auto-injected list stylesheet (`#__naizodb_styles__`), per-item action toolbars (`.naizo-item-tools`), and list footers (`.naizo-list-footer`) are marked with `naizo-ignore="true"`. Before writing HTML back to disk or returning from `Naizo.exportHTML()`, `getCleanHtmlString()` clones `document.documentElement` and strips `[naizo-ignore], [data-naizo-ignore], #__naizodb_host__, #__naizodb_styles__` so runtime controls never accumulate in saved files.

## D06 — TypeScript core in `src/` with Vite+ (`vite-plus`) toolchain and standalone IIFE

Amended by the owner on 2026-10-18 (superseding the initial plain-JS-only setup; root bundle and root `index.html` placement superseded for `M3` by `D09`). Author the core runtime in TypeScript (`src/index.ts`) and use [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) configured via `vite.config.ts` as the unified toolchain for development (`vp dev`), formatting/linting/type-checking (`vp check`), testing (`vp test` with Vitest + `jsdom`), and library packaging (`vp pack` with `tsdown` emitting `dist/`). Keep the standalone zero-dependency IIFE `naizo.js` synchronized until `M3` lands (`D09`).

## D07 — Reset initial version to `0.1.0` (experimental `0.x` series)

Accepted by the owner on 2026-10-18. Reset the initial version from the specification bundle's `1.1.0` placeholder to `0.1.0` across `package.json`, `src/index.ts`, `dist/naizo.js`, and documentation. All `0.x` releases are experimental while the core runtime and attribute contracts are refined; `1.0.0` is reserved for the first stability commitment.

## D08 — Dual attribute syntax (`naizo` / `naizo-*` and `data-naizo` / `data-naizo-*`)

Accepted by the owner on 2026-10-18. Support both concise `naizo` / `naizo-*` attributes (`naizo="key"`, `naizo-list="name"`, `naizo-item`, `naizo-template`, `naizo-add`, `naizo-remove`, `naizo-move`, `naizo-no-controls`, `naizo-ignore`) and standard HTML5 `data-naizo` / `data-naizo-*` aliases (`data-naizo="key"`, `data-naizo-list="name"`, etc.). Reject `naizo-data-*` because HTML5 requires custom data attributes to start with `data-`, making `naizo-data-*` as verbose as `data-naizo-*` without HTML5 validator compliance. Supporting both `naizo*` and `data-naizo*` gives humans and AI agents minimal token overhead by default while preserving strict HTML5 validity when needed.

## D09 — Repository layout (`src/`, `dist/`, `site/`, `examples/`, `skills/`) and build-emitted `dist/naizo.js`

Accepted by the owner on 2026-10-18 (superseding the root bundle and root `index.html` placement in `D06`, scheduled for `M3`–`M5`; the untracked `dist/` output is amended by `D17`, which keeps `dist/naizo.js` tracked so GitHub-tree CDN URLs stay valid). Keep the repository root clean by separating source, build outputs, website/playground, starter templates, and AI skills:

- **`src/index.ts` → `dist/naizo.js`:** Remove the tracked browser bundle from the repository root. Emit `dist/naizo.js` (standalone IIFE), `dist/index.mjs` (ESM), and `dist/index.d.mts` (TypeScript declarations) during `vp pack` (`tsdown`), and point `package.json` (`main`, `unpkg`, `jsdelivr`) to `dist/naizo.js`.
- **`site/`:** Move the interactive playground (`index.html`) into `site/` to serve both `vp dev` and the public documentation/demo website.
- **`examples/`:** Store clean, self-contained starter HTML templates (e.g., `examples/starter.html`, `examples/checklist.html`) for humans and AI agents to copy.
- **`skills/naizo/SKILL.md`:** Place the distributable consumer-facing AI skill in `skills/naizo/SKILL.md` (with reference docs in `docs/`), keeping `.agents/skills/` exclusively for repository maintenance skills (`naizo-closeout`).

## D10 — Maintainer-controlled release pipeline (`workflow_dispatch` + GitHub Release) to npm, jsDelivr, and unpkg

Accepted by the owner on 2026-10-18 (scheduled for `M7`; sequenced immediately after `M3` by `D28` to cut the initial `v0.1.0` baseline before `M4`). Keep release creation under explicit maintainer control rather than publishing on every commit to `main` (the automated version-bump/tag creation and authentication design below is superseded by `D29`):

- **Continuous Integration (`.github/workflows/ci.yml`):** Run `vp install`, `vp check`, `vp test`, and `vp pack` on pushes and pull requests without publishing.
- **Controlled Release (`.github/workflows/release.yml`):** Support both manual `workflow_dispatch` (one-click version bump `patch` / `minor` / `major` or explicit version that runs verification, tags, and creates a GitHub Release with `dist/naizo.js` attached) and `release: types: [published]` (when a release is published manually in the GitHub UI) to build `dist/` and publish the `naizo` package to npm. Publishing to npm automatically populates both `jsDelivr` (`https://cdn.jsdelivr.net/npm/naizo@latest/dist/naizo.js`) and `unpkg` (`https://unpkg.com/naizo@latest/dist/naizo.js`).

## D11 — GitHub Pages (`js.org`) documentation site with AI-agent native endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`)

Accepted by the owner on 2026-10-18 (scheduled for `M6`–`M7`). Host the project website (`site/`) on **GitHub Pages** via GitHub Actions (`actions/deploy-pages`) designed for a `js.org` custom domain (`naizo.js.org`) instead of Cloudflare Pages:

- **Why GitHub Pages over Cloudflare Pages:** `js.org` natively supports GitHub Pages CNAME targets without Cloudflare API domain-binding workarounds, keeps all CI/CD inside GitHub Actions, and avoids Cloudflare Bot Fight Mode / managed challenge blocks (`403 Forbidden`) when AI agents fetch documentation via `curl`, `WebFetch`, or `read_url_content`.
- **AI-agent native documentation:** Alongside the interactive HTML landing page and playground, publish static plain-text/Markdown endpoints at `/llms.txt` (concise agent index and quick rules), `/llms-full.txt` (complete reference + starter templates in one request), and `/SKILL.md` (direct copy of `skills/naizo/SKILL.md`).

## D12 — Explicit `naizo` / `data-naizo` binding and separation of `naizo-ignore` from `data-naizo-runtime` export stripping

Accepted by the owner on 2026-10-18 (amending `D05`, scheduled for `M4`, with milestone order amended by `D28` to run `M7` before `M4`; the `name` fallback inside items is superseded by the single-attribute key contract in `D15`, and `data-naizo-runtime` stripping is scoped to export by `D16`). Resolve the collision where `naizo-ignore` both excluded user inputs from state tracking and deleted them from saved HTML, and prevent global selector hijacking:

- **Explicit binding rule:** Standalone fields in `db.fields` must opt in explicitly via `naizo="key"`, `data-naizo="key"`, or `data-naizo-field="key"`. Inside `[naizo-item]` / `[data-naizo-item]`, tracked elements also accept `name` as a fallback key (prioritizing `name` over `id` on radio inputs). Unannotated page UI controls (search boxes, filters, custom widgets) are not implicitly captured into `db.fields`.
- **`naizo-ignore` vs. `data-naizo-runtime`:** `naizo-ignore` and `data-naizo-ignore` exclude an element (and its subtree) from `naizo.js` state binding while **preserving** the element in saved/exported HTML. Internal runtime UI injected by `naizo.js` (`.naizo-item-tools`, `.naizo-list-footer`, `#__naizodb_host__`, `#__naizodb_styles__`) is marked with `data-naizo-runtime="true"` and stripped by `getCleanHtmlString()`.

## D13 — Safe `#naizodb` serialization, unmutated disk snapshot hashing, normalized storage keys, and live `fileHandle.getFile()` sync

Accepted by the owner on 2026-10-18 (amending `D03` and `D04`, scheduled for `M4`; snapshot storage and live sync mechanics are refined by `D16`). Harden persistence and conflict resolution across browser refreshes and live AI agent disk edits:

- **Unmutated disk snapshot comparison:** In `initNaizo()`, record `naizodb_disk_hash_<key>` from the raw/canonicalized disk `#naizodb` payload _before_ `captureDomToState()` updates `_meta.updatedAt` or reformats indentation, and do not bump `_meta.updatedAt` during read-only hydration. This ensures `localStorage` browser edits survive page refreshes when the file on disk has not changed.
- **Script-safe JSON serialization:** Escape `</script` (as `<\/script`, case-insensitive) and `<!--` (as `<\!--`) when writing JSON to `<script id="naizodb" type="application/json">` so literal script tags or HTML comments in user notes never prematurely close the `<script>` tag on disk save.

> Technical correction from the fourth review (2026-10-18): the preceding `<\!--` example is not a legal JSON escape; implementing it makes `JSON.parse()` fail. Preserve the accepted script-safety intent using `JSON.stringify(value, null, 2).replace(/</g, '\\u003c')`. The replacement emits a literal JSON Unicode escape, preserves string case/content on parse, and covers script/comment opener sequences as well as closers. Implemented and verified in `src/index.ts`, `dist/naizo.js`, and `tests/naizo.test.ts` (`EC08`).

- **Normalized and scoped storage keys:** Normalize trailing `/index.html` to `/` in `location.pathname` and incorporate an optional document identifier (`<html naizo-id="...">`, `data-naizo-id`, or `_meta.id`) into `getPageKey()` and `getSnapshotKey()` to prevent cross-project `localStorage` and IndexedDB handle collisions on `localhost`.
- **Live two-way disk sync while tab is open:** When `FileSystemFileHandle` has permission, inspect `await fileHandle.getFile()` on window `focus` / `visibilitychange` and prior to `writeToDisk()`. If `#naizodb` on disk changed externally since the last snapshot, automatically hydrate the live DOM from disk instead of overwriting external AI agent edits.

## D14 — Ephemeral auto-inferred list templates (`data-naizo-auto-template`), richer element bindings, deferred attribute baking, and symmetrical `Naizo` API

Accepted by the owner on 2026-10-18 (amending `D03`, scheduled for `M4`; auto-template stripping applies only to export under `D16`, and the symmetrical API is extended by `D15`). Eliminate stale inferred list templates, DOM layout issues, and input edge cases:

- **Auto-inferred template lifecycle:** Mark runtime-inferred `<template>` nodes with `data-naizo-auto-template="true"`. When no explicit `<template naizo-template>` is authored, regenerate the auto-template from the first `[naizo-item]` on boot. In `getCleanHtmlString()`, strip `template[data-naizo-auto-template]` whenever the list contains $\ge 1$ item, and keep it only when the list has $0$ items so emptied lists preserve their item blueprint on disk.
- **Deferred DOM attribute baking:** Split live value reading (`readElementValue`) from HTML attribute baking (`bakeElementAttributes`). Run attribute baking (`setAttribute('value', ...)`, `setAttribute('checked', ...)`, `textarea.textContent = ...`) only during hydration and inside `getCleanHtmlString()` prior to HTML export/save, preventing `<textarea>` cursor jumps on live `input` events and redundant `JSON.stringify` passes in `Naizo.set()`.
- **Expanded element & list support:** Preserve numeric values (`number | null`) for `input[type="number"]` and `input[type="range"]`; support boolean `open` state on `<details naizo="key">`; support `<select multiple>`; guard non-input elements with child elements against destructive `textContent` overwrite; support `contenteditable=""`, `"true"`, and `"plaintext-only"` while ignoring `"false"`; support self-bound `[naizo-item]` elements (`<li naizo-item naizo="key">`); scope radio input `name` attributes per list item row; and place list controls in valid table DOM positions for `<table>` / `<tbody naizo-list>` / `<tr naizo-item>`.
- **Symmetrical programmatic API:** Extend `window.Naizo` (`window.NaizoDB`) with `getField(key)`, `setField(key, value)`, and `updateItem(listName, index, partialData)` alongside existing `get`, `set`, `getList`, `addItem`, `removeItem`, `moveItem`, `save`, and `exportHTML`.

## D15 — In-memory store as runtime source of truth with merge semantics, pass-through keys, and a single-attribute key contract

Accepted by the owner on 2026-10-18 (amending `D03`, `D12`, and `D14`, scheduled for `M4` before any other runtime hardening lands). The `v0.1.0` runtime treats the DOM as the source of truth: `captureDomToState()` resets `fields` and `lists` to `{}` and rebuilds them from bound elements on every save. A reproduced probe (`EC14`) showed that any JSON an agent writes without a matching DOM binding (a field with no bound element, a list with no `[naizo-list]` container, or extra item keys such as `id` or `estimate`) is destroyed on page load, which contradicts the core promise that agents edit `#naizodb` directly. Replace that model:

- **Store as truth:** `initNaizo()` builds one in-memory `NaizoDatabase` from the resolved source (disk or cache). Every read (`Naizo.get`, `getList`, `getField`) and every mutation goes through the store. The `<script id="naizodb">` text, `localStorage`, and disk are serialized views refreshed on save, never re-parsed on each access.
- **Merge, never replace:** DOM capture merges bound element values into `store.fields` and into each rendered item's source object; it does not reset `fields` or `lists`. Fields without a bound element, lists without a container, and unknown item keys pass through untouched. Each rendered `[naizo-item]` row keeps a reference to its source object (a `WeakMap`), so add, reorder, and remove preserve extra keys and let agents assign stable item identifiers without the runtime understanding them. Key removal is always explicit (`Naizo.deleteField(key)`, `Naizo.removeItem`).
- **Single-attribute key contract:** The binding key is exclusively `naizo="key"`, `data-naizo="key"`, or `data-naizo-field="key"`, both outside and inside `[naizo-item]`. Drop the `id`, `name`, and `field_${idx}` fallbacks entirely (superseding the `name` fallback inside items from `D12`). Unannotated inputs are never captured, and keys never shift when markup changes (`EC11`).
- **Change-only metadata and debounced capture:** Bump `_meta.updatedAt` only when the serialized `fields`, `lists`, or `custom` differ from the previous serialization; hydration and boot never bump it (`EC06`). Debounce DOM capture itself (about 150 ms), not only the disk write, and flush synchronously on `pagehide` and `visibilitychange: hidden` so no edit is lost on tab close (`EC16`). Attribute baking runs only during hydration and export (`D14`).
- **Preserve unknown values:** When a stored value has no matching `<option>` in a bound `<select>`, keep the stored value and log a warning instead of coercing it to `""` on the next save (`EC15`).

## D16 — Surgical `#naizodb` block writes for disk sync; full-document serialization only for `Naizo.exportHTML()`

Accepted by the owner on 2026-10-18 (amending `D03`, `D04`, `D05`, `D12`, and `D13`, scheduled for `M4`). Writing `document.documentElement.outerHTML` back to disk re-serializes the whole document from the live DOM: formatter output is rewritten, runtime mutations by user scripts are persisted, every injected control must be tracked and stripped, and the body and the JSON become two competing copies of the same data (`EC03`, `EC07`, `EC09`, parts of `EC12`). Replace that with a surgical write:

- **Disk sync writes only the JSON block:** `writeToDisk()` reads the current file text through `fileHandle.getFile()`, locates the first `<script id="naizodb" ...>…</script>` block (case-insensitive, tolerant of attribute order and quoting), replaces only its inner text with the escaped serialized store (`D13`), and writes the result. When no block exists, insert one immediately after the opening `<head>` tag. Every other byte of the file stays identical, so Git diffs show only data changes and formatters never fight the runtime.
- **Body is the template, JSON is the data:** Baked attributes and rendered list rows in the body are not updated on disk by sync. Document this contract for humans and agents in `AGENTS.md`, `README.md`, and `docs/USAGE.md`: edit `#naizodb` to change data; edit markup to change the view. Runtime UI stripping (`data-naizo-runtime`, `D12`) and auto-template stripping (`D14`) apply only to `Naizo.exportHTML()` and to the Blob-download fallback, which has no original file text and therefore keeps full serialization as an explicit snapshot mode.
- **Read-before-write is the live-sync check:** Because every write reads the file first, external edit detection (`EC10`) falls out of the same path: if the on-disk block differs from the last known snapshot, hydrate from disk (or raise a conflict) instead of overwriting. The `focus` / `visibilitychange` check from `D13` reuses the same comparison.
- **Conflicts are visible and recoverable:** When cache, disk, and snapshot all differ, disk still wins by default (`D04`), but the discarded browser state is kept under `naizodb_backup_<key>` and the status pill announces the conflict with a restore action instead of discarding silently (`EC17`).
- **Snapshot is a hash:** `naizodb_disk_hash_<key>` stores a cheap synchronous string hash of the canonical JSON rather than a second full copy, halving `localStorage` usage per document.
- **Unlink:** The status pill offers an unlink action that forgets the persisted `FileSystemFileHandle` so a wrongly linked file can be corrected without clearing IndexedDB by hand.

> Fourth-review constraint (2026-10-18): the byte-preservation and conflict-detection promises above need explicit limits before implementation. A reproduced `Blob.text()` → UTF-8 encode round trip removed a UTF-8 BOM (9 input bytes → 6 output bytes). Preserve original bytes outside the selected block, or explicitly narrow supported encodings. Read-before-write is not an atomic comparison-and-write against an external editor; retain this as an unresolved acceptance constraint in `PLAN.md`, not a concurrency guarantee.

## D17 — Track the built `dist/naizo.js` artifact with a CI freshness check

The consumer CDN URL recommendation is superseded by `D34`; `D35` moves tracked-bundle updates into release preparation and narrows freshness enforcement to release PRs and tagged publication.

Accepted by the owner on 2026-10-18 (amending `D09`, scheduled for `M3`). `D09` ignores `dist/` in Git while `AGENTS.md` and `README.md` point consumers and agents at a jsDelivr `gh` URL, which serves files from the Git tree and would return `404` once the root bundle is removed. Resolve the contradiction by tracking the single built browser artifact:

- Un-ignore `dist/naizo.js` only; keep `dist/index.mjs` and `dist/index.d.mts` untracked and built on demand.
- Build `dist/naizo.js` from a dedicated IIFE entry (`src/iife.ts`) that imports the core and sets `window.Naizo` / `window.NaizoDB` without exporting a bundle namespace global (removes the stray `NaizoBundle` global).
- CI (`M7.1`) runs `vp pack` and fails when `dist/naizo.js` differs from the committed copy; `package.json` gains a `prepublishOnly` build so npm never ships a stale `dist/`.
- Consumer URLs become `https://cdn.jsdelivr.net/gh/<owner>/naizo@main/dist/naizo.js` for the Git tree and `https://cdn.jsdelivr.net/npm/naizo@latest/dist/naizo.js` after the first npm release (`D10`).

## D18 — Single data namespace with a schema version (rejected by `D27`)

**Status: Rejected by the owner on 2026-10-18 (`D27`).** Proposed by the third source review to flatten `{ _meta, fields, lists, custom }` into one root namespace. Rejected because the four top-level buckets (`_meta`, `fields`, `lists`, `custom`) are self-documenting for AI coding agents inspecting `<head>` and prevent key collisions between scalar bindings, list repeaters, and custom widget state (`D03`, `D15`).

## D19 — Stable list item identity (rejected by `D27`)

**Status: Rejected by the owner on 2026-10-18 (`D27`).** Proposed by the third source review to inject compulsory auto-generated `id` strings into every list item object. Rejected to keep user and agent JSON in `#naizodb` clean and unpolluted; `D15`'s `WeakMap` maps rendered `[naizo-item]` rows to their source objects in memory and preserves any agent-authored `id` or extra keys untouched.

## D20 — Retain the base snapshot for three-way JSON merge (IndexedDB merge-base DB rejected; lightweight key-level merge adopted in `D27`)

**Status: Narrowed by the owner on 2026-10-18 (`D27`).** The third source review proposed storing a full merge-base JSON database in a second IndexedDB store (`NaizoDB_Base`) and running a recursive list-item ID merge engine. That heavy IndexedDB + list-item merge engine is **rejected** (`D27`). Instead, when an active session detects an external disk update (or when `base`, `ours`, and `theirs` are available), `naizo.js` performs a lightweight (~15-line) shallow top-level key merge across `fields`, `lists`, and `custom` so concurrent edits to different keys both survive, while backing up same-key collisions to `naizodb_backup_<key>` with a 1-click **`↺ Restore`** action (`D16`, `EC17`).

## D21 — Event-targeted capture and explicit `Naizo.bind(root)`

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`, amending `D15`).** A debounced full-document scan rereads every bound element: with duplicate keys the last element wins (`EC19`), elements rendered after boot overwrite stored values with their defaults (`EC20`), and each edit costs `O(n)` (`EC16`).

- Attach delegated `input` / `change` / `click` listeners synchronously on boot before awaiting IndexedDB handle lookup (`EC34`).
- On `input` / `change`, resolve the binding of `event.target` (scalar key or list item row + property) and update only that entry in the in-memory store (`O(1)`), and only when its normalized value changed (`EC25`).
- Propagate scalar updates to any other element bound to the same key (`EC19`).
- Expose `Naizo.bind(root?)` to hydrate bound elements added dynamically after boot (without an unconditional document-wide `MutationObserver` or reading defaults over stored values, `EC20`).
- Debounce only persistence (`localStorage`, `#naizodb` DOM text, and queued disk write) and flush cache/DOM synchronously on `pagehide` / `visibilitychange: hidden`.

## D22 — Plain-text `contenteditable` storage by default

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`).** Hydrating stored strings through `innerHTML` turns data into executable markup (`EC18`) and pollutes agent-readable JSON with browser editing artifacts (`&nbsp;`, `<br>`, `<div>`).

- `contenteditable` bindings read and write plain text (`textContent`) by default.
- The proposed built-in HTML allowlist sanitizer (`naizo-html`) is **rejected** (`D27`) to keep the runtime small and avoid shipping a custom XSS sanitizer.

## D23 — Bake attributes only on the export clone

**Status: Accepted by the owner on 2026-10-18 (`D27`, amending `D14`).** Under `D16`, disk sync rewrites only the `<script id="naizodb">` block and never serializes `<body>`, so mutating `value`, `checked`, `selected`, or `<textarea>` text on the live DOM has no consumer outside `Naizo.exportHTML()` and breaks native `form.reset()` defaults (`EC12`). Bake attributes only on the cloned document inside `getCleanHtmlString()` prior to HTML snapshot export or Blob download.

## D24 — Write safety: single-flight write queue, payload snapshots, and safe block replacement

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`, amending `D16`).**

- Serialize disk writes through a single-flight queue; coalesce edits made while a write is in flight into the next write (`EC26`).
- Derive `naizodb_disk_hash_<key>` from the exact JSON payload written to disk, never from live state after `writable.close()` resolves (`EC26`).
- Preserve a leading UTF-8 BOM (`\uFEFF`) when replacing `<script id="naizodb">` on disk, and refuse to overwrite or inject `#naizodb` into an existing selected file that does not already contain `<script id="naizodb">` unless the user confirms (`EC28`).

## D25 — Side-effect-free ESM entry and modular internals (adapter platform rejected by `D27`)

**Status: Narrowed by the owner on 2026-10-18 (`D27`, amending `D06` and `D17`).**

- **Accepted:** Keep `dist/index.mjs` (ESM) side-effect free while `src/iife.ts` (`dist/naizo.js`) auto-starts on load and sets `window.Naizo` / `window.NaizoDB` (`EC37`). Allow clean internal helper modules in `src/` and re-initialization/teardown support for testing.
- **Rejected (`D27`):** Reject a public persistence adapter plugin API, multi-root `createNaizo({ root, adapter, clock })` DI container, `npx naizo serve` local backend server, and fetching `location.href` over the network during export.

## D26 — Lightweight, fast, low-ceremony product priority

Accepted by the owner on 2026-10-18. `naizo.js` must remain a light, fast tool with minimal authoring ceremony (`D06`):

- Favor simple defaults, a small public API, ordinary HTML/JSON, and optional escape hatches. Runtime validation protects data integrity and supported binding shapes (`EC04`, `EC33`); it is not an application-schema system.
- Prefer removing repeated DOM/serialization work (`D15`, `D21`, `D23`) over adding framework machinery. Preserve dual attributes (`D08`), unknown JSON data (`D15`), inferred templates (`D14`), and custom-widget integration.

## D27 — Final lean architecture, truthful status pill UX (`Naizo.copyJSON()`), and review consolidation

Accepted by the owner on 2026-10-18 (consolidating `D12`–`D26` for `M3` and `M4`; milestone execution order amended by `D28` to run `M7` before `M4`). Following five rounds of source and architecture review plus ecosystem viability analysis, lock the final global architecture of `naizo.js` as a fast, minimalist (~4–5 KB min+gzip) drop-in runtime for local HTML mini-apps and AI agent workflows:

1. **Canonical 4-bucket schema (`D03`, `D15`; rejecting `D18` & `D19`):** Keep `<script id="naizodb" type="application/json">` structured as `{ _meta, fields, lists, custom }` with `Object.hasOwn()` lookups (`EC24`, `EC38`). Unbound fields, unbound lists, and extra list-item keys (including optional agent-authored `id`) pass through untouched via an in-memory store and row `WeakMap`.
2. **Synchronous boot, `O(1)` event capture, and export-only baking (`D15`, `D21`–`D23`; `EC16`, `EC18`–`EC20`, `EC32`, `EC34`):** Install the full resolved state (`_meta`, `fields`, `lists`, `custom`) into the in-memory store, hydrate the DOM, and attach delegated `input`/`change`/`click` listeners synchronously before awaiting IndexedDB handle lookup. Update only the changed binding on edit (`O(1)`), default `contenteditable` to plain text (`textContent`), and bake HTML attributes only on the export clone in `Naizo.exportHTML()`.
3. **Safe surgical `#naizodb` disk sync + zero-server `file.lastModified` live watch (`D13`, `D16`, `D24`; narrowing `D20`, rejecting `D25`):**
   - Queue disk writes single-flight (`EC26`), escape `<` as `\u003c` in serialized JSON (`EC08`), read-before-write via `fileHandle.getFile()` (`EC10`), replace only the `<script id="naizodb">` block on disk (preserving a leading UTF-8 BOM and refusing to overwrite unrelated files lacking `#naizodb` without confirmation, `EC28`), and record the snapshot from the exact written payload. On broken startup JSON (`EC04`), surface an error state and block auto-write until recovered.
   - **Live side-by-side disk watch (`EC10`, `EC17`):** When a granted `FileSystemFileHandle` is active and `document.visibilityState === 'visible'` (with no write in flight), check `(await fileHandle.getFile()).lastModified` every ~2 seconds in addition to `focus` / `visibilitychange` checks. When `lastModified` changes externally (e.g., an AI agent edits `#naizodb` on disk while the browser is open side-by-side), read `#naizodb` and perform a shallow top-level key merge (`fields[k]`, `lists[k]`, `custom[k]`) against the last disk state so unrelated human edits in the browser and agent edits on disk both survive; guard `document.activeElement` against mid-keystroke overwrite; and on same-key collision, let disk win while saving the pre-merge browser state to `naizodb_backup_<key>` with a 1-click **`↺ Restore`** button in the status pill.
4. **Truthful status pill UX + 1-click `📋 Copy JSON` (`EC17`, `EC36`):**
   - Show an **amber** status (`Browser Cache · Click to Link Disk`) whenever edits exist in browser cache that have not been written to the linked disk file, and show **green** (`Synced to Disk`) only after `writable.close()` completes for the current revision (`EC36`).
   - Include a 1-click **`📋` Copy JSON** action (`Naizo.copyJSON()`) on the pill to copy `#naizodb` JSON to the clipboard for instant AI chat/CLI round-tripping (especially on Safari/Firefox or unlinked `file://` pages), alongside **`×` Unlink** (`Naizo.unlink()`) and **`↺` Restore** from `naizodb_backup_<key>` when external disk edits supersede cached browser edits (`EC17`).
   - Make `Naizo.save()` return `Promise<boolean>` indicating whether disk sync (or cache flush when unlinked) succeeded.
5. **Reject out-of-scope framework ceremony (`EC27`, `EC39`, `EC40`):** Reject multi-tab `BroadcastChannel` / `Web Locks` protocols (`EC27`; use a lightweight `storage` event listener at most), automatic DOM `id` / `for` rewriting in list templates (`EC39`; recommend wrapping `<label>` in docs/examples), and custom row widget frameworks (`EC40`; emit `naizo:hydrate` / `naizo:change` and use event delegation).

## D28 — Advance `M7` (CI/CD & release workflows) before `M4` to cut the initial `v0.1.0` baseline and emit `dist/naizo.min.js`

The separate `pages.yml` deployment is superseded by `D37`, which deploys GitHub Pages from CI-verified `main`.

Accepted by the owner on 2026-10-19 (amending milestone sequencing in `D10`, `D12`, `D17`, and `D27`). With `M0`–`M3` complete (`src/index.ts`, `src/iife.ts`, tracked `dist/naizo.js`, `site/index.html`, `examples/`, and passing Vite+ checks/tests), execute `M7` (`M7.1`–`M7.2` CI verification, GitHub Pages deployment, and maintainer-controlled release workflows) immediately after `M3` before applying `M4` runtime changes:

- **Why:** Shipping the current working library as the initial `v0.1.0` milestone establishes automated CI (`vp check`, `vp test`, `vp pack`, `dist/naizo.js` freshness check), live GitHub Pages deployment for `site/`, and a verified `v0.1.0` tag / npm / CDN baseline (`jsDelivr`, `unpkg`) before `M4` re-architects the core runtime for the next `0.x` release (`v0.2.0`).
- **Build-emitted `dist/naizo.min.js` (`minify: true`):** Add a minified browser IIFE output (`dist/naizo.min.js`, ~4.7 KB min+gzip) to `vite.config.ts` (`vp pack`) and `package.json` `exports` while keeping only readable `dist/naizo.js` tracked in Git (`D17`). This preserves clean Git diffs while shipping pre-minified `dist/naizo.min.js` to npm, `unpkg`, `jsDelivr`, GitHub Pages, and GitHub Releases.
- **Decoupled `M7.1` / `M7.2` execution:** `.github/workflows/ci.yml` runs the current `vp test` suite (which automatically picks up `M4.4` expansions later); `.github/workflows/pages.yml` deploys `site/` with `dist/naizo.js`, `dist/naizo.min.js`, and `examples/` now (and automatically serves `/llms.txt`, `/llms-full.txt`, `/SKILL.md`, and `CNAME` when `M6.2` lands); and `.github/workflows/release.yml` supports `current` / explicit `0.1.0` on `workflow_dispatch` (attaching both `dist/naizo.js` and `dist/naizo.min.js`) so the initial `v0.1.0` release can be cut when `package.json` is already at `0.1.0`.

## D29 — Prepared version tags, npm Trusted Publishing, and isolated release permissions

Adopted 2026-10-19 under the owner's request to modernize CI/CD and document the first `0.1.0` publication. Supersedes the one-click version bump, automated version commit/tag creation, and token-based publishing implementation in `D10` / `D28`; preserves their maintainer-controlled manual/GitHub Release triggers, milestone sequence, and distribution outputs. Environment pin storage and build-job setup are subsequently refined by `D30`.

- Use Node 24, pnpm 9.15.9, and reviewed action commit pins across CI, Pages, and releases; weekly Dependabot updates maintain the action pins. Grant Pages deployment permissions only to its deployment job.
- Release stable, already prepared version tags. Require package version equality, membership in the primary branch's history, and equality between the workflow run's source commit and the tagged commit so npm provenance identifies the source actually built. Version changes follow ordinary repository review before release execution.
- Verify and pack with read-only repository access and no release dependency cache. Audit an explicit seven-file npm distribution allowlist. Transfer the built tarball by artifact ID to a separate npm 11 OIDC publishing job, with project dependency installation and lifecycle scripts absent from that job. Grant repository write permission only to the final GitHub Release asset job.
- Fail on registry failures or an existing version with different integrity; retries skip only byte-identical versions. Authentication failures are errors, replacing the earlier missing-token success path.
- Bootstrap the package with one interactive local publication and 2FA, then use npm Trusted Publishing for subsequent versions. The publishing guide documents the npm package/account configuration, publisher expiry, bootstrap switch, and local first-publication provenance limitation. Live account/runner validation remains separate from local verification evidence.

## D30 — Project-pinned VP environment and VP-first local development

Adopted 2026-10-19 under the owner's request to pin the project's Node/pnpm environment and mainly use VP locally. Refines `D06` and `D29` without changing runtime/library support requirements or release privilege isolation. The pnpm 9 pin and associated lockfile policy are superseded by `D31`.

- Declare exact development pins: Node 24.22.0 in `.node-version`, pnpm 9.15.9 in `package.json#packageManager`, and Vite+ 1.3.0 as an exact development dependency. Keep the lockfile generated by the selected pnpm version; the pnpm normalization changes no resolved package versions. These are contributor-toolchain pins, not consumer-facing `engines` restrictions.
- Use global `vp` for installation, checks, tests, builds, and environment-aware scripts (`vp node`). VP reads project declarations; `vite.config.ts` continues to own tool configuration. Update project pins with `vp env pin`, preserving user-global defaults. Native npm remains appropriate for registry-specific authentication, packing, and publication.
- CI, Pages, and release builds use a reviewed, commit-pinned `voidzero-dev/setup-vp`, reading the Vite+ dependency and `.node-version` rather than duplicating version literals. Dependency installation remains an explicit `vp install --frozen-lockfile` step; release caching stays disabled. The separate publishing job reads `.node-version` with `setup-node` and retains npm OIDC without project dependency installation.
- Document the same local commands in `AGENTS.md`, `README.md`, and `docs/PUBLISHING.md`; use `vp env current` / `vp env doctor` to verify resolution. Local validation does not replace live execution of the updated CI action.

## D31 — pnpm 12.14.0 through VP with explicit environment ownership and lockfile policy

Accepted by the owner on 2026-10-19 to upgrade pnpm through VP while retaining Node 24.22.0, refreshing configuration/lockfile/docs, and verifying the toolchain. Supersedes the pnpm 9.15.9 pin in `D30`; preserves Node 24.22.0, Vite+ 1.3.0, VP-first development, and isolated npm OIDC publishing.

- Pin `pnpm@12.14.0` in `package.json` using `vp env pin`. Keep all existing dependency versions; the lockfile refresh records pnpm 12 platform and peer-context normalization rather than dependency upgrades.
- Add single-package `pnpm-workspace.yaml` with `runtimeOnFail: ignore` and `pmOnFail: ignore`, as recommended by VP, so pnpm does not independently provision or switch the environment. Keep user-global defaults unchanged.
- Enable `lockfile.includeResolutionSettings: true` and record the resolution policy in `pnpm-lock.yaml`; frozen installs reject incompatible policy. The pinned pnpm supports this setting. Preserve pnpm's default build-approval protections; the current graph installs successfully without adding script approvals.
- CI already reads project pins and configuration through `setup-vp`, so no duplicated workflow version update is needed. Keep the npm 11 publication job separate. Update active contributor and publishing documentation while retaining earlier journal/decision entries as historical evidence.

## D32 — Explicit Release Please preparation and recoverable tagged OIDC publication

Accepted by the owner on 2026-10-19. Supersedes `D29`'s manual version preparation policy and seven-file distribution allowlist; preserves isolated npm Trusted Publishing, exact tagged source verification, the manual first-version bootstrap, and `D30` / `D31` toolchain pins.

- Use Release Please 17.11.2 in a private tooling package with its own npm lockfile, installed with lifecycle scripts disabled under VP-managed Node. Keep it outside root/runtime dependencies and the npm distribution. Generated release commits retain factual Conventional Commit bodies for both creation and refresh.
- Ordinary pushes check merged release PRs without creating or refreshing a PR. A manual preparation request or a valid stable `Release-As:` footer in the newly introduced commit range explicitly prepares/refreshes one root Node release PR. The manifest starts at `0.1.0`; preparation requires the manual npm/GitHub bootstrap. Before `1.0.0`, fixes bump patch and features/breaking changes bump minor; stable explicit overrides can select `1.0.0`. A no-op request produces no PR.
- Merging the reviewed release PR creates a plain stable version tag immediately and a draft GitHub release. Resolve the actual tag ref (including annotated tags), validate its exact commit and ancestry, then explicitly dispatch `release.yml` at the tag with the expected SHA. This bypasses normal bot-event suppression without introducing a PAT, GitHub App, or npm token. Preparation has repository/PR/label/workflow writes and no npm identity; only the npm publishing job receives npm OIDC permission.
- Keep uncached release verification and one transferred tarball. Add `CHANGELOG.md` to the eight-file public distribution. Check manifest, actual tarball integrity, bundle bytes, source/version identity, and any already published npm integrity. Publish the GitHub draft only after npm success or identical-version confirmation, preserving its notes. The local bootstrap bypass is limited to `v0.1.0` and confirms that the npm package already exists.
- An unfinished stable draft blocks new preparation and directs explicit tag recovery. Recovery revalidates the existing release/tag/commit; matching assets are reused, missing assets uploaded, and conflicting assets fail without overwrite. Retain the direct tagged workflow and manually published GitHub Release entry points. Later ordinary changes do not refresh an open release PR, so maintainers explicitly refresh before merging when they want updated notes/version selection.
- GitHub Actions PR creation settings, bot workflow approvals, npm publisher configuration, and live integration remain owner-managed rollout actions. Local fixture/updater tests do not establish remote permission or OIDC success. Publication state remains owned by GitHub Releases/tags and npm.

## D33 — Versionless source headers and generated distribution comments

`D35` subsequently replaces the requirement to commit a rebuilt bundle with each source change; the versionless-header policy remains in effect.

Accepted by the owner on 2026-10-19. Refines `D17` / `D32`: omit hardcoded package versions from the headers in `src/index.ts` and `src/iife.ts`, including their generated distribution comments. Package metadata, changelog entries, and version tags identify releases; documentation and test labels may still identify feature targets or compatibility.

- Keep package versions out of generated banners so a Release Please metadata/changelog bump does not require a source-header edit or bundle commit. Source, build configuration, or dependency changes that affect output still require `vp pack` and the tracked readable bundle in the same reviewed change.
- Preserve the tracked `dist/naizo.js` artifact and existing CI/release freshness check. Rebuild readable/minified browser bundles, ESM, and declarations from the tagged source; publication does not commit generated files back to Git.

## D34 — npm-backed jsDelivr/unpkg URLs for release-driven CDN updates

Accepted by the owner on 2026-10-19. Supersedes `D17`'s GitHub-backed consumer CDN recommendation and refines `D10` / `D32` distribution guidance. Keep the tracked readable artifact, source synchronization, and freshness checks from `D17` / `D33`.

- Use `https://cdn.jsdelivr.net/npm/naizo@latest/dist/naizo.js` as the default documented CDN URL and `https://unpkg.com/naizo@latest/dist/naizo.js` as the alternative. Use one provider per page; the prebuilt minified counterpart is `dist/naizo.min.js` on either provider.
- Publishing the verified npm tarball makes the bundles available to these CDNs. Floating `@latest` URLs follow npm releases as caches refresh; exact versions keep artifacts fixed. Source changes or CI builds alone do not update CDN-served npm files, and the referenced package/version must exist on npm. Keep relative local paths for development and offline use.
- Align README, consumer agent instructions, product distribution guidance, and the publishing guide. Retain historical GitHub-backed URLs in the decision log as superseded context, rather than rewriting prior decisions. No CDN upload step or release-time bundle commit is introduced.

## D35 — Generate the tracked browser bundle in explicit release PR preparation

Release-PR freshness enforcement through CI is superseded by `D37`: bot-created release PRs receive no CI run, so the preparation build job is their verification, and tagged publication retains the freshness check.

Accepted by the owner on 2026-10-19. Supersedes `D17` / `D33` / `D34`'s requirement to synchronize the tracked readable bundle in ordinary source changes. Preserve explicit preparation, plain tags, versionless headers, npm-backed CDN distribution, and isolated OIDC publication.

- Keep `dist/naizo.js` tracked, but refresh it in the Release Please PR alongside package metadata, manifest, and changelog. Ordinary source changes need no generated bundle commit. Local development, regular CI, and release builds run `vp pack` before tests so browser-bundle tests use current source; local demo commands also build first. Other distribution outputs remain untracked.
- Split preparation into merge/recovery/planning, a read-only project build/test job, and a PR-writing job that installs only locked isolated tooling without lifecycle scripts. Transfer only the generated readable bundle by immutable artifact ID, with both downstream checkouts pinned to the planned source commit. Project builds receive no repository write token or npm identity; the publisher remains `release.yml` with its existing OIDC isolation.
- Require the checkout and current primary-branch SHA to match the planned bundle source before scheduling and around PR writes. If the branch advances, fail with an explicit refresh instruction; the existing PR must be refreshed and verified before merge. Retain the tagged commit/source/version and ancestry checks during publication.
- Use Release Please's `always-update` option so explicit refreshes replace the bundle even when release notes are unchanged. Ordinary pushes still only check merged release PRs; no-op requests produce no PR or bundle job. The post-build stage only prepares PRs and cannot create a release/tag or dispatch publication.
- Regular CI builds/tests without a tracked-file comparison. The Release Please PR and tagged publisher enforce readable-bundle freshness; publication never repairs or commits a bundle after tagging. Manual bootstrap or manually prepared tags must contain their rebuilt readable bundle before tagging. The committed bundle can lag current source between releases, while npm/CDN releases contain freshly verified outputs.

## D36 — Retain the unscoped package name and request npm review (superseded by `D38`)

Superseded by `D38`, which renames the project, package, and runtime contracts to `naizo` / `naizo.js`.

Accepted by the owner on 2026-10-19 after npm rejected the earlier unscoped package name as too similar to `kafkajs`. Retain the intended package identity and its CDN URLs; request npm Support review before considering a rename. This does not supersede the release automation or authentication decisions.

- A registry lookup returning `E404` does not establish permission to register a name; npm can enforce similarity policy when publication is attempted. Authentication success does not establish publication success.
- Treat this rejection as an external naming-policy dependency. Token changes, version bumps, or CI changes do not resolve it. npm decides whether a review permits the unscoped name; a replacement identity requires an explicit owner choice and coordinated metadata, release-guard, and documentation changes.
- Bootstrap instructions require successful npm publication and registry confirmation before tagging. Retry from a clean, verified source and newly packed tarball when source or package contents have changed.

## D37 — CI-gated Pages from `main` and accurate release-PR verification

Accepted by the owner on 2026-10-21 after a CI/CD review. Refines `D28`, `D29`, `D32`, and `D35`; preserves the tracked readable bundle refreshed in every Release Please PR, explicit preparation (no PR refresh on ordinary pushes), GitHub Release assets (`naizo.js`, `naizo.min.js`, tarball), and isolated npm OIDC publication.

- **Pages serves CI-verified `main`.** Deploy from a `ci.yml` job that runs only after verification succeeds on `main` (push or manual dispatch), reusing the bundles CI just built and tested; remove `pages.yml`. Do not deploy Pages from `release.yml`: npm trusts that workflow file, so it keeps the npm publishing job as its only `id-token: write` holder. A released-version site can be reconsidered when the site becomes primary documentation for a stable `1.x`.
- **Release PRs receive no CI run.** GitHub does not start workflows for events caused by `GITHUB_TOKEN`, so the CI step that compared the release-branch bundle could never run. Remove it; the preparation bundle job (read-only build/check/test at the exact source) verifies the PR, and tagged publication enforces freshness. A GitHub App token would be required for real release-PR checks and is out of scope.
- **Trim release-job redundancy.** Release tooling tests run in CI only; the preparation bundle and tagged release build jobs verify artifacts. The npm publishing job uses the npm bundled with pinned Node 24.22.0 (npm 11.x, above the 11.5.1 OIDC minimum) instead of installing a floating `npm@11` while holding OIDC identity. The tagged workflow's `tag` input has no default.
- **Reduce release-tool coupling.** Recognize `Release-As:` footer requests with the existing stable-version regex instead of Release Please's internal commit parser; Release Please still decides whether a footer changes the version. Share the stable-tag pattern, release branch name, and npm bootstrap existence check from the dependency-free `github.cjs` helper.
- **Draft stale release PRs.** Because no CI runs on the release PR, nothing prevented merging a PR prepared before `main` advanced; its stale bundle then failed tagged publication after the tag existed (`EC45`). On pushes that create no release, preparation compares `main` with the release branch and converts a behind PR to draft using the existing `pull-requests: write` permission. Only an explicit refresh that passes the source guards marks it ready. This keeps explicit preparation (content is never refreshed by ordinary pushes) and needs no PAT, status check, or branch protection. Manually readying a drafted PR is a deliberate override; recovery then requires a new version rather than moving the tag.

## D38 — Rename project, package, and runtime contracts to `naizo` / `naizo.js`

The npm package name and npm-backed CDN package segment in this decision are superseded by `D39` (`naizojs`); the project, repository, browser bundle filenames, and runtime contracts remain unchanged.

Accepted by the owner on 2026-10-21. Supersedes `D36` and updates the naming across `D01`–`D37` while preserving all architectural, persistence, build, and release invariants.

- **Name & Japanese dual meaning:** Rename the project to **`naizo`** (`naizo.js`), from the Japanese **_naizō_ (ないぞう)**, uniting its two homophonous meanings in the README and product documentation:
  - **内蔵 (_naizō_ — built-in / embedded / housed within):** the canonical in-file JSON micro-database `<script id="naizodb" type="application/json">` embedded inside `<head>`.
  - **内臓 (_naizō_ — internal organs / viscera):** the reactive runtime bindings, list repeater, and two-way disk synchronization that give static HTML markup living internal organs.
- **Package, repository, and bundle identity:** Set npm package name to `naizo` (`https://github.com/nickosh/naizo`), tracked readable browser bundle to `dist/naizo.js`, minified bundle to `dist/naizo.min.js`, and npm-backed CDN URLs to `https://cdn.jsdelivr.net/npm/naizo@latest/dist/naizo.js` and `https://unpkg.com/naizo@latest/dist/naizo.js`.
- **Runtime, DOM, and API contracts:** Use `#naizodb`, attributes `naizo` / `naizo-*` and `data-naizo` / `data-naizo-*`, global API `window.Naizo` / `window.NaizoDB` (`initNaizo`, `NaizoDatabase`, `NaizoAPI`, `naizo:hydrate`), runtime DOM/storage identifiers (`__naizodb_host__`, `__naizodb_styles__`, `NaizoDB_Handles`, `naizodb_state_*`, `naizodb_disk_hash_*`), and the maintainer closeout skill `.agents/skills/naizo-closeout/SKILL.md`.

## D39 — Use `naizojs` as the unscoped npm package name while keeping the project, repository, and bundle names as `naizo`

Accepted by the owner on 2026-10-21 after npm rejected `PUT https://registry.npmjs.org/naizo` with an `E403` similarity error against `nano`. Supersedes the npm package name and npm-backed CDN package segment in `D34` and `D38`; preserves the project name (`naizo`), repository (`nickosh/naizo`), browser bundle filenames (`dist/naizo.js`, `dist/naizo.min.js`), and all runtime/DOM/API contracts from `D38`.

- **npm package & CDN URLs:** Set `package.json#name` to `naizojs`, generating `naizojs-<version>.tgz` tarballs and serving npm-backed CDN bundles from `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js` and `https://unpkg.com/naizojs@latest/dist/naizo.js` (with `dist/naizo.min.js` for the prebuilt minified bundle). `naizojs` is unoccupied on npm and avoids the `nano*` similarity collision because `nanojs` does not exist on the registry.
- **Release tooling alignment:** Update `confirmNpmBootstrap` (`https://registry.npmjs.org/naizojs/0.1.0`) and `releaseBranch` (`release-please--branches--main--components--naizojs`) in `.github/release-tools/github.cjs` to match Release Please's root Node package branch derivation.
- **Project and runtime identity unchanged:** Keep the project and GitHub repository named `naizo` (`https://github.com/nickosh/naizo`), emitted bundle paths `dist/naizo.js` and `dist/naizo.min.js`, `#naizodb`, `naizo` / `data-naizo` attributes, and `window.Naizo` / `window.NaizoDB`.
