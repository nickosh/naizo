# AGENTS.md — nakajs

## What this project is

**`naka.js`** (`nakajs` `v0.1.0`) — zero-dependency, self-persisting HTML inner database (`#nakadb`) and declarative list repeater (`[naka-list]` / `[data-naka-list]`) for Human + AI Agent workflows. It turns static `.html` artifacts (specs, plans, checklists, triage boards, custom tools) into interactive, human-editable applications whose state syncs between the DOM, `<script id="nakadb" type="application/json">`, `localStorage`, and the local `.html` file on disk.

See [docs/PRODUCT.md](docs/PRODUCT.md) for product vision, target users, and scope boundaries.

Core promises (never compromise these):

1. **In-file canonical state (`#nakadb`)**: `<script id="nakadb" type="application/json">` in `<head>` holds `{ _meta, fields, lists, custom }` in human- and agent-readable JSON (`2`-space indented) alongside baked HTML input attributes.
2. **Two-way Human ↔ AI Agent sync**: On boot (and before disk writes / on tab focus), `naka.js` compares `#nakadb` on disk against its last known disk snapshot (`nakadb_disk_hash_<key>`). External edits on disk (e.g., by a CLI/IDE AI agent) supersede stale `localStorage` browser cache (backing up concurrent unlinked browser edits to `nakadb_backup_<key>` with a 1-click `↺ Restore` action in the status pill); otherwise, browser edits persist across refreshes even before linking disk (`D16`, `D27`).
3. **Surgical disk sync & clean HTML export**: Writing to a linked file via the File System Access API (`showSaveFilePicker` with handle persisted in IndexedDB `NakaDB_Handles`) surgically updates only the `<script id="nakadb">` block in place so third-party runtime DOM mutations (e.g., Tailwind CDN, Lucide, Mermaid) never pollute the file on disk (`D16`, `D24`). Full-HTML export (`Naka.exportHTML()` and Blob download fallback) bakes form attributes on a cloned document and strips `[data-naka-runtime]` UI (`#__nakadb_host__` Shadow DOM pill, `#__nakadb_styles__`, injected list controls) while keeping user `[naka-ignore]` elements intact (`D12`, `D23`).
4. **Dual attribute syntax**: Both short attributes (`naka="key"`, `naka-list="name"`, `naka-item`, `naka-ignore`, etc.) and HTML5-compliant `data-*` aliases (`data-naka="key"`, `data-naka-list="name"`, `data-naka-item`, `data-naka-ignore`, etc.) are supported everywhere (D08).
5. **Zero-dependency drop-in**: `naka.js` is a standalone vanilla JavaScript IIFE with no runtime dependencies, loadable locally or via CDN (`jsDelivr` / `unpkg`), authored in TypeScript (`src/index.ts`) and managed with the [Vite+](https://viteplus.dev/) (`vp`) toolchain.

License: MIT ([LICENSE](LICENSE)).

## Authoring HTML with `naka.js` (AI Agent Instructions)

Whenever you generate or update an interactive HTML file (plans, specs, checklists, triage boards, or custom editors), make it self-persisting using **`naka.js`**:

1. **Embed `#nakadb` in `<head>`:** Include `<script id="nakadb" type="application/json">` at the top of `<head>` initialized with:
   ```json
   {
     "_meta": {},
     "fields": {},
     "lists": {},
     "custom": {}
   }
   ```
2. **Load `naka.js`:** Include `<script src="./naka.js" defer></script>` (or the CDN URL `https://cdn.jsdelivr.net/gh/YOUR_USERNAME/nakajs@main/naka.js`) in `<head>`.
3. **Standalone Fields (`naka` or `data-naka`):** Bind inputs, checkboxes, radios, selects, and `contenteditable="true"` blocks using `naka="key_name"` (or `data-naka="key_name"`).
4. **Dynamic Lists (`naka-list` or `data-naka-list`):** For checklists, tables, or cards where the user may add, edit, reorder, or delete items, wrap the container in `naka-list="list_name"` (or `data-naka-list="list_name"`) and each repeating row/card in `naka-item` (or `data-naka-item`), using `naka="prop_name"` on fields inside the item.
5. **Custom Widgets (`window.Naka`):** Persist custom JavaScript state via `Naka.get('key')` and `Naka.set('key', value)`. Listen to the `'naka:hydrate'` window event to sync custom UI on load.
6. **Reading & Updating Files on Disk:** When inspecting or modifying an existing HTML file on disk, read or edit `<script id="nakadb">` directly—`naka.js` automatically hydrates the DOM and renders list items from `#nakadb` when opened in the browser.

## Start here — authoritative project memory

Read [docs/PLAN.md](docs/PLAN.md) and the latest entry in [docs/JOURNAL.md](docs/JOURNAL.md) before substantial work. Read relevant decisions in [docs/DECISIONS.md](docs/DECISIONS.md), known boundary cases in [docs/EDGE_CASES.md](docs/EDGE_CASES.md), and any affected specifications under `docs/`.

- [docs/PRODUCT.md](docs/PRODUCT.md) — product vision, target users, core promises (invariants), and scope boundaries.
- [docs/PLAN.md](docs/PLAN.md) — authoritative task, milestone/slice sequencing, and acceptance ledger.
- [docs/DECISIONS.md](docs/DECISIONS.md) — ADR-style log of durable architectural and owner decisions (`D01`, `D02`, ...).
- [docs/EDGE_CASES.md](docs/EDGE_CASES.md) — edge-case resolution ledger (`EC01`, `EC02`, ...; statuses: `ADR`, `fix`, `doc`, `PARTIAL`, `OPEN`).
- [docs/JOURNAL.md](docs/JOURNAL.md) — newest-first cross-session progress log.

Specs and contracts are hypotheses: when implementation or owner review changes behavior, update the matching specification in the same change as the code change.

Versions in documentation and memory identify feature targets and compatibility only. Do not maintain publication status, release dates, or pending-release markers in project memory; GitHub Releases and tags own publication state.

## Project memory and closeout

At the end of each state-changing session, independently useful development slice, milestone, or durable handoff, use the repository-scoped [nakajs-closeout](.agents/skills/nakajs-closeout/SKILL.md) skill to reconcile project memory from evidence. Read the skill file directly if the host has not registered repository skills; do not invent a slash command.

- Update affected contracts and specs in the same change as behavior.
- Mark tasks or milestones done in `docs/PLAN.md` only when their acceptance criteria and verification evidence are satisfied. Keep blocked and not-run checks explicit.
- Prepend one dated entry to `docs/JOURNAL.md` with 2–5 concise bullets covering done, decided when relevant, verification or blockers, and the next concrete technical action.
- Record durable architectural or owner decisions in `docs/DECISIONS.md` (`Dxx`), superseding prior decisions explicitly rather than silently rewriting history.
- Record reproduced edge cases or their tested resolutions in `docs/EDGE_CASES.md` (`ECxx`); `OPEN` means planned or unresolved, never "resolved by documentation."
- Do not record branch names, commit SHAs, PR numbers/status, push/pull/merge steps, or CI run/job identifiers in project memory documents; keep delivery bookkeeping in chat, Git history, and the hosting service.

## Toolchain & verification (`Vite+`)

This repository uses [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) configured in [vite.config.ts](vite.config.ts):

- `vp install` — install dependencies
- `vp check` — format (`Oxfmt`), lint (`Oxlint`), and type-check (`tsgolint`) in one pass
- `vp test` — run Vitest suite (`tests/**/*.test.ts`)
- `vp pack` — build library outputs (`dist/`) via `tsdown`
- `vp dev` — start local playground server (`http://localhost:3000`)

Use proportional verification:

- Documentation edits require link/reference review and whitespace checks (`git diff --check`).
- Code or behavior changes in `src/index.ts`, `naka.js`, or `index.html` require `vp check` and `vp test` (when `vite-plus` is installed), syntax checks (`node --check naka.js`), and JSON validation of `package.json` and embedded `#nakadb` blocks. Keep root `naka.js` synchronized with `src/index.ts`.
- Rerun checks when changes or unresolved concerns justify it, not only at closeout. Do not claim unrun checks passed or treat plans/fixtures as proof of passing behavior.

## Git workflow

- After completing and verifying each coherent change, including documentation changes, reconcile project memory and create a local commit without asking again unless the user explicitly requests otherwise.
- Use Conventional Commits for commit messages (`type(scope): subject`); include a scope only when it adds clarity. Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, and `build`.
- Every commit must include a factual body after the subject and a blank line explaining what changed, why, and any relevant limitations. Do not create subject-only commits. Scale the detail to the change. Validation results and checks not run belong in closeout documentation and chat; they are not required in commit bodies.
- Stage only changes belonging to the completed work. Preserve unrelated staged and unstaged changes. Leave incomplete or verification-blocked work uncommitted and report the blocker unless the user requests a checkpoint.
- This authorizes local commits only. Push, tag, publish, or open a pull request only when separately requested by the user.
