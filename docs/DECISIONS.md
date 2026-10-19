# nakajs — Decision Log (ADR-style)

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
- `.agents/skills/nakajs-closeout/SKILL.md` as the repository-scoped maintainer closeout skill.

Keep delivery bookkeeping (branch names, commit SHAs, PR numbers/states, push/pull/merge steps, and CI run/job IDs) and manual release-status markers out of project memory documents; Git history and GitHub Releases/tags own those states.

## D02 — Local auto-commit workflow with descriptive Conventional Commits

Accepted by the owner on 2026-10-18. After completing and verifying each coherent change (including documentation changes) and reconciling project memory, create a local commit automatically without asking again unless the user explicitly requests otherwise.

Every commit must use a Conventional Commit subject (`type(scope): subject`, with scope optional when unhelpful) followed by a blank line and a factual body explaining what changed, why, and any relevant limitations. Subject-only commits are not permitted. Validation output and unrun-check details belong in closeout documentation and chat rather than commit bodies. Pushing, tagging, publishing, or opening pull requests always require separate explicit owner approval.

## D03 — Embedded `<script id="nakadb" type="application/json">` as canonical in-file database

Adopted 2026-10-18 (serialization escaping amended for `M4` by `D13`; deferred attribute baking amended for `M4` by `D14`). Rather than storing state only in browser storage or scattering state solely across DOM attributes, `naka.js` maintains a canonical JSON document inside `<script id="nakadb" type="application/json">` at the top of `<head>` with four top-level keys: `_meta`, `fields`, `lists`, and `custom`. Simultaneously, `readAndBakeElement()` bakes scalar values into standard HTML attributes (`value`, `checked`, `selected`, `textContent`). This gives AI coding agents a single structured JSON block at the top of the file to read and mutate while keeping the raw HTML markup self-contained.

## D04 — Dual-layer persistence with snapshot-based disk vs. browser conflict resolution

Adopted 2026-10-18 (snapshot timing, storage key normalization, and live `fileHandle.getFile()` sync amended for `M4` by `D13`). Every user edit immediately caches state in `localStorage` (`nakadb_state_<pathname>`) and schedules a debounced (250 ms) disk write via the File System Access API (`FileSystemFileHandle` persisted in IndexedDB `NakaDB_Handles`). Whenever `naka.js` writes to disk or hydrates from disk, it records the raw `#nakadb` string in `localStorage` under `nakadb_disk_hash_<pathname>`. On boot, if the current `#nakadb` text in the HTML file differs from `nakadb_disk_hash_<pathname>`, `naka.js` detects that an external process (such as an AI agent or text editor) modified the file on disk and hydrates from the disk state instead of the browser cache.

## D05 — Runtime UI isolation via Shadow DOM and `naka-ignore` / `data-naka-ignore`

Adopted 2026-10-18 (separation of `naka-ignore` state exclusion from `data-naka-runtime` export stripping amended for `M4` by `D12`). The floating status/sync pill (`#__nakadb_host__`) mounts inside an open Shadow DOM root so its styles never collide with the host document. Auto-injected list stylesheet (`#__nakadb_styles__`), per-item action toolbars (`.naka-item-tools`), and list footers (`.naka-list-footer`) are marked with `naka-ignore="true"`. Before writing HTML back to disk or returning from `Naka.exportHTML()`, `getCleanHtmlString()` clones `document.documentElement` and strips `[naka-ignore], [data-naka-ignore], #__nakadb_host__, #__nakadb_styles__` so runtime controls never accumulate in saved files.

## D06 — TypeScript core in `src/` with Vite+ (`vite-plus`) toolchain and root `naka.js` IIFE

Amended by the owner on 2026-10-18 (superseding the initial plain-JS-only setup; root `naka.js` and root `index.html` placement superseded for `M3` by `D09`). Author the core runtime in TypeScript (`src/index.ts`) and use [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) configured via `vite.config.ts` as the unified toolchain for development (`vp dev`), formatting/linting/type-checking (`vp check`), testing (`vp test` with Vitest + `jsdom`), and library packaging (`vp pack` with `tsdown` emitting `dist/`). Keep the standalone zero-dependency IIFE `naka.js` at the repository root synchronized until `M3` lands (`D09`).

## D07 — Reset initial version to `0.1.0` (experimental `0.x` series)

