# naizo — Decision Log (ADR-style)

Record durable architectural and owner decisions and their rationale. Allocate the next `Dxx` ID for new decisions; supersede an old decision explicitly rather than silently rewriting its history.

Every `Dxx` entry must explain **why**, not merely copy the implementation checklist from [PLAN.md](PLAN.md):

1. **Context & Problem (Why):** What user workflow, architectural tension, review finding, or reproduced boundary case required a decision?
2. **Decision & Rationale (Global Picture & Invariant Safety):** Why was this approach chosen, how does it fit the global product lifecycle in [PRODUCT.md](PRODUCT.md), and why does it preserve existing core promises?
3. **Alternatives Rejected / Trade-offs:** What other options were considered and why were they rejected or scoped out?

Entries marked **Status: Proposed** are recommendations pending owner review. They bind nothing and amend nothing until the owner accepts them; on acceptance, record the date and any changes in the entry and update the decisions it amends.

## D01 — Hybrid project memory structure

Accepted by the owner on 2026-10-18 (refined on 2026-10-22 by `D42` to enforce non-overlapping **Global Picture (`PRODUCT.md`)**, **Why (`DECISIONS.md`)**, and **What (`PLAN.md`)** roles). Use a hybrid project memory layout combining the lean core ledger from `nuance-skills` with the product and edge-case ledgers from `napflow`:

- `AGENTS.md` (with a root `CLAUDE.md -> AGENTS.md` symlink) for repository-wide instructions, architecture, verification, and workflow rules.
- `docs/PRODUCT.md` for product definition, target users, core invariants, and non-goals.
- `docs/PLAN.md` as the single authoritative task, milestone/slice sequencing, and acceptance ledger (omitting a separate `REQUIREMENTS.md` checkbox matrix until needed).
- `docs/DECISIONS.md` for numbered ADR-style design and owner decisions.
- `docs/EDGE_CASES.md` for numbered boundary cases and their resolution status (`ADR`, `fix`, `doc`, `PARTIAL`, `OPEN`).
- `docs/JOURNAL.md` for concise newest-first session/slice handoffs (2–5 bullets: done, decided, verification/blockers, next technical action).
- `.agents/skills/naizo-closeout/SKILL.md` as the repository-scoped maintainer closeout skill.

Keep delivery bookkeeping (branch names, commit SHAs, PR numbers/states, push/pull/merge steps, and CI run/job IDs) and manual release-status markers out of project memory documents; Git history and GitHub Releases/tags own those states.

## D02 — Local auto-commit workflow with descriptive Conventional Commits

Accepted by the owner on 2026-10-18 (refined on 2026-10-24 by `D44` to require separate verification, memory reconciliation, and local commits per planned substep). After completing and verifying each coherent change (including documentation changes) and reconciling project memory, create a local commit automatically without asking again unless the user explicitly requests otherwise.

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

Release-PR freshness enforcement through CI is superseded by `D37`: bot-created release PRs receive no CI run, so the preparation build job is their verification, and tagged publication retains the freshness check. Allowing `dist/naizo.js` to lag between releases on `main` is superseded by `D46`, which enforces `git diff --exit-code dist/naizo.js` in `ci.yml` on every push and PR so `main`'s tracked `dist/naizo.js` always matches `src/`.

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

## D40 — Keyboard save gesture (`⌘S` / `Ctrl+S`), background disk flush, multi-tab `storage` hardening, declarative master–detail notebook (`examples/notes.html`), and pre-`M4` dead-code cleanup

Accepted by the owner on 2026-10-22. Extends `M4` with `M4.5a`–`M4.5c` and `M4.5e` (`EC47`, `EC49`; retiring `data-naizo-field` from `D12`/`D15` in favor of strict `D08` `naizo`/`data-naizo` symmetry) and refines `M5` and `M6`.

