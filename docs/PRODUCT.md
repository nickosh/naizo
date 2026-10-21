# naizo — Product Definition

Status: `v0.1.0` specification adopted 2026-10-18, updated 2026-10-21 (`D38`, `D39`). Companions: [PLAN.md](PLAN.md) (what to build and sequencing), [DECISIONS.md](DECISIONS.md) (why major decisions were made), [EDGE_CASES.md](EDGE_CASES.md) (boundary behaviors and resolution status).

## One-liner

**`naizo.js`** (`naizo`, npm package `naizojs`) is a zero-dependency, lightweight script (~4.7 KB minified + gzipped, ~6.3 KB gzipped unminified as of `v0.1.0`) providing a self-persisting HTML built-in database (`#naizodb`) and declarative list repeater (`[naizo-list]` / `[data-naizo-list]`) that keeps human edits in the browser and AI agent edits on disk in two-way sync.

## Name & Meaning

In Japanese, **_naizō_ (ないぞう)** unites two homophonous concepts that describe how `naizo.js` works:

- **内蔵 (_naizō_ — built-in / embedded / housed within):** Every HTML file houses its own built-in JSON micro-database (`<script id="naizodb" type="application/json">`) directly inside `<head>`.
- **内臓 (_naizō_ — internal organs / viscera):** Plain HTML markup is a static skeleton; `naizo.js` provides the vital internal organs—reactive inputs, dynamic list repeaters, and two-way disk synchronization—that make the file a living, self-persisting application.

## Problem

AI coding agents (Antigravity, Claude Code, Gemini CLI, Cursor, Codex) increasingly generate rich HTML artifacts for specs, implementation plans, interactive checklists, code reviews, and custom triage tools. Static HTML creates two friction points when humans interact with it:

1. **Static HTML forgets user input:** Checking boxes, editing notes, or adding tasks in a local `.html` file disappears on page refresh.
2. **Browser storage hides edits from AI agents:** Persisting state only to `localStorage` traps changes inside the browser profile. When a CLI or IDE AI agent reads the `.html` file from disk on the next turn, it cannot see the human's edits.

`naizo.js` bridges both worlds with a single `<script>` tag: human edits in the browser sync into `<script id="naizodb" type="application/json">` and back to the `.html` file on disk, while external agent edits to `#naizodb` on disk automatically hydrate the DOM on reload.

## Target users

- **Primary:** Developers and AI coding agents collaborating through local interactive HTML artifacts (plans, specs, checklists, triage boards, custom editors).
- **Secondary:** Authors of standalone, local-first single-file HTML tools who want persistent state and repeating list controls without a backend server or runtime dependencies.

## Core promises (product invariants — never compromise)

1. **In-file canonical JSON database (`#naizodb`)** — `<script id="naizodb" type="application/json">` in `<head>` holds `{ _meta, fields, lists, custom }` in clean, 2-space indented JSON that AI agents can read and edit directly on disk and Git can diff cleanly. Amended for `M4` by `D15`: keys without a matching DOM binding pass through untouched instead of being dropped on load.
2. **Two-way Human ↔ Agent conflict resolution & live watch** — On page load, before disk writes, on window focus, and via a lightweight ~2 s `file.lastModified` watch while a linked tab is visible, `naizo.js` compares the on-disk `#naizodb` block against the last known disk state. When the file on disk was modified externally (e.g., by a CLI AI agent running side-by-side), `naizo.js` performs a shallow top-level key merge (`fields[k]`, `lists[k]`, `custom[k]`), guards `document.activeElement` against mid-keystroke overwrite, and on same-key collision lets disk win while preserving the browser state in `naizodb_backup_<key>` with a 1-click `↺ Restore` action in the status pill (`D16`, `D20`, `D27`).
3. **Surgical disk sync & clean HTML serialization** — Syncing to a linked file on disk via the File System Access API (`FileSystemFileHandle` persisted in IndexedDB) rewrites only the `<script id="naizodb">` block in place, leaving all other bytes of the file untouched so third-party runtime DOM mutations (Tailwind Play CDN, Lucide, Mermaid) never bloat saved files (`D16`, `D24`). Explicit full-document export (`Naizo.exportHTML()` and fallback HTML download) bakes live input/select/checkbox/textarea values into HTML attributes on a cloned document and strips `[data-naizo-runtime]` elements (`#__naizodb_host__`, `#__naizodb_styles__`, injected list controls) while keeping user `[naizo-ignore]` elements intact (`D12`, `D23`).
4. **Dual declarative attribute syntax + programmatic API** — Both concise `naizo` / `naizo-*` attributes (`naizo="key"`, `naizo-list="name"`, `naizo-item`, `naizo-ignore`) and HTML5-compliant `data-naizo` / `data-naizo-*` attributes work interchangeably alongside the `window.Naizo` (`window.NaizoDB`) API (`D08`, `D38`).
5. **Zero runtime dependencies** — `naizo.js` ships as a standalone vanilla JavaScript IIFE (`dist/naizo.js` and minified `dist/naizo.min.js` built from `src/iife.ts`) usable directly via `<script src="./dist/naizo.js" defer></script>` or npm-backed CDN (`jsDelivr` / `unpkg`, `D34`, `D38`, `D39`), plus side-effect-free ESM and TypeScript declarations (`dist/index.mjs`, `dist/index.d.mts`) built from `src/index.ts` via Vite+ (`D06`, `D17`, `D25`, `D28`). Release preparation updates the tracked readable browser bundle; local development and CI rebuild from source before tests (`D35`).

## Design priority

Keep the tool lightweight, fast, and easy to add to ordinary HTML (`D26`, `D27`). Prefer a small API, useful defaults, and optional escape hatches. Preserve authors’ unknown JSON data and freedom to build custom widgets; require only what binding and safe persistence need. Reduce repeated DOM/serialization work before adding optimization machinery. Data-loss prevention and truthful persistence status (`Browser Cache` vs. `Synced to Disk`) remain part of the core promise.

## Scope and non-goals

- **In scope:** Declarative scalar field binding (`input`, `textarea`, `select`, `<details>`, `[contenteditable]`, `[naizo]`, `[data-naizo]`), single-level declarative list repeaters (`[naizo-list]` / `[data-naizo-list]`), custom key-value state (`Naizo.get`/`Naizo.set`), `localStorage` caching, surgical File System Access API disk write-back with IndexedDB handle persistence, 1-click `#naizodb` JSON clipboard copy (`Naizo.copyJSON()`), and fallback `.html` snapshot download (`Naizo.exportHTML()`).
- **Non-goals:** Backend servers, multi-user real-time network sync, or full frontend framework/virtual DOM replacement.