Accepted by the owner on 2026-10-18. Reset the initial version from the specification bundle's `1.1.0` placeholder to `0.1.0` across `package.json`, `src/index.ts`, `naka.js`, and documentation. All `0.x` releases are experimental while the core runtime and attribute contracts are refined; `1.0.0` is reserved for the first stability commitment.

## D08 — Dual attribute syntax (`naka` / `naka-*` and `data-naka` / `data-naka-*`)

Accepted by the owner on 2026-10-18. Support both concise `naka` / `naka-*` attributes (`naka="key"`, `naka-list="name"`, `naka-item`, `naka-template`, `naka-add`, `naka-remove`, `naka-move`, `naka-no-controls`, `naka-ignore`) and standard HTML5 `data-naka` / `data-naka-*` aliases (`data-naka="key"`, `data-naka-list="name"`, etc.). Reject `naka-data-*` because HTML5 requires custom data attributes to start with `data-`, making `naka-data-*` as verbose as `data-naka-*` without HTML5 validator compliance. Supporting both `naka*` and `data-naka*` gives humans and AI agents minimal token overhead by default while preserving strict HTML5 validity when needed.

## D09 — Repository layout (`src/`, `dist/`, `site/`, `examples/`, `skills/`) and build-emitted `dist/naka.js`

Accepted by the owner on 2026-10-18 (superseding the root `naka.js` and root `index.html` placement in `D06`, scheduled for `M3`–`M5`; the untracked `dist/` output is amended by `D17`, which keeps `dist/naka.js` tracked so GitHub-tree CDN URLs stay valid). Keep the repository root clean by separating source, build outputs, website/playground, starter templates, and AI skills:

- **`src/index.ts` → `dist/naka.js`:** Remove the tracked `naka.js` copy from the repository root. Emit `dist/naka.js` (standalone IIFE), `dist/index.mjs` (ESM), and `dist/index.d.mts` (TypeScript declarations) during `vp pack` (`tsdown`), and point `package.json` (`main`, `unpkg`, `jsdelivr`) to `dist/naka.js`.
- **`site/`:** Move the interactive playground (`index.html`) into `site/` to serve both `vp dev` and the public documentation/demo website.
- **`examples/`:** Store clean, self-contained starter HTML templates (e.g., `examples/starter.html`, `examples/checklist.html`) for humans and AI agents to copy.
- **`skills/nakajs/SKILL.md`:** Place the distributable consumer-facing AI skill in `skills/nakajs/SKILL.md` (with reference docs in `docs/`), keeping `.agents/skills/` exclusively for repository maintenance skills (`nakajs-closeout`).

## D10 — Maintainer-controlled release pipeline (`workflow_dispatch` + GitHub Release) to npm, jsDelivr, and unpkg

Accepted by the owner on 2026-10-18 (scheduled for `M7`; sequenced immediately after `M3` by `D28` to cut the initial `v0.1.0` baseline before `M4`). Keep release creation under explicit maintainer control rather than publishing on every commit to `main`:

- **Continuous Integration (`.github/workflows/ci.yml`):** Run `vp install`, `vp check`, `vp test`, and `vp pack` on pushes and pull requests without publishing.
- **Controlled Release (`.github/workflows/release.yml`):** Support both manual `workflow_dispatch` (one-click version bump `patch` / `minor` / `major` or explicit version that runs verification, tags, and creates a GitHub Release with `dist/naka.js` attached) and `release: types: [published]` (when a release is published manually in the GitHub UI) to build `dist/` and publish the `nakajs` package to npm. Publishing to npm automatically populates both `jsDelivr` (`https://cdn.jsdelivr.net/npm/nakajs@latest/dist/naka.js`) and `unpkg` (`https://unpkg.com/nakajs@latest/dist/naka.js`).

## D11 — GitHub Pages (`js.org`) documentation site with AI-agent native endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`)

Accepted by the owner on 2026-10-18 (scheduled for `M6`–`M7`). Host the project website (`site/`) on **GitHub Pages** via GitHub Actions (`actions/deploy-pages`) designed for a `js.org` custom domain (`naka.js.org` / `nakajs.js.org`) instead of Cloudflare Pages:

