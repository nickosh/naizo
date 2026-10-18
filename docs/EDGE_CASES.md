# nakajs — Edge Cases: Resolution Ledger

Track boundary cases, subtle failure modes, and their resolution status. Documentation or explicit risk acceptance alone does not resolve an underlying behavioral defect.

Resolution kinds:
- **ADR** — resolved by a design decision recorded in [DECISIONS.md](DECISIONS.md) (`Dxx`).
- **fix** — implementation and regression test landed.
- **doc** — behavior is intentional and explicitly stated in the relevant specification or contract.
- **PARTIAL** — one independently tested slice landed; remaining exposure stays explicit.
- **OPEN** — planned or unresolved; never mark closed from a plan or documentation note alone.

| ID | Case | Resolution |
| --- | --- | --- |
| EC01 | External AI agent edits `#nakadb` on disk while browser `localStorage` holds older cached state | **ADR D04**: `init()` compares current `#nakadb` text against `nakadb_disk_hash_<pathname>` in `localStorage`. When they differ, external disk state wins over `localStorage` cache and hydrates the DOM. |
| EC02 | `IndexedDB` restricted on `file://` protocol or `window.showSaveFilePicker` unavailable in non-Chromium browsers | **PARTIAL (`naka.js`)**: `idbStore` / `loadHandleFromIDB` catch exceptions and resolve `null`; `connectOrResumeDisk()` falls back to downloading an HTML Blob snapshot when `showSaveFilePicker` is absent. Automated regression tests remain to be added (`M2`). |
| EC03 | Auto-injected list buttons (`.naka-item-tools`, `.naka-list-footer`), styles (`#__nakadb_styles__`), and status pill (`#__nakadb_host__`) would duplicate on disk save | **ADR D05**: runtime elements carry `data-naka-ignore="true"` (or `#__nakadb_host__` / `#__nakadb_styles__`) and are stripped from the cloned document in `getCleanHtmlString()` prior to disk write. |
| EC04 | Malformed or empty JSON inside `<script id="nakadb" type="application/json">` | **PARTIAL (`naka.js`)**: `parseDbScript()` catches `JSON.parse` errors, logs a console warning, and falls back to `{ _meta: {}, fields: {}, lists: {}, custom: {} }`. Automated regression test pending (`M2`). |
| EC05 | Corrupted JSON in `localStorage` (`PAGE_KEY`) during `init()`, or non-`contenteditable` `[data-naka]` text elements inside auto-inferred list `<template>` | **OPEN**: `init()` calls `JSON.parse(cachedRaw)` without a `try/catch` guard, and `clearElementValue()` in `ensureListBlueprints()` does not clear `textContent` on plain `[data-naka]` elements lacking `contenteditable`. Scheduled for `M2`. |
