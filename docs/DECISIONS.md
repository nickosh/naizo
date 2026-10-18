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

Accepted by the owner on 2026-10-18 (scheduled for `M7`). Keep release creation under explicit maintainer control rather than publishing on every commit to `main`:

- **Continuous Integration (`.github/workflows/ci.yml`):** Run `vp install`, `vp check`, `vp test`, and `vp pack` on pushes and pull requests without publishing.
- **Controlled Release (`.github/workflows/release.yml`):** Support both manual `workflow_dispatch` (one-click version bump `patch` / `minor` / `major` or explicit version that runs verification, tags, and creates a GitHub Release with `dist/naka.js` attached) and `release: types: [published]` (when a release is published manually in the GitHub UI) to build `dist/` and publish the `nakajs` package to npm. Publishing to npm automatically populates both `jsDelivr` (`https://cdn.jsdelivr.net/npm/nakajs@latest/dist/naka.js`) and `unpkg` (`https://unpkg.com/nakajs@latest/dist/naka.js`).

## D11 — GitHub Pages (`js.org`) documentation site with AI-agent native endpoints (`/llms.txt`, `/llms-full.txt`, `/SKILL.md`)

Accepted by the owner on 2026-10-18 (scheduled for `M6`–`M7`). Host the project website (`site/`) on **GitHub Pages** via GitHub Actions (`actions/deploy-pages`) designed for a `js.org` custom domain (`naka.js.org` / `nakajs.js.org`) instead of Cloudflare Pages:

- **Why GitHub Pages over Cloudflare Pages:** `js.org` natively supports GitHub Pages CNAME targets without Cloudflare API domain-binding workarounds, keeps all CI/CD inside GitHub Actions, and avoids Cloudflare Bot Fight Mode / managed challenge blocks (`403 Forbidden`) when AI agents fetch documentation via `curl`, `WebFetch`, or `read_url_content`.
- **AI-agent native documentation:** Alongside the interactive HTML landing page and playground, publish static plain-text/Markdown endpoints at `/llms.txt` (concise agent index and quick rules), `/llms-full.txt` (complete reference + starter templates in one request), and `/SKILL.md` (direct copy of `skills/nakajs/SKILL.md`).

## D12 — Explicit `naka` / `data-naka` binding and separation of `naka-ignore` from `data-naka-runtime` export stripping

Accepted by the owner on 2026-10-18 (amending `D05`, scheduled for `M4` immediately after `M3` repository reorganization; the `name` fallback inside items is superseded by the single-attribute key contract in `D15`, and `data-naka-runtime` stripping is scoped to export by `D16`). Resolve the collision where `naka-ignore` both excluded user inputs from state tracking and deleted them from saved HTML, and prevent global selector hijacking:

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

## D18 — Single data namespace with a schema version (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend `D03` and `D15`. `#nakadb` splits data into `fields`, `lists`, and `custom`, which exposes a runtime detail (whether a key is bound to the DOM) in the data model: agents must guess which bucket a value belongs in, `Naka.get('owner')` cannot read a bound field, and the API grows a getter/setter pair per bucket.

- Replace the three buckets with one namespace: `{ "_meta": { "schema": 1 }, "owner": "Kenji", "tasks": [ … ], "rateLimitRps": 120 }`. Underscore-prefixed top-level keys are reserved for the runtime.
- `naka="key"` binds a scalar and `naka-list="key"` binds an array of objects; `Naka.get(key)`, `Naka.set(key, value)`, and `Naka.delete(key)` cover every key and leave room for dotted paths later.
- `_meta.schema` versions the format so later changes migrate files instead of breaking them. Files in the `v0.1.0` shape may be migrated once on load; no further compatibility layer.
- Trade-off: one key can no longer be both a field and a list (intended), and every sample and test fixture changes once.

## D19 — Stable list item identity (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would extend `D15`. List items are identified only by position, which breaks three-way merges (`D20`), rebuilding the row-to-item `WeakMap` after reload, and agent instructions that name a specific item.

- Every list item carries an identity key (`id` by default, overridable per list with an attribute such as `naka-key="slug"`). The runtime generates a short unique value for items without one (new rows, agent-written items) and never changes an existing value.
- Rendered rows reference their item by identity, and `Naka` list methods accept an identity as well as an index.
- Trade-off: one extra key per item in the JSON.

