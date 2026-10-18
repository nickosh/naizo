# nakajs — Implementation Plan

Accepted 2026-10-18. This is the authoritative task, sequencing, and acceptance ledger.

Versions in this document identify planned feature scope and compatibility. Task status records implementation and acceptance evidence. Publication state belongs to GitHub Releases and tags; do not maintain release-status markers here (D01). Tick checkboxes only when implementation and verification evidence are complete; append course corrections rather than rewriting history.

## Current state and next action

The repository is initialized with an MIT `LICENSE` and the hybrid project memory structure (`AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`, `docs/JOURNAL.md`, and `.agents/skills/nakajs-closeout/SKILL.md`).

Next action: define `nakajs` product scope, core invariants, architecture, and tech stack with the owner, then populate `docs/PRODUCT.md`, `AGENTS.md`, `docs/DECISIONS.md`, and the initial implementation milestones below.

## M0 — Project definition & foundation

- [x] **M0.1 — Project memory structure** (landed 2026-10-18): hybrid memory layout (`PRODUCT.md`, `PLAN.md`, `DECISIONS.md`, `EDGE_CASES.md`, `JOURNAL.md`), `AGENTS.md` + `CLAUDE.md` symlink, initial decisions D01–D02, and `.agents/skills/nakajs-closeout/SKILL.md`.
- [ ] **M0.2 — Product & architecture definition**: record problem statement, target users, core invariants, tech stack, and architectural boundaries in `docs/PRODUCT.md`, `docs/DECISIONS.md`, and `AGENTS.md`.
- [ ] **M0.3 — Repository & toolchain scaffolding**: initialize package manifest, directory layout, linter/formatter/typecheck/test runner, and deterministic verification commands.
