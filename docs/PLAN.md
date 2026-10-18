# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

`M0`, `M1`, and `M2` are complete (`v0.1.0` core runtime in `src/index.ts` and root `naka.js`, dual `naka` / `data-naka` attributes, `index.html` playground, Vite+ `vp check` / `vp test` / `vp pack` pipeline, and automated test coverage for `EC01`, `EC03`, `EC04`, and `EC05` in `tests/naka.test.ts`).

Next action: evaluate next feature slice with the owner (for example, automated `file://` / Blob download fallback tests to promote `EC02` from `PARTIAL` to `fix`, or rich template/artifact ergonomics).

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