- **Why GitHub Pages over Cloudflare Pages:** `js.org` natively supports GitHub Pages CNAME targets without Cloudflare API domain-binding workarounds, keeps all CI/CD inside GitHub Actions, and avoids Cloudflare Bot Fight Mode / managed challenge blocks (`403 Forbidden`) when AI agents fetch documentation via `curl`, `WebFetch`, or `read_url_content`.
- **AI-agent native documentation:** Alongside the interactive HTML landing page and playground, publish static plain-text/Markdown endpoints at `/llms.txt` (concise agent index and quick rules), `/llms-full.txt` (complete reference + starter templates in one request), and `/SKILL.md` (direct copy of `skills/nakajs/SKILL.md`).

## D12 — Explicit `naka` / `data-naka` binding and separation of `naka-ignore` from `data-naka-runtime` export stripping

Accepted by the owner on 2026-10-18 (amending `D05`, scheduled for `M4`, with milestone order amended by `D28` to run `M7` before `M4`; the `name` fallback inside items is superseded by the single-attribute key contract in `D15`, and `data-naka-runtime` stripping is scoped to export by `D16`). Resolve the collision where `naka-ignore` both excluded user inputs from state tracking and deleted them from saved HTML, and prevent global selector hijacking:

- **Explicit binding rule:** Standalone fields in `db.fields` must opt in explicitly via `naka="key"`, `data-naka="key"`, or `data-naka-field="key"`. Inside `[naka-item]` / `[data-naka-item]`, tracked elements also accept `name` as a fallback key (prioritizing `name` over `id` on radio inputs). Unannotated page UI controls (search boxes, filters, custom widgets) are not implicitly captured into `db.fields`.
- **`naka-ignore` vs. `data-naka-runtime`:** `naka-ignore` and `data-naka-ignore` exclude an element (and its subtree) from `naka.js` state binding while **preserving** the element in saved/exported HTML. Internal runtime UI injected by `naka.js` (`.naka-item-tools`, `.naka-list-footer`, `#__nakadb_host__`, `#__nakadb_styles__`) is marked with `data-naka-runtime="true"` and stripped by `getCleanHtmlString()`.

## D13 — Safe `#nakadb` serialization, unmutated disk snapshot hashing, normalized storage keys, and live `fileHandle.getFile()` sync

Accepted by the owner on 2026-10-18 (amending `D03` and `D04`, scheduled for `M4`; snapshot storage and live sync mechanics are refined by `D16`). Harden persistence and conflict resolution across browser refreshes and live AI agent disk edits:

- **Unmutated disk snapshot comparison:** In `initNaka()`, record `nakadb_disk_hash_<key>` from the raw/canonicalized disk `#nakadb` payload _before_ `captureDomToState()` updates `_meta.updatedAt` or reformats indentation, and do not bump `_meta.updatedAt` during read-only hydration. This ensures `localStorage` browser edits survive page refreshes when the file on disk has not changed.
- **Script-safe JSON serialization:** Escape `</script` (as `<\/script`, case-insensitive) and `<!--` (as `<\!--`) when writing JSON to `<script id="nakadb" type="application/json">` so literal script tags or HTML comments in user notes never prematurely close the `<script>` tag on disk save.

> Technical correction from the fourth review (2026-10-18): the preceding `<\!--` example is not a legal JSON escape; implementing it makes `JSON.parse()` fail. Preserve the accepted script-safety intent using `JSON.stringify(value, null, 2).replace(/</g, '\\u003c')`. The replacement emits a literal JSON Unicode escape, preserves string case/content on parse, and covers script/comment opener sequences as well as closers. A standalone jsdom probe verified round-trip parsing; runtime implementation remains `OPEN` (`EC08`).

- **Normalized and scoped storage keys:** Normalize trailing `/index.html` to `/` in `location.pathname` and incorporate an optional document identifier (`<html naka-id="...">`, `data-naka-id`, or `_meta.id`) into `getPageKey()` and `getSnapshotKey()` to prevent cross-project `localStorage` and IndexedDB handle collisions on `localhost`.
- **Live two-way disk sync while tab is open:** When `FileSystemFileHandle` has permission, inspect `await fileHandle.getFile()` on window `focus` / `visibilitychange` and prior to `writeToDisk()`. If `#nakadb` on disk changed externally since the last snapshot, automatically hydrate the live DOM from disk instead of overwriting external AI agent edits.