## D20 — Retain the base snapshot for three-way JSON merge (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend the "Snapshot is a hash" bullet of `D16` and the whole-document "disk wins" rule of `D04` / `D16`. A hash can only detect divergence, so every conflict resolves as "disk wins" with the browser edits moved to a backup. Conflicts are the common path rather than an edge case: in the default unlinked flow a user ticks boxes (cache), the agent edits the file, and the next reload discards every tick; live sync (`EC10`) makes the same divergence routine while a tab stays open.

- Store the full canonical JSON of the last known disk state (the merge base) in IndexedDB, which has a larger quota than `localStorage`, keyed like the cache.
- On divergence, merge base, browser, and disk per top-level key and per list item identity (`D19`). Apply non-overlapping changes from both sides automatically; for a key changed on both sides, disk wins and the browser value goes to the conflict backup with the restore notice from `D16`.
- Never apply a merged update to the element that has focus; apply it on blur.

## D21 — Event-targeted capture (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend the "Debounce DOM capture" bullet of `D15`. A debounced full-document scan still rereads every bound element: with duplicate keys the last element wins (`EC19`), elements rendered after boot overwrite stored values with their defaults (`EC20`), and each edit costs O(n) (`EC16`).

- On `input` / `change`, resolve the binding of `event.target` (a key, or a list item identity plus property) and update only that entry, and only when its normalized value changed (`EC25`).
- Propagate the new value to every other element bound to the same key (one key, many elements).
- Hydrate bound elements added after boot through a `MutationObserver` or an explicit `Naka.bind(root)`; never read them back into the store unprompted.
- Debounce only persistence (cache, `#nakadb` text, disk) and flush on `pagehide` / `visibilitychange: hidden` as in `D15`. Page scripts that set `.value` without dispatching an event are not captured; document `Naka.set` for them.

## D22 — Plain-text `contenteditable` storage by default (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Settles the plain-text evaluation item left open by the second review. Hydrating stored strings through `innerHTML` turns data into live markup (`EC18`) and fills agent-readable JSON with browser editing artifacts (`&nbsp;`, `<br>`, `<div>`).

- `contenteditable` bindings read and write plain text by default.
- Rich text is opt-in per element (e.g., `naka-html`), and every write passes a small built-in allowlist sanitizer (or `Element.setHTML()` where the browser provides it).

## D23 — Bake attributes only on the export clone (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend the deferred-baking bullet of `D14`. Under `D16` disk sync never serializes the body, so attributes baked into the live DOM have no consumer outside `Naka.exportHTML()` and the Blob fallback. Copy live values into attributes of the cloned document inside `getCleanHtmlString()` only, and never mutate value attributes on the live page.

## D24 — Write safety: single-flight writes, payload snapshots, and file identity (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend `D16`.

- Serialize disk writes through one queue; coalesce edits made during a write into the next write instead of starting overlapping writes.
- Derive the snapshot (and the `D20` merge base) from the exact payload written, never from live state after the write resolves (`EC26`).
- Assign `_meta.id` (a random identifier) when a document first links to disk. Before the first write to a handle, read the file and confirm that its `#nakadb` block carries the same `_meta.id` or matches the merge base; otherwise ask before writing (`EC28`).
- Never insert a missing `#nakadb` block into an existing file without explicit confirmation, replacing the unconditional "insert after `<head>`" rule in `D16`.

## D25 — Factory core, side-effect-free ESM, persistence adapters, and modular source (proposed)

**Status: Proposed 2026-10-18 by the third source review; pending owner decision.** Would amend `D06` and `D17`.

- Expose `createNaka({ root, storage, adapter, clock })` returning an instance; module-level state (`fileHandle`, timers, listener flags) moves into the instance so tests and multiple documents do not share it.
- The ESM entry has no side effects (`"sideEffects": false`); only `src/iife.ts` auto-starts and assigns `window.Naka` / `window.NakaDB` (`D17`).
- Persistence goes through an adapter interface (read the source, write the `#nakadb` block, watch for external changes), with File System Access and Blob download as the first adapters. On `http(s)` the download adapter fetches `location.href` and splices the JSON block into the original source instead of serializing the live DOM, so DOM rendered by other libraries (e.g., Mermaid diagrams) is not baked into the snapshot.
- Split `src/` into modules (store, bindings, lists, persistence adapters, UI, serialization, IIFE entry) bundled into one IIFE.
- Open product question, outside this proposal: an optional local save adapter (a Vite plugin or `npx nakajs serve` that accepts writes of the JSON block and pushes file changes to the page) would make disk sync work in every browser and in IDE preview panes, but touches the "Backend servers" non-goal in `docs/PRODUCT.md`.