- **Context & Problem (Why):**
  1. **The `⌘S` / `Ctrl+S` browser footgun (`EC47`):** When editing a local `.html` tool or note pad, users instinctively press `⌘S` / `Ctrl+S`. Without interception, the browser opens its native _"Save Webpage, Complete"_ dialog, writing a duplicate/broken copy into `~/Downloads` instead of linking or updating the file in place. Meanwhile, `keydown` (`⌘S` / `Ctrl+S`) is a trusted browser user-activation gesture in Chromium that has permission to invoke `showSaveFilePicker()` or `fileHandle.requestPermission()` directly without forcing the user to click the bottom-right pill with a mouse.
  2. **The ~400 ms tab-switch debounce gap (`EC47`):** When a human edits a field and immediately switches (`Cmd+Tab`) to their CLI or IDE AI agent within the `150 ms` (`persistTimeout`) + `250 ms` (`saveTimeout`) debounce window, `pagehide` / `visibilitychange: hidden` currently flushes `localStorage` (`flushPersistence(false)`) but leaves the pending disk write un-started until the timer expires.
  3. **Same-browser multi-tab race (`EC47`):** Opening the same local HTML tool in two tabs of the same browser is a real-world occurrence. While `EC27` added a basic `storage` listener, receiving a `getPageKey()` event from Tab A while Tab B has an uncommitted `150 ms` `persistTimeout` edit overwrites `store` wholesale, and Tab B's `lastDiskDb` / `lastKnownDiskRaw` lags behind after Tab A completes a disk write and updates `getSnapshotKey()`.
  4. **Missing master–detail architectural pattern (`examples/notes.html`):** Existing examples cover a minimal form (`starter.html`), a flat checklist (`checklist.html`), and a filterable card grid (`inventory.html`), but not a **master–detail workspace** (sidebar index + active editor pane). In naive single-file memo apps, master–detail is implemented imperatively by wiping and rebuilding the DOM into a single shared `<textarea>` on every click—which bypasses `naizo.js`'s declarative `WeakMap` row bindings, `O(1)` input capture, and `document.activeElement` protection during live AI agent disk sync.
  5. **Stale pre-`M4` exports, selectors, and bundler config (`EC49`):** A codebase audit showed five leftovers from `M1` that are unreferenced in production and contradict current architecture:
     - `captureDomToState()`, `syncDomIntoStore()`, `applyDomElementToRecord()`, `hydrateDomFromState()`, `triggerSave()`, `parseDbScript()`, and `getDbScript()` remained in `src/index.ts` from the rejected `M1` _"DOM is truth"_ full-document scan (`D15`, `D21`); keeping `captureDomToState` exported on ESM risks callers bypassing `O(1)` capture and overwriting `db.lists`.
     - `bakeClonedElementAttributes()` duplicated the radio `name` restoration that `getCleanHtmlString()` already performs across the entire export clone.
     - `extractKeyHashManifest()` and `extractRootDiskHash()` retained a raw-JSON fallback from pre-`fnv1a:` development builds (`D16`, `EC46`).
     - `BOUND_SELECTOR` and `getElementKey()` included an asymmetric third attribute alias `data-naizo-field` (with no `naizo-field` counterpart), breaking `D08`'s strict 1-to-1 `naizo*` ↔ `data-naizo*` symmetry.
     - `vite.config.ts` retained an unused `build: { outDir: 'dist/site' }` block that attempts to bundle `site/index.html` into Rollup chunks, contradicting `naizo`'s unbundled single-file HTML architecture.
- **Decision & Rationale (Global Picture & Invariant Safety):**
  - **Intercept `⌘S` / `Ctrl+S` (`M4.5a`):** Suppress the browser's broken webpage save dialog and use the keyboard user activation gesture to flush `await Naizo.save()` when granted or invoke `connectOrResumeDisk()` when unlinked / needing permission (and flush `localStorage` with `✓ Saved in Browser` feedback in Online Mode under `D41`).
  - **Flush disk immediately on tab hide (`M4.5b`):** When `pagehide` or `visibilitychange: hidden` fires while `persistTimeout !== null` or `saveTimeout !== null`, flush `localStorage` synchronously and immediately kick off `void writeToDisk()` when a `fileHandle` is linked so the CLI/IDE agent on disk sees the latest human edit right away.
  - **Harden `handleStorageEvent()` (`M4.5b`):** By the HTML5 Web Storage specification, the `window` `'storage'` event fires **only** in other same-origin tabs—never in the tab that called `localStorage.setItem()`. Merging uncommitted `persistTimeout` edits via `shallowMergeDatabases()` on `getPageKey()` events and updating `lastKnownDiskRaw` / `lastDiskDb` / `Synced to Disk` when `getSnapshotKey()` matches the current `store` fixes multi-tab synchronization with **zero** impact on single-tab execution.
  - **Build `examples/notes.html` declaratively (`M4.5c`):** Keep every note as a live `[naizo-item]` inside `[naizo-list="notes"]` (bound `title`, `category`, `pinned`, `body`, plus pass-through `id` and `updatedAt`) and toggle which `[naizo-item]` is visible in the main editor pane via CSS (`db.custom.activeNoteId`) while a custom sidebar index renders searchable/filterable note tabs (`[naizo-ignore]`). This proves `naizo.js` can power master–detail workspaces with zero DOM-wiping and zero custom serialization code.
  - **Remove stale pre-`M4` code and align ESM/attribute surfaces (`M4.5e`, `EC49`):** Remove `applyDomElementToRecord`, `syncDomIntoStore`, `captureDomToState`, `hydrateDomFromState`, `triggerSave`, and `parseDbScript`, unexport internal `getDbScript` and `getCleanHtmlString` so the ESM module (`dist/index.mjs` / `dist/index.d.mts`) exports strictly `Naizo`, `NaizoDB`, `initNaizo`, and the public TypeScript interfaces (`NaizoAPI`, `NaizoDatabase`, `NaizoMeta`), remove the duplicate radio restoration in `bakeClonedElementAttributes` and the pre-`fnv1a:` raw-JSON snapshot fallback, drop the orphaned `data-naizo-field` alias in favor of `naizo="key"` / `data-naizo="key"` (`D08`), and remove the unused `build` block from `vite.config.ts`.