## D14 — Ephemeral auto-inferred list templates (`data-naka-auto-template`), richer element bindings, deferred attribute baking, and symmetrical `Naka` API

Accepted by the owner on 2026-10-18 (amending `D03`, scheduled for `M4`; auto-template stripping applies only to export under `D16`, and the symmetrical API is extended by `D15`). Eliminate stale inferred list templates, DOM layout issues, and input edge cases:

- **Auto-inferred template lifecycle:** Mark runtime-inferred `<template>` nodes with `data-naka-auto-template="true"`. When no explicit `<template naka-template>` is authored, regenerate the auto-template from the first `[naka-item]` on boot. In `getCleanHtmlString()`, strip `template[data-naka-auto-template]` whenever the list contains $\ge 1$ item, and keep it only when the list has $0$ items so emptied lists preserve their item blueprint on disk.
- **Deferred DOM attribute baking:** Split live value reading (`readElementValue`) from HTML attribute baking (`bakeElementAttributes`). Run attribute baking (`setAttribute('value', ...)`, `setAttribute('checked', ...)`, `textarea.textContent = ...`) only during hydration and inside `getCleanHtmlString()` prior to HTML export/save, preventing `<textarea>` cursor jumps on live `input` events and redundant `JSON.stringify` passes in `Naka.set()`.
- **Expanded element & list support:** Preserve numeric values (`number | null`) for `input[type="number"]` and `input[type="range"]`; support boolean `open` state on `<details naka="key">`; support `<select multiple>`; guard non-input elements with child elements against destructive `textContent` overwrite; support `contenteditable=""`, `"true"`, and `"plaintext-only"` while ignoring `"false"`; support self-bound `[naka-item]` elements (`<li naka-item naka="key">`); scope radio input `name` attributes per list item row; and place list controls in valid table DOM positions for `<table>` / `<tbody naka-list>` / `<tr naka-item>`.
- **Symmetrical programmatic API:** Extend `window.Naka` (`window.NakaDB`) with `getField(key)`, `setField(key, value)`, and `updateItem(listName, index, partialData)` alongside existing `get`, `set`, `getList`, `addItem`, `removeItem`, `moveItem`, `save`, and `exportHTML`.

## D15 — In-memory store as runtime source of truth with merge semantics, pass-through keys, and a single-attribute key contract

Accepted by the owner on 2026-10-18 (amending `D03`, `D12`, and `D14`, scheduled for `M4` before any other runtime hardening lands). The `v0.1.0` runtime treats the DOM as the source of truth: `captureDomToState()` resets `fields` and `lists` to `{}` and rebuilds them from bound elements on every save. A reproduced probe (`EC14`) showed that any JSON an agent writes without a matching DOM binding (a field with no bound element, a list with no `[naka-list]` container, or extra item keys such as `id` or `estimate`) is destroyed on page load, which contradicts the core promise that agents edit `#nakadb` directly. Replace that model:

- **Store as truth:** `initNaka()` builds one in-memory `NakaDatabase` from the resolved source (disk or cache). Every read (`Naka.get`, `getList`, `getField`) and every mutation goes through the store. The `<script id="nakadb">` text, `localStorage`, and disk are serialized views refreshed on save, never re-parsed on each access.
- **Merge, never replace:** DOM capture merges bound element values into `store.fields` and into each rendered item's source object; it does not reset `fields` or `lists`. Fields without a bound element, lists without a container, and unknown item keys pass through untouched. Each rendered `[naka-item]` row keeps a reference to its source object (a `WeakMap`), so add, reorder, and remove preserve extra keys and let agents assign stable item identifiers without the runtime understanding them. Key removal is always explicit (`Naka.deleteField(key)`, `Naka.removeItem`).
- **Single-attribute key contract:** The binding key is exclusively `naka="key"`, `data-naka="key"`, or `data-naka-field="key"`, both outside and inside `[naka-item]`. Drop the `id`, `name`, and `field_${idx}` fallbacks entirely (superseding the `name` fallback inside items from `D12`). Unannotated inputs are never captured, and keys never shift when markup changes (`EC11`).
- **Change-only metadata and debounced capture:** Bump `_meta.updatedAt` only when the serialized `fields`, `lists`, or `custom` differ from the previous serialization; hydration and boot never bump it (`EC06`). Debounce DOM capture itself (about 150 ms), not only the disk write, and flush synchronously on `pagehide` and `visibilitychange: hidden` so no edit is lost on tab close (`EC16`). Attribute baking runs only during hydration and export (`D14`).
- **Preserve unknown values:** When a stored value has no matching `<option>` in a bound `<select>`, keep the stored value and log a warning instead of coercing it to `""` on the next save (`EC15`).

