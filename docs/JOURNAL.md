# nakajs — Working Journal

Newest first. One short entry per working session, slice, or milestone: 2–5 concise bullets covering **done**, **decided** (when relevant), **verification or blockers**, and the **next concrete technical action**. Keep branch names, commit SHAs, PR numbers/status, push/pull/merge steps, and hosting-service run IDs in Git and chat, not here.

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
