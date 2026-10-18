# nakajs — Working Journal

Newest first. One short entry per working session, slice, or milestone: 2–5 concise bullets covering **done**, **decided** (when relevant), **verification or blockers**, and the **next concrete technical action**. Keep branch names, commit SHAs, PR numbers/status, push/pull/merge steps, and hosting-service run IDs in Git and chat, not here.

## 2026-10-18 — Fifth source/design review: smaller core and ordinary HTML integration

- Done: reviewed both runtime artifacts, tests, packaging, playground, and all project memory. Corrected the README's unimplemented live handle claim and documented snapshot asset/relocation limits. Production code is unchanged.
- Evidence: isolated jsdom documents against root `naka.js` and the freshly built source IIFE reconfirmed destructive invalid-source recovery, unbound-data loss, data-as-markup hydration, and stale custom-state restoration (`EC04`, `EC14`, `EC18`, `EC32`). Added `EC38`–`EC40` for lost `__proto__` keys, duplicate row IDs/label targets, and row-initialization gaps; extended `EC12` with changed native reset defaults. Snapshot-relative URLs resolved beside the copy, rather than beside the original.
- Recommended, not accepted: choose one data API before adding bucket methods; define programmatic edits versus `save()`; consider one cache checkpoint envelope and UTF-8-only source preservation; retain delegated row behavior or a small initialization signal. Reduce owner decision gates to public data/API and conflict policy, and defer merging, mandatory item IDs, public adapters, and rich text. No milestone completion or new owner decision recorded.
- Verified: baseline `vp check`, `vp test` (5/5), `vp pack`, `node --check naka.js`, and package/playground JSON validation passed. Documentation formatting, local links/decision references, and `git diff --check` passed after reconciliation. Probes are characterization evidence, not landed regression tests. Real-browser/native picker, actual listener execution through user interaction, and OS-level concurrency checks were not run.
- Next: settle the public data/API and overwrite policy, fold the chosen scope into M3/M4 task text, then implement M3.1's generated artifact/minimal CI and the focused M4 preservation/reload harness before replacing the core.

## 2026-10-18 — Simplification review and lightweight product priority

- Decided (owner direction): recorded `D26` for a lightweight, fast tool with few authoring requirements; reflected it in `PRODUCT.md`. Specific changes to the runtime/API remain pending.
- Recommended: one store/change/save path, optional item IDs, disk fingerprint plus recoverable backup without a merge-base database, explicit late binding, minimal validation, and private test seams. Defer automatic merging, rich text, public adapters, and general history/configuration UI; decide the common data API before adding namespace-specific methods. Added a concise scope comparison to `PLAN.md` without changing accepted milestones.
- Evidence: a 500-field jsdom probe of the built source IIFE counted 500 attribute writes and two serializations for one input event, three serializations for one custom setter, and 100 parses for 100 getters. Measured existing unminified gzip sizes only; no rewrite size/latency claim. Production code is unchanged.
- Verified: documentation formatting, local link/decision reference review, and `git diff --check` pass. Runtime test/build/browser suites were not rerun for this documentation-only follow-up; the operation-count probe is not a behavioral regression suite.
- Next: settle D18’s public data shape under D26, then implement M3.1 with the minimal CI/artifact checks and the focused M4 regression harness.

## 2026-10-18 — Fourth source/design review: durability, validation, and narrower hardening scope

- Done: reviewed both runtime artifacts, all five tests, build/package configuration, playground, and project memory; reproduced `EC32`–`EC37` (cache/custom mismatch, invalid shapes, startup event gap, non-JSON API values, save acknowledgement/status, package entry mismatch) and narrowed `EC04` to `PARTIAL` after destructive startup recovery. Production code is unchanged.
- Evidence: isolated jsdom probes exercised root `naka.js` and the freshly built source IIFE, including delayed IndexedDB and a granted mock handle; source-bundle null-item hydration threw after removing all rows. A separate probe rejected `D13`’s comment escape as invalid JSON, verified Unicode-escaped HTML/JSON round trips, and showed a BOM lost by text decoding/re-encoding. Package-main import in Node reproduced `ReferenceError: location is not defined`.
- Recommended, not accepted: move minimal CI and regression characterization ahead of examples/site work; add validation, full-state hydration, readiness/disposal, an explicit durability contract, and source/concurrency constraints to M4. Adopt targeted capture/plain text/export-only baking/queued writes; stage or defer namespace flattening, automatic list merging, rich text, and public adapters. No new owner decision or milestone completion recorded.
- Verified: `vp check`, `vp test` (5/5), `vp pack`, `node --check naka.js`, and JSON validation of `package.json` and the playground database passed before documentation reconciliation. Documentation formatting, local link/reference review, and `git diff --check` passed after it. Real browser/native picker, OS-level concurrent writer, and cross-browser tests were not run; probes characterize defects, not fixes.
- Next: review the fourth-review recommendations in `PLAN.md`, implement `M3.1` with minimal CI and actual artifact/package-entry tests, then build the proposed `M4.0` regression harness before replacing the runtime.

## 2026-10-18 — Third source review: reproduced EC18–EC31 and proposed D18–D25 (pending owner decision)

- Done: reviewed `src/index.ts`, root `naka.js`, tests, playground, and project memory; reproduced `EC18`–`EC28`, `EC30`, and `EC31` with throwaway jsdom probes against `src/index.ts` and the shipped `naka.js` (a mocked `FileSystemFileHandle` for `EC26` / `EC28`; `EC27` simulated in one window; `EC29` confirmed by inspection), then deleted the probes; repaired the `EC12` table row that the formatter had split at an escaped pipe.
- Proposed, not accepted: `D18` single data namespace with `_meta.schema`, `D19` stable list item identity, `D20` base snapshot for three-way merge, `D21` event-targeted capture, `D22` plain-text `contenteditable`, `D23` export-only attribute baking, `D24` write safety, and `D25` factory core with persistence adapters; plan adjustments are listed under "Pending owner review" in `docs/PLAN.md`.
- Verified: `vp check`, `vp test` (5/5), markdown link/reference review, and `git diff --check` pass.
- Next: owner reviews `D18`–`D25` and the pending plan adjustments; meanwhile execute `M3.1`.

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