## D16 — Surgical `#nakadb` block writes for disk sync; full-document serialization only for `Naka.exportHTML()`

Accepted by the owner on 2026-10-18 (amending `D03`, `D04`, `D05`, `D12`, and `D13`, scheduled for `M4`). Writing `document.documentElement.outerHTML` back to disk re-serializes the whole document from the live DOM: formatter output is rewritten, runtime mutations by user scripts are persisted, every injected control must be tracked and stripped, and the body and the JSON become two competing copies of the same data (`EC03`, `EC07`, `EC09`, parts of `EC12`). Replace that with a surgical write:

- **Disk sync writes only the JSON block:** `writeToDisk()` reads the current file text through `fileHandle.getFile()`, locates the first `<script id="nakadb" ...>…</script>` block (case-insensitive, tolerant of attribute order and quoting), replaces only its inner text with the escaped serialized store (`D13`), and writes the result. When no block exists, insert one immediately after the opening `<head>` tag. Every other byte of the file stays identical, so Git diffs show only data changes and formatters never fight the runtime.
- **Body is the template, JSON is the data:** Baked attributes and rendered list rows in the body are not updated on disk by sync. Document this contract for humans and agents in `AGENTS.md`, `README.md`, and `docs/USAGE.md`: edit `#nakadb` to change data; edit markup to change the view. Runtime UI stripping (`data-naka-runtime`, `D12`) and auto-template stripping (`D14`) apply only to `Naka.exportHTML()` and to the Blob-download fallback, which has no original file text and therefore keeps full serialization as an explicit snapshot mode.
- **Read-before-write is the live-sync check:** Because every write reads the file first, external edit detection (`EC10`) falls out of the same path: if the on-disk block differs from the last known snapshot, hydrate from disk (or raise a conflict) instead of overwriting. The `focus` / `visibilitychange` check from `D13` reuses the same comparison.
- **Conflicts are visible and recoverable:** When cache, disk, and snapshot all differ, disk still wins by default (`D04`), but the discarded browser state is kept under `nakadb_backup_<key>` and the status pill announces the conflict with a restore action instead of discarding silently (`EC17`).
- **Snapshot is a hash:** `nakadb_disk_hash_<key>` stores a cheap synchronous string hash of the canonical JSON rather than a second full copy, halving `localStorage` usage per document.
- **Unlink:** The status pill offers an unlink action that forgets the persisted `FileSystemFileHandle` so a wrongly linked file can be corrected without clearing IndexedDB by hand.

> Fourth-review constraint (2026-10-18): the byte-preservation and conflict-detection promises above need explicit limits before implementation. A reproduced `Blob.text()` → UTF-8 encode round trip removed a UTF-8 BOM (9 input bytes → 6 output bytes). Preserve original bytes outside the selected block, or explicitly narrow supported encodings. Read-before-write is not an atomic comparison-and-write against an external editor; retain this as an unresolved acceptance constraint in `PLAN.md`, not a concurrency guarantee.

## D17 — Track the built `dist/naka.js` artifact with a CI freshness check

Accepted by the owner on 2026-10-18 (amending `D09`, scheduled for `M3`). `D09` ignores `dist/` in Git while `AGENTS.md` and `README.md` point consumers and agents at a jsDelivr `gh` URL, which serves files from the Git tree and would return `404` once the root `naka.js` is removed. Resolve the contradiction by tracking the single built browser artifact:

