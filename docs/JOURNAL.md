# nakajs — Working Journal

Newest first. One short entry per working session, slice, or milestone: 2–5 concise bullets covering **done**, **decided** (when relevant), **verification or blockers**, and the **next concrete technical action**. Keep branch names, commit SHAs, PR numbers/status, push/pull/merge steps, and hosting-service run IDs in Git and chat, not here.

## 2026-10-18 — Added ecosystem comparison table to README.md

- Done: researched adjacent self-saving/declarative HTML tools (`ClayJS` / `HyperclayJS`, `Bento`, `Mavo`, `Alpine.js + @alpinejs/persist`, and `TiddlyWiki` / `Feather Wiki`) and added the `How naka.js Compares` feature matrix to `README.md`.
- Verified: markdown link/reference review and `git diff --check` pass (`vp check` and `vp test` not run for `README.md` documentation update).
- Next: execute `M3.1` and `M3.2`, then implement `M4.1` against the store before any other `M4` item.

## 2026-10-18 — Second source review: adopted store model, surgical disk sync, and tracked dist artifact; restructured M4

- Done: reviewed `src/index.ts`, `naka.js`, tests, playground, and build config; reproduced `EC06`, `EC09`, `EC11` and new cases `EC14` (unbound agent JSON destroyed on load), `EC15` (unknown `<select>` value coerced to `""`), `EC16` (full-document capture and baking per keystroke), and `EC17` (silent conflict discard, no unlink) with a throwaway jsdom probe; measured real bundle size (~4.7 KB minified + gzipped, ~6.3 KB gzipped unminified) and corrected `README.md` and `docs/PRODUCT.md`.
- Decided (owner): `D15` in-memory store as runtime truth with merge semantics, pass-through keys, single-attribute key contract, change-only `updatedAt`, and debounced capture; `D16` surgical `#nakadb` block writes for disk sync with full serialization reserved for `Naka.exportHTML()`, read-before-write live detection, conflict backup and notice, hash snapshot, and unlink; `D17` track built `dist/naka.js` with a CI freshness check and a dedicated `src/iife.ts` entry, resolving the `D09` jsDelivr `gh` URL contradiction.
- Done: restructured `M4` in `docs/PLAN.md` so `M4.1` (store) and `M4.2` (surgical sync) land before other hardening, added browser-level tests to `M4.4`, extended `M3.1` and `M7.1` for `D17`, and added `EC14`–`EC17` while rescoping `EC03`, `EC06`, `EC07`, `EC09`, `EC10`, and `EC11`.
- Verified: `vp check` (formatter fixes applied to `docs/DECISIONS.md` and `docs/EDGE_CASES.md`), `vp test` 5/5, markdown link/reference review, and `git diff --check` pass. Not decided: plain-text default for `contenteditable` storage and `showOpenFilePicker` as the link gesture remain evaluation items, not decisions.
- Next: execute `M3.1` and `M3.2`, then implement `M4.1` against the store before any other `M4` item.

## 2026-10-18 — Audited v0.1.0 runtime & architecture and scheduled M4 hardening after M3 repo reorganization

- Decided (owner): approve all findings from the `v0.1.0` source and architecture audit (`D12`–`D14` — explicit `naka`/`data-naka` binding, separating `naka-ignore` from `data-naka-runtime` export stripping, unmutated disk snapshot comparison, `</script` and `<!--` JSON escaping, normalized/scoped storage keys, live `fileHandle.getFile()` sync on focus/pre-write, ephemeral `data-naka-auto-template` lifecycle, deferred attribute baking, expanded input/table/list support, and symmetrical `Naka` API methods) and sequence them as `M4` immediately after `M3` repository reorganization so implementation happens once in `src/index.ts`.
- Done: recorded `D12`–`D14` in `docs/DECISIONS.md`, added `EC06`–`EC13` (`OPEN`) to `docs/EDGE_CASES.md`, and inserted `M4` (`M4.1`–`M4.4`, renumbering `M5`–`M7`) in `docs/PLAN.md`.
- Verified: markdown link/reference review and `git diff --check` pass (`vp check` and `vp test` not run for documentation-only planning update).
- Next: execute `M3.1` and `M3.2` (`dist/naka.js` build output, remove root `naka.js`, move `index.html` into `site/`, and add starter templates in `examples/`), then implement `M4` runtime hardening.

## 2026-10-18 — Planned M3–M6 roadmap: repo layout, consumer AI skill, GitHub Pages / js.org site, and CDN release pipeline

