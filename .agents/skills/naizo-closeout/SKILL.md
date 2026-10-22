---
name: naizo-closeout
license: MIT
description: Close naizo development sessions, useful development slices, and milestones by reconciling implementation evidence with the project memory documents. Use when wrapping up or handing off work, ending a state-changing session, finishing a PLAN task or milestone, or updating project memory after implementation. Do not use for read-only exploration that produced no durable decision, blocker, reproduced edge case, or repository change.
---

# Naizo Closeout

Perform an evidence-based closeout without duplicating project knowledge inside this skill. Treat `AGENTS.md` and the documents it names as authoritative. If these files are absent, report that repository context is unavailable; do not create this project's memory documents in another project.

## Select the closeout mode

Choose the applicable outcome before editing:

- **Milestone / task complete:** every acceptance criterion and required check for a named `docs/PLAN.md` item has observed implementation and verification evidence.
- **Session / handoff:** state-changing work, an independently useful slice, a reproduced edge case, or a durable decision exists, but full task/milestone acceptance criteria are not yet met.
- **No update:** read-only or abandoned work produced no durable decision, blocker, reproduced edge case, useful handoff, or repository change. Report why no memory edit is warranted.

Default to **Session / handoff** when completion is uncertain. Partial or blocked work never becomes complete because the session is ending. Use `blocked` only when a concrete dependency prevents the next action; record the blocker and resumption step.

## Gather evidence

1. Read `AGENTS.md`, `docs/PLAN.md`, the newest relevant `docs/JOURNAL.md` entries, `docs/DECISIONS.md`, `docs/EDGE_CASES.md`, and every authoritative specification or contract affected by the work.
2. Inspect `git status --short --branch`, staged and unstaged diffs, untracked files, and relevant recent commits. Preserve unrelated user changes.
3. Collect verification evidence from the current session. Rerun checks proportionate to the closeout risk when changes or unresolved concerns warrant it. Name any missing or skipped checks explicitly as not run.
4. Classify landed changes: product scope, behavior/contract, plan task/milestone, edge case, durable decision, or contributor workflow.
5. Distinguish completed work from planned work. Never claim a passing check, owner decision, or resolved issue without evidence.

## Reconcile affected project memory

Audit every row below, but edit only files supported by evidence. Prefer an accurate unchanged file over a speculative synchronization edit.

| Memory surface                                     | Update rule                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/JOURNAL.md`                                  | Prepend one dated entry for a Session/handoff or Milestone/task closeout (newest first). Keep it to 2–5 concise bullets covering done, decided when relevant, verification or blockers, and the next concrete technical action. Do not add an entry in No update mode.                                                                                                                       |
| `docs/PLAN.md`                                     | **What & when:** Update when task state, implementation spec, sequence, or acceptance evidence changed. Tick a task or milestone only when its acceptance criteria and verification evidence are satisfied. Preserve historical course corrections.                                                                                                                                          |
| `docs/DECISIONS.md`                                | **Why:** Record durable architectural or owner decisions (`Dxx`). Allocate the next available `D` number and supersede prior decisions explicitly rather than rewriting history. Every entry must capture **1. Context & Problem (Why)**, **2. Decision & Rationale (Global Picture & Invariant Safety)**, and **3. Alternatives Rejected / Trade-offs** — never merely copy `docs/PLAN.md`. |
| `docs/EDGE_CASES.md`                               | **Boundary failure modes:** Record a reproduced edge case or its tested resolution (`ECxx`). Keep `OPEN` for planned or documentation-only treatment; allocate the next available `EC` number for a new case.                                                                                                                                                                                |
| `docs/PRODUCT.md`, specs, `README.md`, `AGENTS.md` | **Global picture & contracts:** Update in the same change whenever product lifecycles, scope, invariants, contracts, public behavior, or durable repository-wide instructions changed. Do not use these as session logs.                                                                                                                                                                     |

Keep branch names, commit SHAs, PR numbers/status, push/pull/merge steps, CI run/job identifiers, and manual publication-status markers out of project memory documents. Keep delivery bookkeeping in chat, Git history, and the hosting service; GitHub Releases and tags own publication state.

## Validate and commit

1. Review changed and new documents for working links/references, unsupported claims, duplicate status ledgers, stale next actions, and accidental edits to unrelated work.
2. Run `git diff --check` and any targeted validation relevant to the changed files; account for untracked files separately.
3. Confirm `docs/JOURNAL.md` remains newest first and concise, and that memory edits contain no transient delivery identifiers.
4. After validation passes, create local commits for completed coherent changes (including reconciled project memory) following `AGENTS.md`'s Git workflow and Conventional Commit body requirements (`D02`). Honor any explicit user request to leave work uncommitted, and preserve unrelated staged and unstaged changes.
5. Do not push, tag, publish, or open a pull request unless the user separately requested it.

Report the selected closeout mode, memory files changed, verification evidence (including checks not run), local commits created, any remaining uncommitted changes, and the next concrete technical action.
