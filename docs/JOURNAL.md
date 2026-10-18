# nakajs — Working Journal

Newest first. One short entry per working session, slice, or milestone: 2–5 concise bullets covering **done**, **decided** (when relevant), **verification or blockers**, and the **next concrete technical action**. Keep branch names, commit SHAs, PR numbers/status, push/pull/merge steps, and hosting-service run IDs in Git and chat, not here.

## 2026-10-18 — Project memory structure initialized

- Decided (owner): adopt the hybrid project memory layout (`D01` — `AGENTS.md` with `CLAUDE.md` symlink, `docs/PRODUCT.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`, `docs/JOURNAL.md`, and `.agents/skills/nakajs-closeout/SKILL.md`) and automatic local commits with descriptive Conventional Commit bodies after verified changes (`D02`).
- Done: created the foundational memory documents, recorded `D01`–`D02`, and added the repository-scoped `nakajs-closeout` skill (`M0.1`).
- Verified: markdown links, file layout, `CLAUDE.md` symlink target, and `git diff --check` pass.
- Next: define `nakajs` product vision, core invariants, architecture, and toolchain with the owner (`M0.2`).
