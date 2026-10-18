# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

`M0` and `M1` are complete: the `v1.1.0` core bundle (`package.json`, `naka.js`, `index.html`, `README.md`, and `AGENTS.md`) is landed and reconciled with the hybrid project memory structure (`docs/PRODUCT.md`, `docs/DECISIONS.md` `D01`–`D06`, `docs/EDGE_CASES.md` `EC01`–`EC05`). Syntax, JSON validity, and formatting checks pass; interactive browser/Playwright verification has not been run yet.

Next action: begin `M2` by adding deterministic automated tests for DOM ↔ `#nakadb` synchronization, declarative list repeater operations, external-edit conflict resolution (`EC01`), clean HTML export (`EC03`), and fixing `EC05`.

## M0 — Project definition & foundation  ✅ done 2026-10-18

- [x] **M0.1 — Project memory structure** (landed 2026-10-18): hybrid memory layout (`PRODUCT.md`, `PLAN.md`, `DECISIONS.md`, `EDGE_CASES.md`, `JOURNAL.md`), `AGENTS.md` + `CLAUDE.md` symlink, initial decisions `D01`–`D02`, and `.agents/skills/nakajs-closeout/SKILL.md`.
- [x] **M0.2 — Product & architecture definition** (landed 2026-10-18): recorded problem statement, target users, core invariants, and architectural decisions (`D03`–`D06`) in `docs/PRODUCT.md`, `docs/DECISIONS.md`, and `AGENTS.md`, plus boundary ledger `EC01`–`EC05` in `docs/EDGE_CASES.md`.
- [x] **M0.3 — Repository & package manifest scaffolding** (landed 2026-10-18): initialized `package.json` (`nakajs` `1.1.0`, npm/jsDelivr/unpkg entry points, `npm run dev` local server script) and `README.md`.

## M1 — Core library (`naka.js` v1.1.0) & interactive playground  ✅ done 2026-10-18

- [x] **M1.1 — Core `naka.js` runtime** (landed 2026-10-18):
  - IndexedDB `FileSystemFileHandle` persistence (`NakaDB_Handles`).
  - Automatic creation, parsing, and 2-space formatting of `<script id="nakadb" type="application/json">`.
  - Scalar element binding (`input`, `textarea`, `select`, `[contenteditable="true"]`, `[data-naka]`) and attribute baking.
  - Declarative list repeater (`[data-naka-list]`, `[data-naka-item]`, `[data-naka-template]`, auto-injected controls, `+ Add Item`, `↑`/`↓`/`×`).
  - Dual-layer persistence (`localStorage` + File System Access API / Blob download fallback) and external-edit conflict resolution (`D04`, `EC01`).
  - Shadow DOM status pill (`#__nakadb_host__`) and clean HTML serialization (`getCleanHtmlString()`).
  - Public `window.Naka` / `window.NakaDB` API (`get`, `set`, `getList`, `addItem`, `removeItem`, `moveItem`, `save`, `exportHTML`) and `naka:hydrate` custom event.
- [x] **M1.2 — Interactive playground (`index.html`)** (landed 2026-10-18): demo covering standalone `data-naka` inputs, `data-naka-list="tasks"` checklist repeater, `contenteditable="true"` notes, and custom range slider widget using `Naka.get`/`Naka.set` and `naka:hydrate`.

## M2 — Automated verification & edge-case hardening

- [ ] **M2.1 — Deterministic test suite**: add automated DOM/browser tests verifying scalar bindings, attribute baking, list repeater (`addItem`, `removeItem`, `moveItem`), `Naka.exportHTML()` cleanup (`EC03`), invalid `#nakadb` fallback (`EC04`), and external-disk vs. `localStorage` conflict resolution (`EC01`).
- [ ] **M2.2 — Resolve `EC05`**: guard `JSON.parse(cachedRaw)` in `init()` against corrupted `localStorage` payloads and clear plain `[data-naka]` text elements when inferring a list `<template>` in `ensureListBlueprints()`.