- Decided (owner): adopt clean repository separation (`D09` — emit `dist/naka.js` via `vp pack` and remove root `naka.js`, move playground to `site/`, keep starter templates in `examples/`, and place the distributable consumer AI skill in `skills/nakajs/SKILL.md`), maintainer-controlled CDN release workflows supporting both `workflow_dispatch` and GitHub Release publish triggers (`D10`), and GitHub Pages (`js.org`) website hosting with `/llms.txt`, `/llms-full.txt`, and `/SKILL.md` endpoints for unobstructed AI agent documentation ingestion (`D11`).
- Done: recorded `D09`–`D11` in `docs/DECISIONS.md` and added milestones `M3`–`M6` to `docs/PLAN.md`.
- Verified: markdown link/reference review and `git diff --check` pass (`vp check` and `vp test` not run for documentation-only planning update).
- Next: execute `M3.1` and `M3.2` (`dist/naka.js` build output, remove root `naka.js`, move `index.html` into `site/`, and add starter templates in `examples/`).

## 2026-10-18 — Completed Vite+ verification and edge-case test suite (M2)

- Done: resolved all Oxlint and type-aware `tsgolint` warnings in `src/index.ts` and `naka.js` (`toTextValue` string coercion helper, explicit `if/else` attribute toggles, and `void` on floating promises), aligned `package.json` `"types"` with `dist/index.d.mts`, expanded `tests/naka.test.ts` to 5 tests covering `Naka.get`/`Naka.set`, `naka:hydrate`, and `EC01`/`EC03`/`EC04`/`EC05`, and promoted `EC01`, `EC03`, `EC04`, and `EC05` to `fix`.
- Verified: `vp check` (0 warnings, 0 lint/type errors), `vp test` (5/5 tests passing in `tests/naka.test.ts`), `vp pack` (`dist/index.mjs`, `dist/index.d.mts`, `dist/index.iife.js`), and `git diff --check` pass.
- Next: review next feature milestone with the owner (such as Blob download fallback tests for `EC02` or additional `naka.js` runtime capabilities).

## 2026-10-18 — Reset to v0.1.0, added dual naka/data-naka attributes, and configured Vite+ toolchain

- Decided (owner): reset initial version to `0.1.0` (`D07`), adopt [Vite+](https://viteplus.dev/) (`vite-plus` / `vp` CLI) with TypeScript source in `src/index.ts` and root `naka.js` IIFE (`D06`), and support both concise `naka` / `naka-*` and HTML5 `data-naka` / `data-naka-*` attributes (`D08`).
- Done: created `vite.config.ts`, `tsconfig.json`, `.gitignore`, TypeScript runtime `src/index.ts`, synchronized standalone `naka.js` (`v0.1.0`), implemented the `EC05` fixes (`parseCachedState` guard + clearing plain text elements in inferred templates), updated `index.html`, `README.md`, and `AGENTS.md`, and added the Vitest suite in `tests/naka.test.ts`.
- Verified: `node --check naka.js`, JSON validation of `package.json` (`0.1.0`) and `index.html` `#nakadb`, and `git diff --check` pass. `vp install`, `vp check`, `vp test`, and `vp pack` were not run yet per owner request to run `vp install` manually.
- Next: after the owner runs `vp install`, run `vp check`, `vp test`, and `vp pack` to verify `src/index.ts` and `tests/naka.test.ts` and close `M2`.

## 2026-10-18 — Landed naka.js v1.1.0 core bundle, playground, and product specs (M0 & M1)

- Done: applied the `naka.js` `v1.1.0` project bundle (`package.json`, `naka.js`, `index.html`, `README.md`) and integrated the consumer AI agent HTML-authoring instructions into `AGENTS.md`; fixed a malformed markdown link inside the `README.md` CDN `<script>` code block.
- Decided: recorded core architectural decisions `D03`–`D06` in `docs/DECISIONS.md` (`#nakadb` embedded JSON schema + attribute baking, dual-layer persistence with snapshot-based conflict resolution, Shadow DOM + `data-naka-ignore` clean serialization, and zero-dependency IIFE distribution) and populated `docs/PRODUCT.md`, `docs/PLAN.md`, and `docs/EDGE_CASES.md` (`EC01`–`EC05`).
- Verified: `node --check naka.js`, JSON parsing of `package.json` and `index.html`'s `#nakadb` block, markdown link review, and `git diff --check` pass. Interactive browser/Playwright checks were not run in this session.
- Next: implement `M2.1` deterministic automated tests for DOM ↔ `#nakadb` sync, list repeater actions, and conflict resolution, and fix `EC05` (`M2.2`).

## 2026-10-18 — Project memory structure initialized

- Decided (owner): adopt the hybrid project memory layout (`D01` — `AGENTS.md` with `CLAUDE.md` symlink, `docs/PRODUCT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`, `docs/JOURNAL.md`, and `.agents/skills/nakajs-closeout/SKILL.md`) and automatic local commits with descriptive Conventional Commit bodies after verified changes (`D02`).
- Done: created the foundational memory documents, recorded `D01`–`D02`, and added the repository-scoped `nakajs-closeout` skill (`M0.1`).
- Verified: markdown links, file layout, `CLAUDE.md` symlink target, and `git diff --check` pass.
- Next: define `nakajs` product vision, core invariants, architecture, and toolchain with the owner (`M0.2`).