- Un-ignore `dist/naka.js` only; keep `dist/index.mjs` and `dist/index.d.mts` untracked and built on demand.
- Build `dist/naka.js` from a dedicated IIFE entry (`src/iife.ts`) that imports the core and sets `window.Naka` / `window.NakaDB` without exporting a bundle namespace global (removes the stray `NakaBundle` global).
- CI (`M7.1`) runs `vp pack` and fails when `dist/naka.js` differs from the committed copy; `package.json` gains a `prepublishOnly` build so npm never ships a stale `dist/`.
- Consumer URLs become `https://cdn.jsdelivr.net/gh/<owner>/nakajs@main/dist/naka.js` for the Git tree and `https://cdn.jsdelivr.net/npm/nakajs@latest/dist/naka.js` after the first npm release (`D10`).

## D18 — Single data namespace with a schema version (rejected by `D27`)

**Status: Rejected by the owner on 2026-10-18 (`D27`).** Proposed by the third source review to flatten `{ _meta, fields, lists, custom }` into one root namespace. Rejected because the four top-level buckets (`_meta`, `fields`, `lists`, `custom`) are self-documenting for AI coding agents inspecting `<head>` and prevent key collisions between scalar bindings, list repeaters, and custom widget state (`D03`, `D15`).

## D19 — Stable list item identity (rejected by `D27`)

**Status: Rejected by the owner on 2026-10-18 (`D27`).** Proposed by the third source review to inject compulsory auto-generated `id` strings into every list item object. Rejected to keep user and agent JSON in `#nakadb` clean and unpolluted; `D15`'s `WeakMap` maps rendered `[naka-item]` rows to their source objects in memory and preserves any agent-authored `id` or extra keys untouched.

## D20 — Retain the base snapshot for three-way JSON merge (IndexedDB merge-base DB rejected; lightweight key-level merge adopted in `D27`)

**Status: Narrowed by the owner on 2026-10-18 (`D27`).** The third source review proposed storing a full merge-base JSON database in a second IndexedDB store (`NakaDB_Base`) and running a recursive list-item ID merge engine. That heavy IndexedDB + list-item merge engine is **rejected** (`D27`). Instead, when an active session detects an external disk update (or when `base`, `ours`, and `theirs` are available), `naka.js` performs a lightweight (~15-line) shallow top-level key merge across `fields`, `lists`, and `custom` so concurrent edits to different keys both survive, while backing up same-key collisions to `nakadb_backup_<key>` with a 1-click **`↺ Restore`** action (`D16`, `EC17`).

## D21 — Event-targeted capture and explicit `Naka.bind(root)`

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`, amending `D15`).** A debounced full-document scan rereads every bound element: with duplicate keys the last element wins (`EC19`), elements rendered after boot overwrite stored values with their defaults (`EC20`), and each edit costs `O(n)` (`EC16`).

- Attach delegated `input` / `change` / `click` listeners synchronously on boot before awaiting IndexedDB handle lookup (`EC34`).
- On `input` / `change`, resolve the binding of `event.target` (scalar key or list item row + property) and update only that entry in the in-memory store (`O(1)`), and only when its normalized value changed (`EC25`).
- Propagate scalar updates to any other element bound to the same key (`EC19`).
- Expose `Naka.bind(root?)` to hydrate bound elements added dynamically after boot (without an unconditional document-wide `MutationObserver` or reading defaults over stored values, `EC20`).
- Debounce only persistence (`localStorage`, `#nakadb` DOM text, and queued disk write) and flush cache/DOM synchronously on `pagehide` / `visibilitychange: hidden`.

## D22 — Plain-text `contenteditable` storage by default

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`).** Hydrating stored strings through `innerHTML` turns data into executable markup (`EC18`) and pollutes agent-readable JSON with browser editing artifacts (`&nbsp;`, `<br>`, `<div>`).

- `contenteditable` bindings read and write plain text (`textContent`) by default.
- The proposed built-in HTML allowlist sanitizer (`naka-html`) is **rejected** (`D27`) to keep the runtime small and avoid shipping a custom XSS sanitizer.

## D23 — Bake attributes only on the export clone

**Status: Accepted by the owner on 2026-10-18 (`D27`, amending `D14`).** Under `D16`, disk sync rewrites only the `<script id="nakadb">` block and never serializes `<body>`, so mutating `value`, `checked`, `selected`, or `<textarea>` text on the live DOM has no consumer outside `Naka.exportHTML()` and breaks native `form.reset()` defaults (`EC12`). Bake attributes only on the cloned document inside `getCleanHtmlString()` prior to HTML snapshot export or Blob download.

## D24 — Write safety: single-flight write queue, payload snapshots, and safe block replacement

**Status: Accepted in narrowed form by the owner on 2026-10-18 (`D27`, amending `D16`).**

- Serialize disk writes through a single-flight queue; coalesce edits made while a write is in flight into the next write (`EC26`).
- Derive `nakadb_disk_hash_<key>` from the exact JSON payload written to disk, never from live state after `writable.close()` resolves (`EC26`).
- Preserve a leading UTF-8 BOM (`\uFEFF`) when replacing `<script id="nakadb">` on disk, and refuse to overwrite or inject `#nakadb` into an existing selected file that does not already contain `<script id="nakadb">` unless the user confirms (`EC28`).

