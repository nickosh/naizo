# AGENTS.md — naizo

## What this project is

**`naizo.js`** (`naizo` project, npm package `naizojs` `v0.1.0`) — zero-dependency, self-persisting HTML built-in database (`#naizodb`) and declarative list repeater (`[naizo-list]` / `[data-naizo-list]`) for Human + AI Agent workflows. Its name comes from the Japanese **_naizō_ (ないぞう)**: both **内蔵 (_built-in / embedded_)** and **内臓 (_internal organs_)**. It turns static `.html` artifacts (specs, plans, checklists, triage boards, custom tools) into interactive, human-editable applications whose state syncs between the DOM, `<script id="naizodb" type="application/json">`, `localStorage`, and the local `.html` file on disk.

See [docs/PRODUCT.md](docs/PRODUCT.md) for product vision, target users, and scope boundaries.

Core promises (never compromise these):

1. **In-file canonical state (`#naizodb`)**: `<script id="naizodb" type="application/json">` in `<head>` holds `{ _meta, fields, lists, custom }` in human- and agent-readable JSON (`2`-space indented, with `<` escaped as `\u003c`). Unbound fields, unbound lists, and extra list-item keys (such as `id` or `estimate`) pass through untouched via the in-memory store and row `WeakMap` (`D15`). Under `D16` and `D23`, `<body>` is the template and `#naizodb` is the data; form attributes are baked only on full-HTML export (`Naizo.exportHTML()`).
2. **Two-way Human ↔ AI Agent sync**: On boot, before disk writes, on tab focus, and via a lightweight ~2 s `file.lastModified` watch while a linked tab is visible, `naizo.js` compares `#naizodb` on disk against its last known disk state. External edits on disk (e.g., by a CLI/IDE AI agent) merge cleanly across unrelated top-level keys (`fields`, `lists`, `custom`) without clobbering `document.activeElement`, and back up same-key collisions to `naizodb_backup_<key>` with a 1-click `↺ Restore` action in the status pill (`D16`, `D20`, `D27`).
3. **Surgical disk sync & clean HTML export**: Writing to a linked file via the File System Access API (`showSaveFilePicker` with handle persisted in IndexedDB `NaizoDB_Handles`) surgically updates only the `<script id="naizodb">` block in place so third-party runtime DOM mutations (e.g., Tailwind CDN, Lucide, Mermaid) never pollute the file on disk (`D16`, `D24`). Full-HTML export (`Naizo.exportHTML()` and Blob download fallback) bakes form attributes on a cloned document and strips `[data-naizo-runtime]` UI (`#__naizodb_host__` Shadow DOM pill, `#__naizodb_styles__`, injected list controls) while keeping user `[naizo-ignore]` elements intact (`D12`, `D23`).
4. **Dual attribute syntax**: Both short attributes (`naizo="key"`, `naizo-list="name"`, `naizo-item`, `naizo-ignore`, etc.) and HTML5-compliant `data-*` aliases (`data-naizo="key"`, `data-naizo-list="name"`, `data-naizo-item`, `data-naizo-ignore`, etc.) are supported everywhere (D08).
5. **Zero-dependency drop-in**: `naizo.js` is a standalone vanilla JavaScript IIFE (`dist/naizo.js`) with no runtime dependencies, loadable locally or via CDN (`jsDelivr` / `unpkg`), authored in TypeScript (`src/index.ts` and `src/iife.ts`) and managed with the [Vite+](https://viteplus.dev/) (`vp`) toolchain.

License: MIT ([LICENSE](LICENSE)).

## Authoring HTML with `naizo.js` (AI Agent Instructions)

Whenever you generate or update an interactive HTML file (plans, specs, checklists, triage boards, or custom editors), make it self-persisting using **`naizo.js`** (see starter templates in `examples/starter.html`, `examples/checklist.html`, and `examples/inventory.html`):

1. **Embed `#naizodb` in `<head>`:** Include `<script id="naizodb" type="application/json">` at the top of `<head>` initialized with:
   ```json
   {
     "_meta": {},
     "fields": {},
     "lists": {},
     "custom": {}
   }
   ```
2. **Load `naizo.js`:** Include `<script src="./dist/naizo.js" defer></script>` for a local copy, or use one npm-backed CDN URL: `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js` / `https://unpkg.com/naizojs@latest/dist/naizo.js`. Use `dist/naizo.min.js` for the prebuilt minified bundle. `@latest` follows npm releases as caches refresh; use an exact version such as `@0.1.0` for a fixed artifact. CDN URLs require a published npm package/version. Prefer these npm-backed URLs when authoring CDN examples (`D34`, `D38`, `D39`).
3. **Standalone Fields (`naizo` or `data-naizo`):** Bind inputs (`text`, `number`, `range`, `checkbox`, `radio`), `<textarea>`, `<select>` (including `multiple`), `<details>` (`open` state), and `contenteditable` blocks (plain text via `textContent`) using `naizo="key_name"` (or `data-naizo="key_name"`).
4. **Dynamic Lists (`naizo-list` or `data-naizo-list`):** For checklists, tables (`<tbody naizo-list>`), or cards where the user may add, edit, reorder, or delete items, wrap the container in `naizo-list="list_name"` (or `data-naizo-list="list_name"`) and each repeating row/card in `naizo-item` (or `data-naizo-item`), using `naizo="prop_name"` on fields inside the item (or on the `[naizo-item]` root itself) and wrapping `<label>` elements around inputs (`EC39`).
5. **Custom Widgets (`window.Naizo`):** Persist custom JavaScript state via `Naizo.get('key')`, `Naizo.set('key', value)`, and `Naizo.delete('key')`, or manipulate fields and lists programmatically via `Naizo.getField`, `Naizo.setField`, `Naizo.deleteField`, `Naizo.getList`, `Naizo.addItem`, `Naizo.updateItem`, `Naizo.moveItem`, `Naizo.removeItem`, `Naizo.bind(root)`, `await Naizo.save()`, `await Naizo.unlink()`, `await Naizo.copyJSON()`, and `Naizo.exportHTML()`. Listen to `'naizo:hydrate'`, `'naizo:change'`, and `'naizo:item'` window events to sync custom UI.
6. **Reading & Updating Files on Disk:** When inspecting or modifying an existing HTML file on disk, treat `<body>` as the template and `<script id="naizodb">` as the canonical data (`D16`): read or edit `<script id="naizodb">` to change data, and edit `<body>` markup to change the view. `naizo.js` automatically hydrates the DOM, merges external disk edits across unrelated top-level keys (`fields`, `lists`, `custom`), and renders list items from `#naizodb` in the browser.

## Start here — authoritative project memory

Read [docs/PLAN.md](docs/PLAN.md) and the latest entry in [docs/JOURNAL.md](docs/JOURNAL.md) before substantial work. Read relevant decisions in [docs/DECISIONS.md](docs/DECISIONS.md), known boundary cases in [docs/EDGE_CASES.md](docs/EDGE_CASES.md), and any affected specifications under `docs/`.

- [docs/PRODUCT.md](docs/PRODUCT.md) — **Global picture & lifecycles**: product vision, target users, connected Local Mode / Online Mode lifecycles, core promises (invariants), and scope boundaries.
- [docs/PLAN.md](docs/PLAN.md) — **What & when**: authoritative task, implementation specification, milestone/slice sequencing, and acceptance ledger.
- [docs/DECISIONS.md](docs/DECISIONS.md) — **Why**: ADR-style log of durable architectural and owner decisions (`D01`, `D02`, ...), capturing context/problem, rationale & invariant safety, and rejected alternatives.
- [docs/EDGE_CASES.md](docs/EDGE_CASES.md) — **Boundary failure modes**: edge-case resolution ledger (`EC01`, `EC02`, ...; statuses: `ADR`, `fix`, `doc`, `PARTIAL`, `OPEN`).
- [docs/JOURNAL.md](docs/JOURNAL.md) — **Session delta**: newest-first cross-session progress log.

Specs and contracts are hypotheses: when implementation or owner review changes behavior, update the matching specification in the same change as the code change.

Versions in documentation and memory identify feature targets and compatibility only. Do not maintain publication status, release dates, or pending-release markers in project memory; GitHub Releases and tags own publication state.

## Engineering collaboration & design discussions

- **Plan and evaluate before coding:** When exploring a new idea, workflow, or external inspiration, analyze how it interacts with `naizo.js`'s core identity (**内蔵** _built-in data_ + **内臓** _internal organs_), the in-memory `store` architecture (`D15`), and existing invariants (`ECxx`) before writing code or mutating project memory. Wait for explicit owner approval when the user asks to discuss or plan first.
- **Honest engineering pushback (keep what fits, drop what doesn't):** Do not rubber-stamp every draft snippet or feature idea. Actively recommend what belongs in the core runtime (data persistence, `#naizodb` synchronization, list array CRUD, declarative API data flow) and push back when an idea is scope creep, a general UI/layout helper (`naizo-tab`, `naizo-filter`), or unnecessary UX/DOM complexity (e.g., custom tooltip popovers where native `title` suffices).
- **Plain-language scenarios & concrete options:** Explain subtle browser or architectural constraints (such as `file://` `Origin: null` CORS rules, relative `<script src>` paths breaking after `⬇ Save to PC`, or HTML5 `storage` event tab isolation) using concrete step-by-step examples and numbered trade-off options rather than abstract jargon.
- **Cross-milestone & dead-code audits:** Before finalizing a plan, audit how new slices affect existing milestones, CI/Pages staging, and exports, and proactively identify stale code or boundary traps (`isIgnoredElement()` guards, mid-flight export cleanup, listener/timer teardown).
- **Clean-room design:** Treat external tools strictly as high-level product inspiration; never copy code, markup, styles, or unlicensed assets, and always design solutions natively around `naizo.js`'s own declarative store.

## Project memory and closeout

At the end of each state-changing session, independently useful development slice, milestone, or durable handoff, use the repository-scoped [naizo-closeout](.agents/skills/naizo-closeout/SKILL.md) skill to reconcile project memory from evidence. Read the skill file directly if the host has not registered repository skills; do not invent a slash command.

- Update affected contracts and specs in the same change as behavior.
- Mark tasks or milestones done in `docs/PLAN.md` only when their acceptance criteria and verification evidence are satisfied. Keep blocked and not-run checks explicit.
- Prepend one dated entry to `docs/JOURNAL.md` with 2–5 concise bullets covering done, decided when relevant, verification or blockers, and the next concrete technical action.
- Record durable architectural or owner decisions in `docs/DECISIONS.md` (`Dxx`), superseding prior decisions explicitly rather than silently rewriting history. Every `Dxx` entry must explain **why** (Context & Problem, Decision & Rationale / Invariant Safety, and Alternatives Rejected / Trade-offs) rather than duplicating the task checklist from `docs/PLAN.md`. Update `docs/PRODUCT.md` when a decision expands or refines the global product lifecycle.
- Record reproduced edge cases or their tested resolutions in `docs/EDGE_CASES.md` (`ECxx`); `OPEN` means planned or unresolved, never "resolved by documentation."
- Do not record branch names, commit SHAs, PR numbers/status, push/pull/merge steps, or CI run/job identifiers in project memory documents; keep delivery bookkeeping in chat, Git history, and the hosting service.

## Toolchain & verification (`Vite+`)

This repository uses [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) configured in [vite.config.ts](vite.config.ts):

Prefer the global `vp` CLI for local development. Project environment pins live in [`.node-version`](.node-version) (Node 24.22.0), [`package.json`](package.json) (`packageManager: pnpm@12.14.0`, exact `vite-plus: 1.3.0`), and the lockfile. Use `vp env current` / `vp env doctor` to inspect resolution and `vp node` for Node scripts. Change project pins with `vp env pin`; keep CI reading those declarations and avoid changing user-global defaults. Native npm commands remain appropriate for the registry-specific publication flow in [docs/PUBLISHING.md](docs/PUBLISHING.md).

Release Please 17.11.2 is isolated in the private [`.github/release-tools/package.json`](.github/release-tools/package.json), with its own npm lockfile. Install it using `vp env exec -- npm ci --prefix .github/release-tools --ignore-scripts --no-audit --no-fund` and test using `vp node --test .github/release-tools/test.cjs`. Keep tooling out of root/runtime dependencies and the eight-file npm distribution. Changes to release automation require these tests and workflow lint in addition to the main checks.

Release preparation is explicit: ordinary pushes only check merged release PRs. A manual blank-input `prepare-release.yml` request or a newly pushed commit with a stable `Release-As:` footer prepares/refreshes a release PR, including its generated readable browser bundle. Preparation requires the build source to still match the primary branch; retry explicitly if it advances. Ordinary pushes convert a release PR that is behind the primary branch to draft until an explicit refresh marks it ready. Preserve descriptive commit bodies and any intended footer when squashing. The manual `v0.1.0` bootstrap precedes subsequent preparation; unfinished drafts require recovery. Only `release.yml` receives npm OIDC identity. See [docs/PUBLISHING.md](docs/PUBLISHING.md) for rollout and recovery.

[`pnpm-workspace.yaml`](pnpm-workspace.yaml) sets `runtimeOnFail: ignore` and `pmOnFail: ignore` so VP owns environment selection, and `lockfile.includeResolutionSettings: true` so the lockfile records resolution policy for consistent frozen installs. Keep dependency build approvals explicit if future dependencies need lifecycle scripts.

- `vp install` — install dependencies
- `vp check` — format (`Oxfmt`), lint (`Oxlint`), and type-check (`tsgolint`) in one pass
- `vp test` — run Vitest suite (`tests/**/*.test.ts`) after `vp pack`, because tests load generated browser output
- `vp pack` — build library outputs (`dist/naizo.js`, `dist/naizo.min.js`, `dist/index.mjs`, `dist/index.d.mts`) via `tsdown`
- `vp dev` — start local playground server (`http://localhost:3000`, serving `site/index.html`)

Use proportional verification:

- Documentation edits require link/reference review and whitespace checks (`git diff --check`).
- Code or behavior changes in `src/`, `dist/naizo.js`, `site/index.html`, or `examples/` require `vp check`, `vp test`, and `vp pack` (when `vite-plus` is installed), syntax checks (`node --check dist/naizo.js`), and JSON validation of `package.json` and embedded `#naizodb` blocks. Run `vp pack` before `vp test` and before using the local demo. Ordinary source changes do not require a generated bundle commit: explicit release preparation builds `dist/naizo.js` in a read-only job and includes it in the Release Please PR (`D35`). The bot-created release PR receives no CI run; the preparation job's build/test verifies its bundle, and tagged publication enforces tracked-bundle freshness. Ordinary CI tests freshly built outputs and deploys GitHub Pages from verified `main` (`D37`). Only the readable bundle is tracked.
- Rerun checks when changes or unresolved concerns justify it, not only at closeout. Do not claim unrun checks passed or treat plans/fixtures as proof of passing behavior.

## Git workflow

- After completing and verifying each coherent change, including documentation changes, reconcile project memory and create a local commit without asking again unless the user explicitly requests otherwise.
- Use Conventional Commits for commit messages (`type(scope): subject`); include a scope only when it adds clarity. Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, and `build`.
- Every commit must include a factual body after the subject and a blank line explaining what changed, why, and any relevant limitations. Do not create subject-only commits. Scale the detail to the change. Validation results and checks not run belong in closeout documentation and chat; they are not required in commit bodies.
- Do not add a `Co-authored-by: Copilot` trailer (or any other AI co-author trailer) to commit messages.
- Stage only changes belonging to the completed work. Preserve unrelated staged and unstaged changes. Leave incomplete or verification-blocked work uncommitted and report the blocker unless the user requests a checkpoint.
- This authorizes local commits only. Push, tag, publish, or open a pull request only when separately requested by the user.