- **Alternatives Rejected / Trade-offs:**
  - **Rejected native `beforeunload` warning prompts:** Blocking tab close/reload with a browser `beforeunload` dialog when unlinked would be noisy and misleading because `localStorage` already persists browser edits across reloads; immediate background flushing on `visibilitychange: hidden` / `pagehide` solves the actual disk latency gap without nagging the user.
  - **Rejected `BroadcastChannel` / Web Locks (`D27`):** Full distributed tab locking remains unnecessary; enhancing the existing `storage` listener covers same-browser multi-tab edits in ~12 lines of code.
  - **Rejected imperative single-textarea note swapping in `examples/notes.html`:** Copying strings in and out of an unbound `<textarea>` would defeat `naizo.js`'s declarative `[naizo-list]` model and lose `document.activeElement` protection during live disk merges.
  - **Rejected keeping dead `M1` exports for hypothetical compatibility:** `naizojs` has not yet had a `1.0` stability commitment (`D07`), and leaving dead full-DOM scan functions exported in `src/index.ts` bloats the bundle and exposes broken pre-`M4` code paths before `M5` documentation is written.

## D41 — Online Mode (`naizo-mode`), safe `Naizo.reset()` with Shadow DOM confirmation, and portable `⬇ Save to PC` (`Naizo.downloadHTML()`) for Web-to-Local App Exchange

Accepted by the owner on 2026-10-22. Extends `M4` with `M4.5d` (`EC48`, amending `D05`, `D12`, `D24`, and `D36`/`EC36`) and informs `M5` (`docs/USAGE.md`, `skills/naizo/SKILL.md`) and `M6` (`site/index.html`).

- **Context & Problem (Why):**
  1. **`naizo.js` apps are also served online (`https://`):** Single-file `naizo.js` applications are not only opened via `file://` or `localhost`; they are also hosted on static web servers such as GitHub Pages (including our own `site/index.html` and `examples/*.html`), documentation sites, and internal team URLs.
  2. **Confusing Local-Mode pill on remote web hosts (`EC48`):** On a remote `https://` server, a browser cannot write back to the remote server's file. Even though `localStorage` persistence and 3-way merge against future server deploys work automatically per visitor, the status pill currently displays an amber `Browser Cache · Click to Link Disk` warning (`[Link Disk]`), making casual web visitors think saving is broken or that they must grant local file permissions just to use the web app.
  3. **No way to reset cached browser state on hosted demos/apps (`EC48`):** Once a visitor edits an online `naizo.js` playground or tool, their edits persist in `localStorage` indefinitely with no UI or API (`Naizo.reset()`) to return the app to the clean initial `#naizodb` published on the server.
  4. **Broken relative `<script src>` paths when saving a hosted page to a local PC (`EC48`):** When a visitor on `https://naizo.js.org/examples/notes.html` downloads/exports the page to their computer (`~/Downloads/notes.html`) to use locally, a relative `<script src="../dist/naizo.js">` tag breaks when opened via `file://` because `../dist/naizo.js` does not exist on their local filesystem.
- **Decision & Rationale (Global Picture & Invariant Safety):**
  - **Connect the Web and Local PC lifecycles (`PRODUCT.md`):** Keep local self-saving (`Local Mode`) as the primary workflow on `file:`, `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `*.local`, `*.localhost`, or whenever a `fileHandle` is linked, while automatically entering **Online Mode** on remote `http:` / `https:` hosts when no `fileHandle` is linked (with explicit `naizo-mode="online|local|auto"` / `data-naizo-mode` override on `<html>` or `<body>`).
  - **Preserve truthful durability (`EC36`):** In Online Mode, show green **`Saved in Browser`** when `localStorage` succeeds (or amber `In-Memory Only` if storage is blocked)—never claiming `Synced to Disk` unless a local `fileHandle` is linked and written. This honors `EC36` (never conflating browser cache with disk writes) while giving web visitors an accurate, non-alarming status.
  - **Enable 1-click Web-to-Local PC App Exchange (`⬇ Save to PC` / `Naizo.downloadHTML()`):** Replace `Link Disk` in Online Mode with **`⬇ Save to PC`** (`Naizo.downloadHTML(filename?)`). When exporting via `Naizo.downloadHTML()` or when `Naizo.exportHTML()` runs in Online Mode, `getCleanHtmlString()` bakes all live `#naizodb` data and form attributes, rewrites any relative `naizo(.min).js` `<script src>` to the npm CDN URL (`https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js` or `dist/naizo.min.js`), and strips `naizo-mode="online"` / `data-naizo-mode="online"` so that opening the downloaded `.html` file on a local PC (`file://`) boots in **Local Mode** at the exact same moment and state the user had on the web (while keeping local relative `<script src>` paths intact when `Naizo.exportHTML()` or `performSingleDiskWrite()` runs in Local Mode).
  - **Provide safe, reversible `↺ Reset` (`Naizo.reset()`):** Capture the initial baseline state on boot (`initialDiskDb`, seeded from `diskDetailed.db` plus initial DOM defaults before `cachedState` is applied). In Online Mode, when the store differs from `initialDiskDb`, show **`↺ Reset`** (`#reset`, in place of `× Unlink`). Guard **`↺ Reset`** with an inline Shadow DOM mini-confirmation popover (`#reset-confirm`) AND back up the pre-reset state to `naizodb_backup_<key>` so even a confirmed reset can be undone via **`↺ Restore`**.