## D25 — Side-effect-free ESM entry and modular internals (adapter platform rejected by `D27`)

**Status: Narrowed by the owner on 2026-10-18 (`D27`, amending `D06` and `D17`).**

- **Accepted:** Keep `dist/index.mjs` (ESM) side-effect free while `src/iife.ts` (`dist/naka.js`) auto-starts on load and sets `window.Naka` / `window.NakaDB` (`EC37`). Allow clean internal helper modules in `src/` and re-initialization/teardown support for testing.
- **Rejected (`D27`):** Reject a public persistence adapter plugin API, multi-root `createNaka({ root, adapter, clock })` DI container, `npx nakajs serve` local backend server, and fetching `location.href` over the network during export.

## D26 — Lightweight, fast, low-ceremony product priority

Accepted by the owner on 2026-10-18. `naka.js` must remain a light, fast tool with minimal authoring ceremony (`D06`):

- Favor simple defaults, a small public API, ordinary HTML/JSON, and optional escape hatches. Runtime validation protects data integrity and supported binding shapes (`EC04`, `EC33`); it is not an application-schema system.
- Prefer removing repeated DOM/serialization work (`D15`, `D21`, `D23`) over adding framework machinery. Preserve dual attributes (`D08`), unknown JSON data (`D15`), inferred templates (`D14`), and custom-widget integration.

## D27 — Final lean architecture, truthful status pill UX (`Naka.copyJSON()`), and review consolidation

Accepted by the owner on 2026-10-18 (consolidating `D12`–`D26` for `M3` and `M4`; milestone execution order amended by `D28` to run `M7` before `M4`). Following five rounds of source and architecture review plus ecosystem viability analysis, lock the final global architecture of `naka.js` as a fast, minimalist (~4–5 KB min+gzip) drop-in runtime for local HTML mini-apps and AI agent workflows:

1. **Canonical 4-bucket schema (`D03`, `D15`; rejecting `D18` & `D19`):** Keep `<script id="nakadb" type="application/json">` structured as `{ _meta, fields, lists, custom }` with `Object.hasOwn()` lookups (`EC24`, `EC38`). Unbound fields, unbound lists, and extra list-item keys (including optional agent-authored `id`) pass through untouched via an in-memory store and row `WeakMap`.
2. **Synchronous boot, `O(1)` event capture, and export-only baking (`D15`, `D21`–`D23`; `EC16`, `EC18`–`EC20`, `EC32`, `EC34`):** Install the full resolved state (`_meta`, `fields`, `lists`, `custom`) into the in-memory store, hydrate the DOM, and attach delegated `input`/`change`/`click` listeners synchronously before awaiting IndexedDB handle lookup. Update only the changed binding on edit (`O(1)`), default `contenteditable` to plain text (`textContent`), and bake HTML attributes only on the export clone in `Naka.exportHTML()`.
3. **Safe surgical `#nakadb` disk sync + zero-server `file.lastModified` live watch (`D13`, `D16`, `D24`; narrowing `D20`, rejecting `D25`):**
   - Queue disk writes single-flight (`EC26`), escape `<` as `\u003c` in serialized JSON (`EC08`), read-before-write via `fileHandle.getFile()` (`EC10`), replace only the `<script id="nakadb">` block on disk (preserving a leading UTF-8 BOM and refusing to overwrite unrelated files lacking `#nakadb` without confirmation, `EC28`), and record the snapshot from the exact written payload. On broken startup JSON (`EC04`), surface an error state and block auto-write until recovered.
   - **Live side-by-side disk watch (`EC10`, `EC17`):** When a granted `FileSystemFileHandle` is active and `document.visibilityState === 'visible'` (with no write in flight), check `(await fileHandle.getFile()).lastModified` every ~2 seconds in addition to `focus` / `visibilitychange` checks. When `lastModified` changes externally (e.g., an AI agent edits `#nakadb` on disk while the browser is open side-by-side), read `#nakadb` and perform a shallow top-level key merge (`fields[k]`, `lists[k]`, `custom[k]`) against the last disk state so unrelated human edits in the browser and agent edits on disk both survive; guard `document.activeElement` against mid-keystroke overwrite; and on same-key collision, let disk win while saving the pre-merge browser state to `nakadb_backup_<key>` with a 1-click **`↺ Restore`** button in the status pill.
