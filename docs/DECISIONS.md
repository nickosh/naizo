# nakajs — Decision Log (ADR-style)

Record durable architectural and owner decisions and their rationale. Allocate the next `Dxx` ID for new decisions; supersede an old decision explicitly rather than silently rewriting its history.

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

Adopted 2026-10-18. Rather than storing state only in browser storage or scattering state solely across DOM attributes, `naka.js` maintains a canonical JSON document inside `<script id="nakadb" type="application/json">` at the top of `<head>` with four top-level keys: `_meta`, `fields`, `lists`, and `custom`. Simultaneously, `readAndBakeElement()` bakes scalar values into standard HTML attributes (`value`, `checked`, `selected`, `textContent`). This gives AI coding agents a single structured JSON block at the top of the file to read and mutate while keeping the raw HTML markup self-contained.

## D04 — Dual-layer persistence with snapshot-based disk vs. browser conflict resolution

Adopted 2026-10-18. Every user edit immediately caches state in `localStorage` (`nakadb_state_<pathname>`) and schedules a debounced (250 ms) disk write via the File System Access API (`FileSystemFileHandle` persisted in IndexedDB `NakaDB_Handles`). Whenever `naka.js` writes to disk or hydrates from disk, it records the raw `#nakadb` string in `localStorage` under `nakadb_disk_hash_<pathname>`. On boot, if the current `#nakadb` text in the HTML file differs from `nakadb_disk_hash_<pathname>`, `naka.js` detects that an external process (such as an AI agent or text editor) modified the file on disk and hydrates from the disk state instead of the browser cache.

## D05 — Runtime UI isolation via Shadow DOM and `naka-ignore` / `data-naka-ignore`

Adopted 2026-10-18. The floating status/sync pill (`#__nakadb_host__`) mounts inside an open Shadow DOM root so its styles never collide with the host document. Auto-injected list stylesheet (`#__nakadb_styles__`), per-item action toolbars (`.naka-item-tools`), and list footers (`.naka-list-footer`) are marked with `naka-ignore="true"`. Before writing HTML back to disk or returning from `Naka.exportHTML()`, `getCleanHtmlString()` clones `document.documentElement` and strips `[naka-ignore], [data-naka-ignore], #__nakadb_host__, #__nakadb_styles__` so runtime controls never accumulate in saved files.

## D06 — TypeScript core in `src/` with Vite+ (`vite-plus`) toolchain and root `naka.js` IIFE

Amended by the owner on 2026-10-18 (superseding the initial plain-JS-only setup). Author the core runtime in TypeScript (`src/index.ts`) and use [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) configured via `vite.config.ts` as the unified toolchain for development (`vp dev`), formatting/linting/type-checking (`vp check`), testing (`vp test` with Vitest + `jsdom`), and library packaging (`vp pack` with `tsdown` emitting `dist/`). Keep the standalone zero-dependency IIFE `naka.js` at the repository root synchronized so `<script src="./naka.js" defer></script>` and CDN links (`jsDelivr` / `unpkg`) work directly without requiring consumers to run a build step.

## D07 — Reset initial version to `0.1.0` (experimental `0.x` series)

Accepted by the owner on 2026-10-18. Reset the initial version from the specification bundle's `1.1.0` placeholder to `0.1.0` across `package.json`, `src/index.ts`, `naka.js`, and documentation. All `0.x` releases are experimental while the core runtime and attribute contracts are refined; `1.0.0` is reserved for the first stability commitment.

## D08 — Dual attribute syntax (`naka` / `naka-*` and `data-naka` / `data-naka-*`)

Accepted by the owner on 2026-10-18. Support both concise `naka` / `naka-*` attributes (`naka="key"`, `naka-list="name"`, `naka-item`, `naka-template`, `naka-add`, `naka-remove`, `naka-move`, `naka-no-controls`, `naka-ignore`) and standard HTML5 `data-naka` / `data-naka-*` aliases (`data-naka="key"`, `data-naka-list="name"`, etc.). Reject `naka-data-*` because HTML5 requires custom data attributes to start with `data-`, making `naka-data-*` as verbose as `data-naka-*` without HTML5 validator compliance. Supporting both `naka*` and `data-naka*` gives humans and AI agents minimal token overhead by default while preserving strict HTML5 validity when needed.