- **Alternatives Rejected / Trade-offs:**
  - **Rejected `window.confirm()` for `↺ Reset`:** Native modal dialogs are jarring, block the main thread, and can be suppressed by browsers or sandboxed iframes; an inline Shadow DOM mini-popover inside `#__naizodb_host__` is self-contained, accessible, and style-isolated (`D05`).
  - **Rejected opening `showSaveFilePicker` as the default primary button on remote `https://` pages:** While `showSaveFilePicker` exists on `https://` in Chromium, linking a live remote tab to a newly created local file confuses whether the user is editing the website or a local file, and fails in Safari/Firefox. Downloading a clean, portable `.html` snapshot via **`⬇ Save to PC`** works identically in all browsers and cleanly hands off to Local Mode when opened from disk (while authors who specifically want `showSaveFilePicker` on a remote host can still set `naizo-mode="local"`).

## D42 — Enforce non-overlapping Global Picture (`PRODUCT.md`), Why (`DECISIONS.md`), and What (`PLAN.md`) project memory roles

Accepted by the owner on 2026-10-22 (refining `D01` across `AGENTS.md`, `docs/PRODUCT.md`, `docs/DECISIONS.md`, and `.agents/skills/naizo-closeout/SKILL.md`).

- **Context & Problem (Why):** During `M4.5` planning, the initial draft of `D40` duplicated the task specification from `docs/PLAN.md` across `DECISIONS.md`, `PLAN.md`, `EDGE_CASES.md`, and `JOURNAL.md` while omitting the underlying rationale ("why"), the rejected alternatives, and the global product lifecycle update in `docs/PRODUCT.md`. When `DECISIONS.md` records only _what_ is being built rather than _why_ it was chosen, future sessions lose the architectural constraints and evidence that prevent regressions.
- **Decision & Rationale (Global Picture & Invariant Safety):** Assign each project memory document a distinct, non-overlapping question:
  1. `docs/PRODUCT.md` (**Global picture & lifecycles**): how `naizo.js` works end-to-end across Local Mode and Online Mode, target users, and core invariants.
  2. `docs/DECISIONS.md` (**Why**): every `Dxx` entry must explicitly state **1. Context & Problem (Why)**, **2. Decision & Rationale (Global Picture & Invariant Safety)**, and **3. Alternatives Rejected / Trade-offs**.
  3. `docs/PLAN.md` (**What & when**): concrete implementation specifications, API/DOM contracts, task sequencing, and verification evidence, referencing `Dxx` for rationale.
  4. `docs/EDGE_CASES.md` (**Boundary failure modes**): specific trigger conditions and their verified resolutions (`ECxx`).
  5. `docs/JOURNAL.md` (**Session delta**): 2–5 bullet cross-session handoff summary.
- **Alternatives Rejected / Trade-offs:**
  - **Rejected merging `DECISIONS.md` and `PLAN.md` into a single file:** Combining ADR rationale with task checklists makes both harder to scan; keeping `PLAN.md` focused on actionable implementation specs and `DECISIONS.md` focused on ADR rationale preserves fast orientation while keeping full context.

## D43 — Built-in declarative Mini-API Client (`naizo-get` / `naizo-post`) in core `naizo.js` (`M8`); reject declarative UI helpers (`naizo-filter`, `naizo-tab`)

Accepted by the owner on 2026-10-23. Schedules Milestone `M8` after `M6` (`EC50`), keeping the Mini-API Client inside the single `dist/naizo.js` bundle while rejecting declarative UI layout/filter helpers (`naizo-filter`, `naizo-tab`, `naizo-view`) from the core runtime.