4. **Truthful status pill UX + 1-click `📋 Copy JSON` (`EC17`, `EC36`):**
   - Show an **amber** status (`Browser Cache · Click to Link Disk`) whenever edits exist in browser cache that have not been written to the linked disk file, and show **green** (`Synced to Disk`) only after `writable.close()` completes for the current revision (`EC36`).
   - Include a 1-click **`📋` Copy JSON** action (`Naka.copyJSON()`) on the pill to copy `#nakadb` JSON to the clipboard for instant AI chat/CLI round-tripping (especially on Safari/Firefox or unlinked `file://` pages), alongside **`×` Unlink** (`Naka.unlink()`) and **`↺` Restore** from `nakadb_backup_<key>` when external disk edits supersede cached browser edits (`EC17`).
   - Make `Naka.save()` return `Promise<boolean>` indicating whether disk sync (or cache flush when unlinked) succeeded.
5. **Reject out-of-scope framework ceremony (`EC27`, `EC39`, `EC40`):** Reject multi-tab `BroadcastChannel` / `Web Locks` protocols (`EC27`; use a lightweight `storage` event listener at most), automatic DOM `id` / `for` rewriting in list templates (`EC39`; recommend wrapping `<label>` in docs/examples), and custom row widget frameworks (`EC40`; emit `naka:hydrate` / `naka:change` and use event delegation).

## D28 — Advance `M7` (CI/CD & release workflows) before `M4` to cut the initial `v0.1.0` baseline and emit `dist/naka.min.js`

Accepted by the owner on 2026-10-19 (amending milestone sequencing in `D10`, `D12`, `D17`, and `D27`). With `M0`–`M3` complete (`src/index.ts`, `src/iife.ts`, tracked `dist/naka.js`, `site/index.html`, `examples/`, and passing Vite+ checks/tests), execute `M7` (`M7.1`–`M7.2` CI verification, GitHub Pages deployment, and maintainer-controlled release workflows) immediately after `M3` before applying `M4` runtime changes:

- **Why:** Shipping the current working library as the initial `v0.1.0` milestone establishes automated CI (`vp check`, `vp test`, `vp pack`, `dist/naka.js` freshness check), live GitHub Pages deployment for `site/`, and a verified `v0.1.0` tag / npm / CDN baseline (`jsDelivr`, `unpkg`) before `M4` re-architects the core runtime for the next `0.x` release (`v0.2.0`).
- **Build-emitted `dist/naka.min.js` (`minify: true`):** Add a minified browser IIFE output (`dist/naka.min.js`, ~4.7 KB min+gzip) to `vite.config.ts` (`vp pack`) and `package.json` `exports` while keeping only readable `dist/naka.js` tracked in Git (`D17`). This preserves clean Git diffs while shipping pre-minified `dist/naka.min.js` to npm, `unpkg`, `jsDelivr`, GitHub Pages, and GitHub Releases.
- **Decoupled `M7.1` / `M7.2` execution:** `.github/workflows/ci.yml` runs the current `vp test` suite (which automatically picks up `M4.4` expansions later); `.github/workflows/pages.yml` deploys `site/` with `dist/naka.js`, `dist/naka.min.js`, and `examples/` now (and automatically serves `/llms.txt`, `/llms-full.txt`, `/SKILL.md`, and `CNAME` when `M6.2` lands); and `.github/workflows/release.yml` supports `current` / explicit `0.1.0` on `workflow_dispatch` (attaching both `dist/naka.js` and `dist/naka.min.js`) so the initial `v0.1.0` release can be cut when `package.json` is already at `0.1.0`.
