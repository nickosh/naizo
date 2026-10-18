# nakajs — Product Definition

Status: `v0.1.0` specification adopted 2026-10-18. Companions: [PLAN.md](PLAN.md) (what to build and sequencing), [DECISIONS.md](DECISIONS.md) (why major decisions were made), [EDGE_CASES.md](EDGE_CASES.md) (boundary behaviors and resolution status).

## One-liner

**`naka.js`** is a zero-dependency, lightweight script (~4.7 KB minified + gzipped, ~6.3 KB gzipped unminified as of `v0.1.0`) providing a self-persisting HTML inner database (`#nakadb`) and declarative list repeater (`[naka-list]` / `[data-naka-list]`) that keeps human edits in the browser and AI agent edits on disk in two-way sync.

## Problem

AI coding agents (Antigravity, Claude Code, Gemini CLI, Cursor, Codex) increasingly generate rich HTML artifacts for specs, implementation plans, interactive checklists, code reviews, and custom triage tools. Static HTML creates two friction points when humans interact with it:

1. **Static HTML forgets user input:** Checking boxes, editing notes, or adding tasks in a local `.html` file disappears on page refresh.
2. **Browser storage hides edits from AI agents:** Persisting state only to `localStorage` traps changes inside the browser profile. When a CLI or IDE AI agent reads the `.html` file from disk on the next turn, it cannot see the human's edits.

`naka.js` bridges both worlds with a single `<script>` tag: human edits in the browser sync into `<script id="nakadb" type="application/json">` and back to the `.html` file on disk, while external agent edits to `#nakadb` on disk automatically hydrate the DOM on reload.

## Target users

- **Primary:** Developers and AI coding agents collaborating through local interactive HTML artifacts (plans, specs, checklists, triage boards, custom editors).
- **Secondary:** Authors of standalone, local-first single-file HTML tools who want persistent state and repeating list controls without a backend server or runtime dependencies.

## Core promises (product invariants — never compromise)

1. **In-file canonical JSON database (`#nakadb`)** — `<script id="nakadb" type="application/json">` in `<head>` holds `{ _meta, fields, lists, custom }` in clean, 2-space indented JSON that AI agents can read and edit directly on disk and Git can diff cleanly. Amended for `M4` by `D15`: keys without a matching DOM binding pass through untouched instead of being dropped on load.
2. **Two-way Human ↔ Agent conflict resolution** — On page load, `naka.js` compares the current `#nakadb` text on disk against the last known disk snapshot (`nakadb_disk_hash_<pathname>`). If the file on disk was modified externally (e.g., by an AI agent), disk state wins and hydrates the DOM; otherwise, cached browser state (`nakadb_state_<pathname>`) hydrates the DOM.
3. **Clean HTML serialization** — Saving to disk (via the File System Access API with `FileSystemFileHandle` persisted in IndexedDB, or fallback HTML download) bakes live input/select/checkbox/textarea values into HTML attributes and strips all runtime-injected elements (`[naka-ignore]`, `[data-naka-ignore]`, `#__nakadb_host__`, `#__nakadb_styles__`). Amended for `M4` by `D16`: disk sync will rewrite only the `#nakadb` block and leave every other byte of the file untouched, while full-document serialization with runtime stripping remains the explicit `Naka.exportHTML()` snapshot mode.
4. **Dual declarative attribute syntax + programmatic API** — Both concise `naka` / `naka-*` attributes (`naka="key"`, `naka-list="name"`, `naka-item`, `naka-ignore`) and HTML5-compliant `data-naka` / `data-naka-*` attributes work interchangeably alongside the `window.Naka` (`window.NakaDB`) API (`D08`).
5. **Zero runtime dependencies** — `naka.js` ships as a standalone vanilla JavaScript IIFE usable directly via `<script src="./naka.js" defer></script>` or CDN (`jsDelivr` / `unpkg`), plus ESM/TypeScript declarations built from `src/index.ts` via Vite+ (`D06`).

## Design priority

Keep the tool lightweight, fast, and easy to add to ordinary HTML (`D26`). Prefer a small API, useful defaults, and optional escape hatches. Preserve authors’ unknown JSON data and freedom to build custom widgets; require only what binding and safe persistence need. Reduce repeated DOM/serialization work before adding optimization machinery. Data-loss prevention remains part of the core promise.

## Scope and non-goals

- **In scope:** Declarative scalar field binding (`input`, `textarea`, `select`, `[contenteditable="true"]`, `[naka]`, `[data-naka]`), single-level declarative list repeaters (`[naka-list]` / `[data-naka-list]`), custom key-value state (`Naka.get`/`Naka.set`), `localStorage` caching, File System Access API disk write-back with IndexedDB handle persistence, and fallback `.html` snapshot download.
- **Non-goals:** Backend servers, multi-user real-time network sync, or full frontend framework/virtual DOM replacement.