- **Context & Problem (Why):**
  1. **Connecting self-persisting HTML apps to external APIs and webhooks:** Local and hosted `naizo.js` tools (issue triage boards, release checklists, status dashboards) often need to pull initial or live JSON from an HTTP endpoint (such as `api.github.com`, a static `.json` preset, or a local agent server on `http://localhost`) into `#naizodb`, or push `#naizodb` state out to a webhook (Slack, Discord, n8n, Zapier, Make, Google Apps Script).
  2. **Why `file://` (`Origin: null`) and `M4` store invariants require a tailored client (`EC50`):** Opening a file via `file://` sets the browser `Origin` header to `"null"`. Standard `fetch()` calls with `Content-Type: application/json` trigger a CORS `OPTIONS` preflight that many webhook and local endpoints reject, and blind webhooks often accept a simple `POST` without returning `Access-Control-Allow-Origin: *`. Furthermore, naive DOM-mutating fetch snippets bypass `M4`'s in-memory `store` (`D15`), risk XSS via `innerHTML` (`D22`, `EC18`), overwrite local data on HTTP `4xx`/`5xx` error payloads, or clobber user-edited `#naizodb` state on every page reload when `trigger="load"` is used carelessly.
  3. **Evaluating declarative UI helpers (`naizo-filter`, `naizo-tab` / `naizo-view`):** While prototyping the network client, we also evaluated adding declarative list filtering (`naizo-filter="listName"`) and tab toggling (`naizo-tab="id"` / `naizo-view="id"`) to `naizo.js`.
- **Decision & Rationale (Global Picture & Invariant Safety):**
  - **Ship the Declarative Mini-API Client inside `naizo.js` (`M8`):** Keep `naizo.js` a single drop-in `<script>` tag (~60 lines / <1 KB gzipped for `M8`) rather than splitting out a separate network plugin script, preserving single-tag authoring and `⬇ Save to PC` portability (`D41`).
  - **Store-first, XSS-safe routing (`naizo-into`, `naizo-path`, `naizo-body`, `Naizo.fetch()`):**
    - Support both short (`naizo-get`, `naizo-post`, `naizo-into`, `naizo-path`, `naizo-body`, `naizo-trigger`) and `data-naizo-*` attributes (`D08`), plus programmatic `Naizo.fetch(url, options?)`.
    - Send `POST` bodies with CORS-safelisted `Content-Type: text/plain;charset=UTF-8` to avoid `OPTIONS` preflight from `file://` (`Origin: null`), supporting `naizo-body="db | fields | custom | list:<name> | field:<key>"` (defaulting to full `#naizodb`). When `naizo-post` has no `naizo-into` (fire-and-forget webhook mode) and a `file://` CORS read error occurs after send, fall back to `mode: 'no-cors'` or report delivery cleanly when opted in.
    - Require `res.ok` (`HTTP 200–299`) before mutating state (`EC50`), traverse `naizo-path="a.b.0.c"` with `Object.hasOwn()` at every step (`EC24`, `EC38`), route `naizo-into="field:<key>"`, `"list:<name>"`, `"custom:<key>"`, or full `#naizodb` through the validated in-memory `store` (`D15`, `EC33`, `EC35`), and write selector targets (`naizo-into="#selector"`) via `textContent` / `writeElementValue()`—never `innerHTML` (`D22`, `EC18`).
    - Distinguish `naizo-trigger="click"` (default), `naizo-trigger="init"` (fetches on boot only when the target field/list is still empty so page reloads never overwrite user edits in `#naizodb`), and `naizo-trigger="load"` (explicit refresh on every boot).
  - **Dedicated rightmost wired-globe network indicator (`#net`) in the status pill (preserving `EC36`):**
    - Place a compact `14×14px` inline SVG wired-globe icon (`#net`) at the **very right end of the Shadow DOM status pill** (after all action buttons).
    - **Smart auto-show (respecting `isIgnoredElement()`):** Keep `#net` hidden (`display: none`) on pages that do not use the API client; automatically reveal `#net` whenever the page contains any non-ignored (`!isIgnoredElement(el)`) `[naizo-get]` / `[data-naizo-get]` / `[naizo-post]` / `[data-naizo-post]` element (checked on boot and `Naizo.bind()`) or as soon as `Naizo.fetch()` is invoked.
    - **Three visual states with minimum `600 ms` green visibility and native `title`:**
      1. **Idle (Gray `#64748b`, `title="API idle"`):** No requests currently active.
      2. **Active (Green `#10b981`, `title="API active"`):** Shown while `1+` requests are in flight, holding green for at least **`600 ms`** (`netHoldTimeout`, cleared in `detachListeners()`) on fast `2xx` completions before returning to gray so sub-`50 ms` local/cached calls remain visually perceptible.
      3. **Error (Red `#ef4444`, `title="API request failed"`):** Shown when the most recent request failed (`!res.ok`, JSON parse failure, or network/CORS error); clears automatically on the next request or when the user clicks `#net`.
    - **Zero custom tooltip DOM/CSS & clean export stripping:** Use the standard HTML `title` attribute on `#net` (matching `#restore`, `#copy`, and `#unlink`) rather than a custom hover popover, and strip `data-naizo-loading` (restoring `disabled` when runtime-added) in `getCleanHtmlString()` so exporting/downloading while a request is in flight never bakes a disabled button into the saved file.
  - **Unified behavior across Local Mode and Online Mode with explicit browser limits:**
    - In **Local Mode**, a successful `naizo-get` updates `store`, `localStorage`, and surgically writes the fetched data into `<script id="naizodb">` on disk—allowing a local CLI AI agent to read fetched API data directly from the `.html` file on disk. Document `file://` browser constraints (`Origin: null` requires `Access-Control-Allow-Origin: *` to read responses; `fetch('./local.json')` is blocked on `file://` by browser security).
    - In **Online Mode** (`https://`), a successful `naizo-get` (including same-origin relative `./preset.json` URLs) persists into `localStorage` (`Saved in Browser`) and is baked into any subsequent **`⬇ Save to PC`** download. Document `https://` browser constraints (no mixed-content `http://` requests; Chromium Private Network Access requires `Access-Control-Allow-Private-Network: true` when calling `http://localhost` from a public `https://` origin).
    - On network/CORS/HTTP failure, never overwrite existing `#naizodb` state (`EC50`), turn `#net` red (`title="API request failed"`), and dispatch `naizo:fetch`.
- **Alternatives Rejected / Trade-offs:**
  - **Rejected overwriting the main `#dot` / `#status` pill text for network activity or showing popup toasts:** Hijacking `#status` (`Synced to Disk` / `Saved in Browser`) for `Fetching...` or `Request Failed` conflates storage durability with transient network requests (`EC36`), and per-request popup toasts add visual noise; the rightmost `#net` wired globe keeps storage durability and network status cleanly separated.
  - **Rejected shipping the Mini-API Client as a separate plugin script:** A second `<script>` tag complicates CDN setup, AI agent prompts, and `⬇ Save to PC` URL rewriting (`D41`), whereas the client is ~60 lines and shares `store` validation and status pill helpers directly.
  - **Rejected `naizo-filter` and `naizo-tab` / `naizo-view` UI helpers in core `naizo.js`:** `naizo.js` is a data persistence and synchronization engine (**内蔵** _built-in data_ + **内臓** _internal organs_), not a general UI widget framework (`PRODUCT.md`). Real-world filtering and tabs quickly require multi-criteria logic (such as combined search + category dropdown + item counts in `examples/inventory.html` and `examples/notes.html`) or native HTML `<details naizo="key">` / radio bindings. Documenting clean 8-line search/filter and persisted-tab recipes in `docs/USAGE.md` and `skills/naizo/SKILL.md` (`M5`) avoids scope creep and runtime bloat.

## D44 — Per-substep verification, memory reconciliation, and local commits for multi-part plan items

Accepted by the owner on 2026-10-24 (refining `D02` across `AGENTS.md`, `docs/PLAN.md`, and `.agents/skills/naizo-closeout/SKILL.md`).

- **Context & Problem (Why):** When a milestone or task in `docs/PLAN.md` defines multiple numbered or lettered substeps (such as `M4.5a`–`M4.5e`, `M5.1`–`M5.2`, `M6.1`–`M6.2`, or `M8.1`–`M8.2`), implementing and committing all substeps in a single combined commit (as occurred during `M4.5`) merges distinct concerns—such as runtime event fixes, a new standalone example app, Online Mode behavior, and dead-code cleanup—into one large diff. That obscures the incremental checkpoints already designed into `docs/PLAN.md` and makes `git log`, `git bisect`, code review, Release Please changelog generation, and targeted rollback harder.
- **Decision & Rationale (Global Picture & Invariant Safety):** Whenever a planned milestone or task in `docs/PLAN.md` has substeps (`Mx.y` or `Mx.ya`–`Mx.yz`), execute them one substep at a time: implement, run proportional verification, reconcile project memory (`docs/PLAN.md`, `docs/EDGE_CASES.md`, `docs/JOURNAL.md`, and any affected docs), and create a separate local Conventional Commit for **each substep in sequence** before starting the next substep (unless two substeps are strictly inseparable to pass `vp check` / `vp test`, in which case keep the coupling minimal and explain why in the commit body).
- **Alternatives Rejected / Trade-offs:**
  - **Rejected batching all substeps of a milestone or task into a single end-of-turn commit:** Saving a few `git commit` invocations per turn is not worth losing atomic, reviewable, bisectable commit boundaries aligned with `docs/PLAN.md`.
  - **Rejected committing unverified intermediate substeps:** Every per-substep commit must pass proportional verification before committing so every commit in Git history remains green.

## D45 — Washi Editorial site minimalism, author-first styling fallback in AI guidance, `"theme": "system"` boot cleanliness, and broad single-file application framing

Accepted by the owner on 2026-10-28 during the `M6.1` review and interactive design-lab exploration. Refines `M5` (`docs/USAGE.md`, `skills/naizo/SKILL.md`), `M6.1` (`site/index.html`), `docs/PRODUCT.md`, `README.md`, and `AGENTS.md`.

- **Context & Problem (Why):**
  1. **AI "neuro-slop" visual fatigue on technical pages:** The initial `M6.1` layout of `site/index.html` relied on multi-column bento card grids for prose (`repeat(auto-fit, minmax(...))`), drop shadows, rounded pill badges, uppercase category chips on every card, electric SaaS blue (`#2563eb`), unspaced em-dashes (`—`), and 4-column tables with `white-space: nowrap` that shredded long descriptions. While functional, it hurt human reading flow and gave a generic AI-generated ("neuro-slop") impression.
  2. **Overly narrow "specs & checklists" product framing:** Repeatedly describing `naizo.js` only around _"specifications, engineering plans, checklists, and notebooks"_ made its scope sound restricted to documentation templates, when `naizo.js` can power almost any single-file HTML application (dashboards, inventory studios, personal trackers, calculators, visual canvases, interactive option labs, and custom micro-tools).
  3. **Boot-time theme persistence dirtying `initialDiskDb` in Online Mode (`EC48`):** If a page's boot script imperatively writes `Naizo.setField('theme', 'dark')` on load based on `window.matchMedia('(prefers-color-scheme: dark)')`, `store` diverges from `initialDiskDb` before the user touches anything—causing the Online Mode **`↺ Reset`** button to appear prematurely on first load.
  4. **Balancing anti-slop defaults with author freedom in `skills/naizo/SKILL.md`:** Consumer AI agents need concrete visual and typographic guidance so unstyled requests do not default to noisy card/badge clutter, yet must never override a user's explicit design, layout, or CSS framework preferences.
- **Decision & Rationale (Global Picture & Invariant Safety):**
  - **Washi Editorial design for `site/index.html` (verified via a dogfooded `naizo.js` Design Lab):** Use a single `900px` reading column on warm unbleached paper (`#faf8f5` light / `#141311` dark), literary serif headings (`Iowan Old Style` / `Palatino`) paired with humanist sans body copy (`16.5px`, `1.75` line-height), hair-thin horizontal dividers (`1px solid`), spaced en-dashes (`–`), a borderless top-right SVG sun/moon theme switcher, a collapsible `<details>` `#naizodb` JSON inspector drawer, 3-column tables, and miniature `.status-chip` pill previews with exact `#f59e0b` amber and `#10b981` green dots.
  - **Keep `"theme": "system"` clean on boot:** Default `fields.theme` to `"system"` in `#naizodb` and handle OS dark-mode detection via CSS (`@media (prefers-color-scheme: dark) { html:not([data-theme='light']) { ... } }`) and read-only DOM attribute syncing so `store` stays identical to `initialDiskDb` until the user explicitly toggles the theme.
  - **Author-first styling with Washi Editorial as the fallback in `skills/naizo/SKILL.md` and `AGENTS.md`:** Instruct AI agents to follow the author's explicit visual, layout, or framework preferences first, and to apply the calm Washi Editorial minimalist style only as a fallback when no styling preferences are specified.
  - **Broaden product framing & document the Interactive Option Lab workflow:** Update `docs/PRODUCT.md`, `README.md`, `AGENTS.md`, `docs/USAGE.md`, and `skills/naizo/SKILL.md` to frame `naizo.js` around any single-file HTML application for human & AI flows, and document the **Interactive Option Explorer / Review Lab** workflow (where an agent generates a `naizo.js` comparison page, the human selects options and writes feedback in the browser, presses `⌘S`, and the agent reads the chosen state directly from `<script id="naizodb">` on disk).
- **Alternatives Rejected / Trade-offs:**
  - **Rejected multi-column SaaS bento grids for `site/index.html`:** Multi-column card grids fragment prose reading order and waste horizontal space needed for code blocks and tables.
  - **Rejected enforcing a single mandatory visual theme in `skills/naizo/SKILL.md`:** Forcing minimalist editorial styling when a user asks for a dense dashboard, Basecoat UI (`examples/inventory.html`), or a specific aesthetic would work against user intent; making it the fallback when no preference is given gets the best of both worlds.
  - **Rejected OS round emojis (`🟡` / `🟢`) for status pill colors in the capability matrix:** Glossy 3D platform emojis clash with flat editorial typography, whereas `7px` CSS `.status-dot` circles use the exact `#f59e0b` and `#10b981` colors from `src/index.ts`.

## D46 — Synchronize all human docs, `site/index.html`, AI skills (`skills/naizo/SKILL.md`), and LLM endpoints (`site/llms.txt` & `site/llms-full.txt`) on every feature or milestone, with `site/SKILL.md` symlinked to `../skills/naizo/SKILL.md`

Accepted by the owner on 2026-10-28 (extending `D11`, `D42`, and `D44` across `AGENTS.md`, `.agents/skills/naizo-closeout/SKILL.md`, `site/SKILL.md`, `.github/workflows/ci.yml`, `docs/PUBLISHING.md`, and `docs/PLAN.md`, and superseding `D35`'s allowance for `dist/naizo.js` to lag between releases on `main`).

- **Context & Problem (Why):** Now that `M5` (`docs/USAGE.md`, `skills/naizo/SKILL.md`) and `M6` (`site/index.html`, `site/llms.txt`, `site/llms-full.txt`, `site/SKILL.md`) are live, `naizo.js` serves both human developers (via `README.md`, `docs/USAGE.md`, and `site/index.html`) and AI coding agents (via `AGENTS.md`, `skills/naizo/SKILL.md`, `site/SKILL.md`, `site/llms.txt`, and `site/llms-full.txt`). If a new feature or milestone updates only `README.md` and `docs/USAGE.md` while leaving `site/index.html`, `skills/naizo/SKILL.md`, `site/llms.txt`, or `site/llms-full.txt` behind, consumer AI agents and website visitors receive stale attribute/API tables. Furthermore, keeping two separate file copies at `skills/naizo/SKILL.md` and `site/SKILL.md` forces manual duplicate edits.
- **Decision & Rationale (Global Picture & Invariant Safety):**
  - **Single source of truth for `SKILL.md`, `gh skill` / `npx skills` CLI compatibility, & CI-enforced `dist/naizo.js` freshness on `main`:** Make `site/SKILL.md` a relative symlink to `../skills/naizo/SKILL.md` (matching `CLAUDE.md -> AGENTS.md` at the repository root) and stage `site/` in `.github/workflows/ci.yml` with `cp -RL site/. _site/` so GitHub Pages serves the dereferenced file at `/SKILL.md` while `gh skill publish` skips the symlink and validates `skills/naizo/SKILL.md` cleanly. Quote `description: '...'` in `SKILL.md` YAML frontmatter so ` #naizodb` is never truncated as a YAML 1.2 comment, keep stable release snippets (`@latest` npm CDNs, `gh skill install nickosh/naizo naizo`, `npx skills add nickosh/naizo --skill naizo`) separate from a dedicated **Experimental / In-Development (`main` Branch)** block that pairs `https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js` (or `./dist/naizo.js`) with `gh skill install nickosh/naizo naizo@main` and `npx skills add nickosh/naizo@main --skill naizo`, and enforce `git diff --exit-code dist/naizo.js` after `vp pack` in `.github/workflows/ci.yml` so `dist/naizo.js` on `main` is guaranteed to match `src/`.
  - **Three-tier documentation sync rule:** Require in `AGENTS.md` and `.agents/skills/naizo-closeout/SKILL.md` that whenever a new feature or milestone adds or modifies public attributes, `window.Naizo` APIs, events, runtime behaviors, or authoring patterns, **all three documentation tiers** are updated before closing out the feature or milestone:
    1. **Human documentation & repo instructions:** `README.md`, `docs/USAGE.md`, `docs/PRODUCT.md`, and `AGENTS.md`.
    2. **Public website (`site/`):** `site/index.html` (attribute reference table, `window.Naizo` API block, capability matrix, and playground when relevant).
    3. **AI skills & LLM discovery endpoints:** `skills/naizo/SKILL.md` (automatically reflected via symlink at `site/SKILL.md`), `site/llms.txt`, and `site/llms-full.txt`.
- **Alternatives Rejected / Trade-offs:**
  - **Rejected maintaining two separate copies of `SKILL.md` (`skills/naizo/SKILL.md` and `site/SKILL.md`):** Duplicate files inevitably drift; a relative symlink (`site/SKILL.md -> ../skills/naizo/SKILL.md`) plus `cp -RL` in CI gives both `vp dev` and GitHub Pages `/SKILL.md` from one canonical file.
  - **Rejected deferring website and `llms.txt` / `SKILL.md` updates to ad-hoc pre-release sweeps:** Deferring updates creates drift between what `dist/naizo.js` supports and what AI agents read from `/llms.txt` or `skills/naizo/SKILL.md` during active development.
