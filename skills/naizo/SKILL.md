---
name: naizo
license: MIT
description: 'Build and update self-persisting interactive HTML applications (dashboards, interactive studios, personal trackers, design option labs, calculators, visual canvases, engineering notebooks, plans, specs, checklists, triage boards, and custom micro-tools) using naizo.js and its built-in #naizodb JSON database. Activate whenever generating an interactive HTML application or inspecting/editing an existing HTML file that uses <script id="naizodb" type="application/json"> or naizo / data-naizo attributes.'
---

# Naizo (`naizo.js`) — Self-Persisting HTML & AI Agent Co-Editing Skill

Use **`naizo.js`** (npm package `naizojs`) to turn any single `.html` file into a living, self-persisting application whose state syncs between the browser DOM, `localStorage`, and `<script id="naizodb" type="application/json">` on disk.

In Japanese, **_naizō_ (ないぞう)** means both **内蔵 (_built-in / housed within_)** and **内臓 (_internal organs_)**: `<script id="naizodb">` is the built-in JSON database inside `<head>`, and `naizo.js` provides the reactive internal organs that bind inputs, repeat lists, and sync human browser edits with AI agent disk edits.

---

## 1. Golden Rules for AI Agents (9 Universal Rules — Never Violate)

1. **`<body>` is the template; `<script id="naizodb">` is the canonical data (`D16`, `D19`, `D20`, `D59`, `EC09`, `EC46`, `EC58`–`EC61`):**
   - When linked to a local file via the File System Access API (`⌘S` / `Ctrl+S` or `Link Disk`, using URL-decoded `suggestedName` and a rename-friendly `window.confirm()` wrong-file link guard on non-empty conflicting `#naizodb` files while keeping disk renames, empty `"Save As"` files, and renamed copies of the same app unprompted, `EC60`), `naizo.js` skips `<!-- ... -->` HTML comments and preceding raw-text `<script>`/`<style>` blocks (`EC60`), skips `createWritable()` when the on-disk `#naizodb` payload already matches (`mtime` preserved, `EC59`), and surgically rewrites **only** the `<script id="naizodb">...</script>` block on disk (`D16`). It does **not** rewrite `<body>` markup on disk during normal saves.
   - **Author `<template naizo-template>` with `0` duplicated `[naizo-item]` shells in `<body>`:** For multi-item lists and card grids, place a single `<template naizo-template><div naizo-item>...</div></template>` inside `[naizo-list]` and put all initial item objects exclusively inside `<script id="naizodb">`. Avoid duplicating static `[naizo-item]` blocks in `<body>` so initial page paint never flashes stale template rows before hydration.
   - **To read human edits from disk:** Always parse `<script id="naizodb" type="application/json">` in `<head>` (ignoring any `<!-- ... -->` commented-out examples, `EC60`). Never scrape `<body>` input `value` or `checked` attributes to read current state.
   - **To update data on disk (two-tier `O(N)` 3-way list merge, in-place reconciliation, & live malformed-JSON guard):** Modify the JSON inside `<script id="naizodb">` (formatted with 2-space indentation and `<` escaped as `\u003c`). Open linked tabs detect `file.lastModified` within ~2 seconds, merge across unrelated top-level keys (`fields`, `lists`, `custom`) and **per list item** via compact per-item FNV-1a hashes in `naizodb_disk_hash_<key>` (**Path A:** unique primitive `item.id` `string | number` with zero duplicates across `base`/`browser`/`disk`, merging additions, deletions, reorders, and live per-property edits without compulsory UUIDs `D19`, backing up same-property or edit-vs-delete collisions via `hasCollision` to `naizodb_backup_<key>` + `↺ Restore`; **Path B:** conservative aligned-prefix `0 .. base.length - 1` disjoint row edits + appends for `id`-less checklists, falling back to whole-list `disk` win + `naizodb_backup_<key>` on any deletion, row shift, or same-row collision, `EC58`), and reconcile `[naizo-item]` DOM nodes **in place across list length changes** without clobbering `document.activeElement` focus/caret (`EC58`). If a linked disk file breaks into malformed JSON mid-session, `naizo.js` pauses disk writes (`Invalid #naizodb JSON` + `naizodb_raw_backup_<key>` + `4. Repair JSON`) and auto-recovers/merges as soon as valid JSON is written on disk (`EC59`).
   - **Browser capability matrix & live-reload dev-server warning (`EC61`):** Live two-way `.html` disk sync works out of the box in **Chrome, Edge, Arc, and Opera** (the initial OS Save dialog asks _"Replace?"_ once so browser security confirms write access to update `#naizodb` in place), requires enabling `brave://flags/#file-system-access-api` once in **Brave**, and uses `localStorage` + `.html` download (`⬇ Save to PC` / `1. Link Disk`) + `📋 Copy JSON` in **Safari & Firefox**. Never run disk-linked `.html` files through file-watching live-reload dev servers (**Vite**, **VS Code Live Server**, **BrowserSync** — every surgical `#naizodb` save triggers a full page reload loop); open via `file://` or serve via a plain non-watching static server (`python3 -m http.server`, `npx serve`).
   - **Account for unlinked 3-way FNV-1a merge (`naizodb_disk_hash_<key>`):** When testing an unlinked page in a browser that already holds cached `localStorage` edits, `naizo.js` 3-way merges updated `#naizodb` keys/items with cached browser keys; click **`↺ Reset`** in the Status Pill (or call `Naizo.reset()` / `localStorage.clear()`) to discard stale unlinked cache state cleanly.
2. **Preserve pass-through keys (`D15`) & treat `Naizo.get()` / `Naizo.getList()` as fast read-only views (`D59`, `EC14`, `EC61`):**
   - `naizo.js` maintains an in-memory `NaizoDatabase` store and maps each rendered `[naizo-item]` DOM row to its source object via a `WeakMap` (`itemDataMap`, resolving `[naizo-remove]` `×` and `[naizo-move]` `↑ ↓` by `WeakMap` identity before DOM index and keeping multiple `[naizo-list="name"]` containers synchronized across all list operations, `EC61`).
   - Unbound keys in `fields`, unbound arrays in `lists`, and extra properties or sub-arrays on list item objects (such as `"id"`, `"estimate"`, `"updatedAt"`, `"slots"`, `"url"`, or custom per-card dictionary keys) pass through untouched across edits, moves, and saves (`D19` never injects compulsory UUIDs, while adding unique primitive `id`s unlocks Path A 3-way list merges).
   - **Never add hidden `<input type="hidden">` or `.sr-only` dummy controls just to keep unbound item keys alive, and never mutate `Naizo.get()` / `Naizo.getList()` return values directly in place:** `Naizo.get()` and `Naizo.getList()` return `O(1)` uncloned, unfrozen live references for `< 0.5 ms` 60fps reads (`D59`). Render rich HTML (`<a>` links, Markdown previews, badges, sub-arrays) into `[naizo-ignore]` containers directly from `Naizo.getList()`, and commit any mutations strictly through `Naizo.set*`, `updateItem`, `addItem`, `setList`, or `batch`. When editing `#naizodb` on disk, always preserve existing keys you did not intend to remove.
3. **Explicit binding, plain-text leaves (`EC19`, `EC56`), & `naizo-ignore` vs. `naizo-strip` (`D08`, `D12`, `D22`, `D47`):**
   - Bind elements exclusively with `naizo="key"` or `data-naizo="key"`. Unannotated inputs are never implicitly captured, and `id` or `name` attributes are never used as fallback binding keys.
   - **Plain-text display leaves (`<span naizo="key">`, `<h3 naizo="key">`):** Passive leaf elements live-mirror sibling interactive controls via `textContent` (`D22`) regardless of DOM order (`EC56` seeds interactive controls ahead of passive leaves). Never mutate `innerHTML` on `[naizo]`-bound elements.
   - **`naizo-ignore` vs. `naizo-strip`:** Use `naizo-ignore` (`data-naizo-ignore`) for custom UI containers, search bars, `<dialog naizo-ignore>` modals, and rich-HTML views that must be **kept** in auto-templates and exported HTML. Use `naizo-strip` (`data-naizo-strip`) for transient overlays, third-party runtime mounts, or hosted-only scripts that must be **both ignored and stripped** on `Naizo.exportHTML()` / `⬇ Save to PC` (`Naizo.downloadHTML()`).
4. **Safe form controls inside `[naizo-item]` (`EC15`, `EC39`, `EC55`):**
   - **Wrap `<label>` around inputs (`EC39`):** Never use `<label for="some-id">` + `<input id="some-id">` inside a repeating `[naizo-item]`, because cloned rows would share duplicate DOM `id` attributes. Always wrap `<label>` directly around the control (`<label><input type="checkbox" naizo="done" /><span>Done</span></label>`).
   - **Include `<option value="">— Select… —</option>` on nullable `<select>` elements (`EC15`, `EC55`):** While `naizo.js` safely renders `""` / `null` unselected (`selectedIndex = -1`) without overwriting `store` (`EC55`), adding an explicit `<option value="">` gives users a clear selectable empty option.
   - **Remember `<select>` always stores `string` (`string[]` for `multiple`):** Never bind raw boolean `true` / `false` values to a `<select>` – use `<input type="checkbox" naizo="flag">` for booleans, or string values (`"yes"` / `"no"`) on `<select>`.
5. **Scope documents with `<html naizo-id="...">` (`D13`, `EC11`):**
   - Add a descriptive `naizo-id="project-artifact-slug"` on `<html>` (or `"_meta": { "id": "..." }`) so `localStorage` caches (`naizodb_state_`, `naizodb_disk_hash_`, `naizodb_backup_`, `naizodb_ui_`) and IndexedDB file handles never collide when multiple HTML tools are opened on `localhost` or `file://`.
6. **Non-destructive filtering (`row.hidden`) & single-pass list replacement (`Naizo.setList`, `D43`):**
   - Removing a `[naizo-item]` node from the DOM deletes its object from `db.lists`. For search or category filtering, toggle `row.hidden = !matches` (or CSS `display: none`), and use `cardEl.style.order` for non-destructive sorting.
   - For bulk imports, resets, or clearing a list, call `Naizo.setList(name, items)` (or `Naizo.setList(name, [])`) in one pass rather than looping `removeItem()` / `addItem()`.
7. **Status Pill visibility (`naizo-no-pill`), initial corner (`naizo-pill-corner`), & toast clearance (`D50`, `D56`, `D57`, `EC53`):**
   - Only add `naizo-no-pill` (or `data-naizo-no-pill`) on `<html>` or `<body>` when the user asks to hide the Status Pill (e.g., kiosk views, printable reports, embedded iframes) or build a custom persistence toolbar. When using `naizo-no-pill` in Local Mode, always surface `⌘S` / `Ctrl+S` or a custom `<button type="button" onclick="Naizo.link()">Link Disk</button>` (`await Naizo.link()`) control so users can still link and persist data to `<script id="naizodb">` on disk.
   - The Status Pill defaults to `bottom-right` (`16px` inset) and snaps to any of the 4 corners on user drag (`naizodb_ui_<key>`). Place app notifications/toasts at `top-right` or `bottom-center`, or set `naizo-pill-corner="bottom-left"` (or `"top-right"` / `"top-left"`, `data-naizo-pill-corner`) on `<body>` or `<html>` when `bottom-right` hosts fixed app controls (saved user drag in `naizodb_ui_<key>` always takes priority).
8. **Boot timing: top-level `naizo:hydrate` / `Naizo.ready()`, idempotent `[naizo-ignore]` enhancements, static `hidden` alignment, & clean `"theme": "system"` (`D45`, `EC09`, `EC48`, `EC57`):**
   - **Never register `naizo:hydrate` inside `DOMContentLoaded` when loading `<script src="..." defer>` (`EC57`):** Deferred scripts run at `document.readyState === 'interactive'` _before_ `DOMContentLoaded` fires, so listeners registered inside `DOMContentLoaded` (or late `<script type="module">` blocks) miss boot hydration. Attach `window.addEventListener('naizo:hydrate', syncUi)` at top level or call `Naizo.ready(syncUi)`.
   - **Idempotent `[naizo-ignore]` enhancements & static `hidden` alignment:** Make custom `[naizo-ignore]` DOM enhancers inside `[naizo-item]` idempotent across repeated `naizo:hydrate` / `naizo:change` passes, and match static `hidden` attributes in HTML to initial `#naizodb` defaults.
   - **Clean `"theme": "system"` (`D45`, `EC48`):** Initialize `"theme": "system"` with CSS `@media (prefers-color-scheme: dark)` and **never** call `Naizo.setField()` on boot for OS theme detection (which dirties `initialDiskDb` and prematurely surfaces `↺ Reset`).
9. **Batch mutations (`Naizo.batch`), non-reentrant `naizo:change`, `dataset.slotSignature` memoization, & commit-time `'change'` derivations (`D57`, `EC54`):**
   - Wrap multi-item or cross-scope updates in `Naizo.batch(fn, options?)` (`{ silent: true }` for silent derived writes; `{ deferPersist: true }` for 60fps range/canvas scrubs) so DOM bindings update synchronously while intermediate persistence and `naizo:change` dispatches coalesce into one exit pass.
   - `naizo:change` is queued FIFO and non-reentrant (`EC54`, capped at 10 passes), so avoid bare `if (syncing) return;` guards that drop queued renders. Memoize custom `[naizo-ignore]` subtrees with `el.dataset.slotSignature = JSON.stringify(val)` (or check `e.detail`).
   - **Use delegated native `'change'` listeners (never `naizo:change`) for one-time `name → slug` derivations:** Because `naizo.js` updates `store` on every `input` keystroke, `naizo:change` fires live on `input` rather than `blur`; attach a native DOM `'change'` listener for commit-time derivations.

---

## 2. Core HTML Structure & `#naizodb` Schema

Every `naizo.js` HTML document embeds `<script id="naizodb" type="application/json">` at the top of `<head>` followed by `naizo.js`, with `<template naizo-template>` defining repeating list blueprints in `<body>`:

```html
<!doctype html>
<html lang="en" naizo-id="my-artifact-id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Artifact Title</title>

    <!-- 1. Canonical #naizodb JSON state (2-space indented, '<' escaped as \u003c) -->
    <script id="naizodb" type="application/json">
      {
        "_meta": {
          "id": "my-artifact-id"
        },
        "fields": {
          "title": "Artifact Title",
          "owner": "Alex",
          "status": "Draft"
        },
        "lists": {
          "tasks": [
            {
              "id": "task-1",
              "done": false,
              "task": "First action item",
              "priority": "High"
            }
          ]
        },
        "custom": {}
      }
    </script>

    <!-- 2. Load naizo.js via npm CDN (jsDelivr or unpkg) or local ./dist/naizo.js -->
    <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
  </head>
  <body>
    <!-- 3. Declarative bindings in <body> (single <template naizo-template>, 0 duplicate shells) -->
    <h1 contenteditable="true" naizo="title">Artifact Title</h1>
    <div naizo-list="tasks">
      <template naizo-template>
        <div naizo-item>
          <label><input type="checkbox" naizo="done" /><span>Done</span></label>
          <label><input type="text" naizo="task" placeholder="Action item..." /></label>
          <label>
            <select naizo="priority">
              <option value="High">High</option>
              <option value="Med">Med</option>
              <option value="Low">Low</option>
            </select>
          </label>
        </div>
      </template>
    </div>
  </body>
</html>
```

### CDN & Local Script Options (`D17`, `D34`, `D39`)

- **jsDelivr (readable, ~39.9 KB gzipped / ~176.3 KB raw):** `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js`
- **jsDelivr (minified, ~27.0 KB gzipped / 91.9 KB raw):** `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js`
- **unpkg:** `https://unpkg.com/naizojs@latest/dist/naizo.js`
- **Pinned version:** replace `@latest` with a specific published version tag
- **Local / offline:** `<script src="./dist/naizo.js" defer></script>` (inside the `naizo` repository examples, use `../dist/naizo.js`)
- **Experimental / in-development (`main` branch `dist/naizo.js`):** `https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js` (unreleased; pair with the `@main` skill below)

---

## 3. Declarative HTML Attributes (`naizo` / `data-naizo`)

Both short `naizo` / `naizo-*` attributes and HTML5 `data-naizo` / `data-naizo-*` aliases are supported everywhere (`D08`):

| Short Attribute                     | HTML5 `data-*` Alias                     | Placement                                                                                              | Behavior                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`                       | `data-naizo="key"`                       | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf element, or `[naizo-item]` | Binds to `db.fields["key"]` when standalone, or to `item["key"]` when inside or on a `[naizo-item]`. Passive display leaves (`<span>`, `<h3>`) live-mirror interactive controls via `textContent` (`EC19`, `EC56`).                                                                                                           |
| `naizo-list="name"`                 | `data-naizo-list="name"`                 | Container (`<div>`, `<ul>`, `<ol>`, `<tbody>`, `<table>`)                                              | Binds direct `[naizo-item]` children to `db.lists["name"]` (keeping multiple `[naizo-list="name"]` containers synchronized, `EC61`) and injects `+ Add Item` below the list unless `naizo-no-controls` is present.                                                                                                            |
| `naizo-item`                        | `data-naizo-item`                        | Direct child of `[naizo-list]` (`<div>`, `<li>`, `<tr>`, etc.)                                         | Marks a repeating row/card (reconciled in place across length changes without losing `document.activeElement` focus/caret, `EC58`); injects hover `↑` `↓` `×` toolbar unless `naizo-no-controls` is set on the list.                                                                                                          |
| `naizo-template`                    | `data-naizo-template`                    | Direct child `<template>` inside `[naizo-list]`                                                        | Explicit blueprint for list items (recommended with `0` static `[naizo-item]` shells in `<body>`). If omitted, `naizo.js` auto-infers `data-naizo-auto-template="true"` from the first `[naizo-item]`.                                                                                                                        |
| `naizo-add="name"`                  | `data-naizo-add="name"`                  | `<button>` (anywhere in document)                                                                      | Appends a new blank item to `[naizo-list="name"]` across all matching list containers and focuses its first text field inside the clicked container (`EC31`, `EC61`).                                                                                                                                                         |
| `naizo-remove`                      | `data-naizo-remove`                      | `<button>` inside `[naizo-item]`                                                                       | Resolves row identity via `WeakMap` (`itemDataMap`) before DOM index and deletes the item from all `[naizo-list]` containers and `db.lists` (`EC61`).                                                                                                                                                                         |
| `naizo-move="up\|down"`             | `data-naizo-move="up\|down"`             | `<button>` inside `[naizo-item]`                                                                       | Resolves row identity via `WeakMap` (`itemDataMap`) before DOM index and moves the item up or down in all `[naizo-list]` containers and `db.lists` (`EC61`).                                                                                                                                                                  |
| `naizo-no-controls`                 | `data-naizo-no-controls`                 | `[naizo-list]`                                                                                         | Suppresses auto-injected `↑ ↓ ×` and `+ Add Item` buttons so you can use custom buttons or modals.                                                                                                                                                                                                                            |
| `naizo-ignore`                      | `data-naizo-ignore`                      | Any element                                                                                            | Excludes the element and its subtree from state binding while preserving it in auto-templates and exported HTML (`D12`, `EC07`).                                                                                                                                                                                              |
| `naizo-strip`                       | `data-naizo-strip`                       | Any element                                                                                            | Excludes the element and its subtree from state binding and strips it from auto-templates and `exportHTML()` / `downloadHTML()` (`D12`, `D47`).                                                                                                                                                                               |
| `naizo-id="scope"`                  | `data-naizo-id="scope"`                  | `<html>` or `<body>`                                                                                   | Scopes `localStorage` and IndexedDB keys (`<path>::<scope>`) to avoid collisions on `localhost`.                                                                                                                                                                                                                              |
| `naizo-mode="online\|local\|auto"`  | `data-naizo-mode="online\|local\|auto"`  | `<html>` or `<body>`                                                                                   | Overrides automatic Local Mode vs. Online Mode detection (`D41`, `EC48`).                                                                                                                                                                                                                                                     |
| `naizo-pill-corner="corner"`        | `data-naizo-pill-corner="corner"`        | `<html>` or `<body>`                                                                                   | Sets the initial Status Pill corner (`bottom-right` default, `bottom-left`, `top-right`, `top-left`; `<body>` overrides `<html>`, invalid values fall back to `bottom-right`) when `naizodb_ui_<key>` has no user-dragged corner yet; preserved across `exportHTML()` / `downloadHTML()` (`D50`, `D57`).                      |
| `naizo-no-pill`                     | `data-naizo-no-pill`                     | `<html>` or `<body>`                                                                                   | Skips mounting `#__naizodb_host__` (`<body>` overrides `<html>`, and `="false"` opts out) while retaining `#__naizodb_styles__`, `localStorage`, IndexedDB `fileHandle` auto-resume + ~2 s watch, and `⌘S` / `Ctrl+S`; logs a `console.warn` on malformed startup `#naizodb` JSON and is preserved on export (`D56`, `EC53`). |
| `naizo-manual`                      | `data-naizo-manual`                      | `<html>`, `<body>`, or `<script>`                                                                      | Disables automatic `initNaizo()` boot when loading the browser IIFE bundle.                                                                                                                                                                                                                                                   |
| `naizo-get="url"`                   | `data-naizo-get="url"`                   | `<button>`, `<a>`, or any element                                                                      | Fetches JSON or text via `GET` and routes `2xx` responses via `naizo-into` (or hydrates `#naizodb` when `naizo-into` is omitted, `D43`, `D51`).                                                                                                                                                                               |
| `naizo-post="url"`                  | `data-naizo-post="url"`                  | `<button>` or any element                                                                              | Flushes pending edits and sends a CORS-safelisted `text/plain;charset=UTF-8` JSON `POST` (fire-and-forget unless `naizo-into` is set, `D51`).                                                                                                                                                                                 |
| `naizo-into="target"`               | `data-naizo-into="target"`               | Element with `naizo-get` / `naizo-post`                                                                | Routes response into `field:<key>`, `list:<name>` (`Naizo.setList`), `custom:<key>`, `db` (saving non-empty `store` to `naizodb_backup_<key>` before replacement, `EC59`), or DOM-only `#selector` (`textContent`, `D22`).                                                                                                    |
| `naizo-path="a.b.0"`                | `data-naizo-path="a.b.0"`                | Element with `naizo-get` / `naizo-post`                                                                | Extracts a nested property or array index from parsed JSON using `Object.hasOwn()` at each step (`EC24`, `EC50`).                                                                                                                                                                                                             |
| `naizo-body="source"`               | `data-naizo-body="source"`               | Element with `naizo-post`                                                                              | Selects outgoing `POST` payload: `db` (default), `fields`, `custom`, `list:<name>`, or `field:<key>`.                                                                                                                                                                                                                         |
| `naizo-trigger="click\|init\|load"` | `data-naizo-trigger="click\|init\|load"` | Element with `naizo-get` / `naizo-post`                                                                | Fires on `click` (default), `init` (boot only when target is empty), or `load` (every boot).                                                                                                                                                                                                                                  |
| `naizo-cors="no-cors"`              | `data-naizo-cors="no-cors"`              | Element with `naizo-post`                                                                              | Sends an opaque fire-and-forget webhook `POST` when `naizo-into` is omitted (`D43`).                                                                                                                                                                                                                                          |

### Scalar Element Coercion & Safety Rules (`D14`, `D22`, `EC12`, `EC15`, `EC18`, `EC19`, `EC21`, `EC25`, `EC55`, `EC56`)

- **Text inputs & `<textarea>`:** `string` (`.value`), preserving stored numbers/booleans when the string representation is unchanged (`EC25`).
- **`<input type="number">` & `<input type="range">`:** finite `number` or `null` when empty (`EC12`).
- **`<input type="checkbox">`:** `boolean` (`.checked`), coercing `"false"`, `"0"`, `""`, `"no"`, and `"off"` to `false` (`EC25`).
- **`<input type="radio">`:** `string` value of the checked radio; inside `[naizo-item]`, radio `name` attributes are automatically scoped per row and restored on export (`EC13`).
- **`<select>` & `<select multiple>` (`EC15`, `EC55`):** `string` or `string[]`. When a single `<select>` has no matching `<option>` for `""` or `null`, `naizo.js` sets `el.selectedIndex = -1` without logging a warning (rendering visibly unselected, keeping Option #0 user-selectable, and preventing `exportHTML()` from baking `selected` onto Option #0, `EC55`). For non-empty unknown values (`textVal !== ''`, e.g., `"Shipped"`), `naizo.js` logs a `console.warn`, leaves DOM selection untouched, and preserves the stored value in memory (`EC15`).
- **`<details naizo="key">`:** `boolean` (`open` state via capture-phase `toggle` listener, `EC12`).
- **`[contenteditable]` (`""`, `"true"`, `"plaintext-only"`):** plain text via `textContent` (`D22`, `EC18` – never `innerHTML`).
- **Passive display leaves & interactive-over-passive seeding precedence (`EC19`, `EC56`):** Plain non-interactive leaves (`<span naizo="name">`, `<h3 naizo="name">`) mirror bound values via `textContent`. During blank item creation, boot baseline seeding, `Naizo.bind()`, and `<form>` reset, interactive controls (`<input>`, `<select>`, `<textarea>`, `<details>`, `[contenteditable]`) are processed ahead of passive leaves and mirrored back – so `<h3 naizo="name"></h3>` placed before `<input naizo="name" value="Untitled">` never overwrites `"Untitled"` with `""`.
- **Self-bound `[naizo-item]`:** `<li naizo-item contenteditable="true" naizo="text">` binds the item root directly while isolating `textContent` from injected `.naizo-item-tools` and `[naizo-ignore]` / `[naizo-strip]` children (`D47`, `EC46`).
- **Tables (`<tbody naizo-list>` / `<tr naizo-item>`):** `.naizo-item-tools` is placed inside the last `<td>`/`<th>` of each row and `.naizo-list-footer` is placed immediately after `<table>` (`EC13`).
- **Skipped inputs (`EC21`):** `password`, `file`, `button`, `submit`, `reset`, and `image` are always skipped.

---

## 4. Programmatic API (`window.Naizo` / `window.NaizoDB`) & Events

Every store and bound-DOM operation is **100% synchronous** (`< 0.5 ms` read-after-write); only disk I/O (`save`, `link`, `unlink`), `copyJSON`, and `fetch` return Promises (`D57`):

```javascript
// 1. Custom JSON State (db.custom — O(1) read-only live view on Naizo.get(), D59)
const activeId = Naizo.get('activeNoteId'); // Omit key to get live NaizoDatabase (treat returned objects/arrays as read-only; never mutate in place)
Naizo.set('activeNoteId', 'note-102'); // Validates finite JSON value (EC35) and deep-clones into store
Naizo.delete('obsoleteKey');

// 2. Standalone Fields (db.fields)
const status = Naizo.getField('status');
Naizo.setField('status', 'Approved'); // Updates db.fields.status + all bound [naizo="status"] DOM nodes
Naizo.deleteField('legacyField'); // Deletes key + clears bound DOM inputs

// 3. Lists (db.lists — O(1) read-only live view on Naizo.getList(), multi-container parity, D59, EC61)
const items = Naizo.getList('tasks'); // Uncloned/unfrozen O(1) reference (< 0.5 ms); never mutate items[i] or items.push() directly — use mutators below
Naizo.setList('tasks', [{ id: 't-1', done: false, task: 'Synced from API', priority: 'High' }]); // Replaces or clears ([]) list safely (M8.1)
Naizo.addItem('tasks', { id: 't-2', done: false, task: 'New task', priority: 'Med' });
Naizo.updateItem('tasks', 0, { done: true }); // Shallow-merges into item 0 across all [naizo-list="tasks"] containers, preserving extra keys
Naizo.moveItem('tasks', 2, 0);
Naizo.removeItem('tasks', 1);

// 4. Synchronous Batching & Boot Readiness (M13.1, D57, EC54, EC57)
Naizo.batch(() => {
  // Nestable: updates store + bound DOM synchronously while coalescing persistence & naizo:change
  Naizo.set('activeNoteId', 'note-102');
  Naizo.updateItem('tasks', 0, { done: true });
  Naizo.setField('status', 'In Review');
}); // Options: { silent?: boolean, deferPersist?: boolean }; emits 1 { scope: 'batch', action: 'batch', source: 'api', db } unless silent

Naizo.ready((db) => {
  // Runs synchronously if boot hydration already completed, or once on boot 'naizo:hydrate' (safe across <script defer> & module scripts)
  console.log('Hydrated store ready:', db);
});

// 5. Mini-API Client, Dynamic Subtrees, Persistence, Reset, & Export
const apiRes = await Naizo.fetch('https://api.example.com/tasks', {
  method: 'GET', // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: 'data.items',
  into: 'list:tasks', // 'field:<key>' | 'list:<name>' | 'custom:<key>' | 'db' (backs up non-empty store to naizodb_backup_<key>, EC59) | '#selector' (omit to return data without mutating store, D52)
}); // Resolves { url, method, ok, status, target, data, error } without throwing
Naizo.bind(containerEl); // Hydrate dynamically inserted DOM from store (skips persistence when seeding mutates zero keys, EC59)
const ok = await Naizo.save(); // Flush cache + await single-flight disk write (skips createWritable() when on-disk #naizodb already matches, EC59)
Naizo.reset(); // Back up dirty state to ↺ Restore and reset to initial boot baseline
const linked = await Naizo.link(); // Prompt/resume FileSystemFileHandle (decoded suggestedName + wrong-file guard, EC60) & write #naizodb to disk (Promise<boolean>, D56)
await Naizo.unlink(); // Forget linked FileSystemFileHandle
const json = await Naizo.copyJSON(); // Copy 2-space #naizodb JSON to clipboard
const html = Naizo.exportHTML(); // Clean HTML snapshot with baked attributes & stripped runtime UI
const dlHtml = Naizo.downloadHTML('app.html'); // Download portable HTML with dist/naizo.min.js CDN URL

// 6. Window Lifecycle & Mutation Events (Non-Reentrant FIFO Queue, EC54)
window.addEventListener('naizo:hydrate', (e) => {
  // Fired on boot, external disk merge, cross-tab storage sync, full-DB fetch, ↺ Restore, and ↺ Reset
  console.log('Hydrated store:', e.detail);
});
window.addEventListener('naizo:change', (e) => {
  // e.detail: {
  //   scope: 'fields' | 'lists' | 'custom' | 'db' | 'batch' | 'reset' | 'restore',
  //   action?: 'add' | 'update' | 'remove' | 'move' | 'set' | 'delete' | 'batch',
  //   source?: 'dom' | 'api',
  //   list?, key?, index?, value?, db
  // }
  // User edits inside [naizo-item] include action: 'update', index (>= 0), and source: 'dom' (matching Naizo.updateItem()).
  // Re-entrant Naizo.* calls inside a listener queue FIFO (non-reentrant, capped at 10 passes with console.warn).
  console.log('Changed:', e.detail);
});
window.addEventListener('naizo:item', (e) => {
  // e.detail: { list, item, data, index }
  console.log('New list row:', e.detail);
});
window.addEventListener('naizo:fetch', (e) => {
  // e.detail: { url, method, ok, status, target, data, error }
  console.log('API result:', e.detail);
});
```

---

## 5. Canonical Application Blueprints & Core HTML5 UI Patterns (`D40`, `D43`, `D45`, `D57`, `D58`)

Choose the blueprint and native HTML5 patterns that match the user's request (full repository templates live in `examples/starter.html`, `examples/checklist.html`, `examples/notes.html`, `examples/inventory.html`, and `examples/weather.html`).

### Blueprint A: Project Spec (`starter.html`) / Release Checklist (`checklist.html`)

Use for implementation plans, PR review checklists, bug triage sheets, and release sign-offs with **zero custom JavaScript**:

```html
<h1 contenteditable="true" naizo="checklist_title">Pre-Release Verification Checklist</h1>

<section class="card">
  <div class="meta-row">
    <label>
      Reviewer
      <input type="text" naizo="reviewer" value="Jordan" />
    </label>
    <label>
      Target Environment
      <select naizo="environment">
        <option value="Local">Local</option>
        <option value="Staging" selected>Staging</option>
        <option value="Production">Production</option>
      </select>
    </label>
    <label class="ready-toggle">
      <input type="checkbox" naizo="ready_for_release" />
      <span>Ready for Release</span>
    </label>
  </div>
</section>

<section class="card">
  <h2>Verification Items</h2>
  <div naizo-list="checks">
    <template naizo-template>
      <div class="check-row" naizo-item>
        <label>
          <input type="checkbox" naizo="done" />
          <span class="sr-only">Done</span>
        </label>
        <label>
          <span class="sr-only">Verification item</span>
          <input type="text" naizo="task" placeholder="Add verification step..." />
        </label>
        <label>
          <span class="sr-only">Priority</span>
          <select naizo="priority">
            <option value="">— Priority —</option>
            <option value="High">High</option>
            <option value="Med">Med</option>
            <option value="Low">Low</option>
          </select>
        </label>
      </div>
    </template>
  </div>
</section>
```

### Blueprint B: Zero-DOM-Wipe Master–Detail Workspace (`notes.html`, `D40`, `D57`)

Use for multi-note engineering notebooks, ADR explorers, prompt libraries, or multi-document editors with a sidebar list and active editor pane:

- **Key architectural rule:** Never wipe and copy note text into a single shared `<textarea>`. Render every note as a live `[naizo-item]` inside `<main naizo-list="notes" naizo-no-controls>`, store the selected ID in `db.custom.activeNoteId`, batch multi-step creation with `Naizo.batch()`, and initialize UI via `Naizo.ready()`:

```html
<style>
  [naizo-list='notes'] > .note-pane {
    display: none;
  }
  [naizo-list='notes'] > .note-pane.is-active {
    display: flex;
    flex-direction: column;
  }
</style>

<aside>
  <input id="note-search" type="search" naizo-ignore placeholder="Search notes..." />
  <select id="category-filter" naizo="category_filter">
    <option value="all" selected>All Categories</option>
    <option value="Architecture">Architecture</option>
    <option value="Runbook">Runbook</option>
  </select>
  <button id="new-note-btn" type="button" naizo-ignore>+ New Note</button>
  <div id="note-sidebar-list" naizo-ignore></div>
</aside>

<main naizo-list="notes" naizo-no-controls>
  <template naizo-template>
    <article class="note-pane" naizo-item>
      <label><input type="text" naizo="title" placeholder="Note title..." /></label>
      <label>
        <select naizo="category">
          <option value="Architecture">Architecture</option>
          <option value="Runbook">Runbook</option>
        </select>
      </label>
      <label><input type="checkbox" naizo="pinned" /> Pinned</label>
      <label><textarea naizo="body" rows="12"></textarea></label>
    </article>
  </template>
</main>

<script>
  function syncNotebookUi() {
    const notes = Naizo.getList('notes');
    const activeId = Naizo.get('activeNoteId') || notes[0]?.id;
    document.querySelectorAll('[naizo-list="notes"] > [naizo-item]').forEach((pane, idx) => {
      pane.classList.toggle('is-active', notes[idx]?.id === activeId);
    });
    // Render clickable sidebar items into #note-sidebar-list calling Naizo.set('activeNoteId', note.id)
  }
  document.getElementById('new-note-btn').addEventListener('click', () => {
    const id = 'note-' + Date.now();
    Naizo.batch(() => {
      Naizo.addItem('notes', {
        id,
        title: 'Untitled',
        category: 'Architecture',
        pinned: false,
        updatedAt: new Date().toISOString(),
        body: '',
      });
      Naizo.set('activeNoteId', id);
    });
  });
  Naizo.ready(syncNotebookUi);
  window.addEventListener('naizo:hydrate', syncNotebookUi);
  window.addEventListener('naizo:change', syncNotebookUi);
</script>
```

### Blueprint C: Filterable Card Grid with Per-Item Custom Keys (`inventory.html`, `D15`) & Non-Destructive Search (`D43`)

- Bind standard card fields (`sku`, `name`, `status`, `location`, `qty`, `unitCost`, `notes`) inside `<div naizo-list="inventory" naizo-no-controls>` with `<template naizo-template>`.
- Store arbitrary custom metadata keys directly on each item object in `db.lists.inventory[i]` via `Naizo.updateItem('inventory', index, partial)` (`EC38`) and render them inside a `[naizo-ignore]` badge container – no `.sr-only` dummy inputs needed.
- Filter via `row.hidden = q !== '' && !text.includes(q)` and sort via `cardEl.style.order = String(rank)` without mutating `db.lists` indices.

### Blueprint D: Core HTML5 UI Patterns & Why `naizo.js` Omits Widget Directives (`D57`, `D58`)

`naizo.js` stays lightweight, predictable, and framework-free by pairing its synchronous store with standard HTML5 controls instead of inventing a template/widget DSL. Always use these 7 native patterns instead of non-existent `naizo-*` widget attributes:

#### (a) Persisted View Tabs: `<label>` + `.sr-only` `<input type="radio" naizo="active_tab">` + CSS `:has(:checked)`

> **Why `naizo.js` omits `naizo-tab` / `naizo-panel` (and needs no `.sr-only` `<select>` proxy):** Tab bars and routers are layout concerns (`D43`, `D57`). Native `<input type="radio" naizo="active_tab">` wrapped in `<label>` gives accessible roving keyboard navigation (`ArrowLeft` / `ArrowRight`), instant CSS `:has(:checked)` styling, and `#naizodb` persistence with 6 lines of panel-visibility JS (for collapsible sections, `<details naizo="section_open" open>` needs zero JS).

```html
<style>
  .tab-bar {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid #e5e0d8;
  }
  .tab-btn {
    padding: 0.5rem 0.85rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .tab-btn:has(input:checked) {
    border-bottom-color: currentColor;
    font-weight: 600;
  }
</style>

<nav class="tab-bar" role="tablist">
  <label class="tab-btn">
    <input type="radio" class="sr-only" name="view_tab" value="board" naizo="active_tab" checked />
    Board
  </label>
  <label class="tab-btn">
    <input type="radio" class="sr-only" name="view_tab" value="metrics" naizo="active_tab" />
    Metrics
  </label>
</nav>

<!-- Match static hidden attributes to initial #naizodb fields.active_tab ("board") -->
<section data-tab-panel="board">Board content...</section>
<section data-tab-panel="metrics" hidden>Metrics content...</section>

<script>
  function syncTabs() {
    const active = Naizo.getField('active_tab') || 'board';
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== active;
    });
  }
  Naizo.ready(syncTabs);
  window.addEventListener('naizo:hydrate', syncTabs);
  window.addEventListener('naizo:change', syncTabs);
</script>
```

#### (b) Sub-Arrays Inside `[naizo-item]`: `D15` Pass-Through + `dataset.slotSignature` Memoization + `Naizo.batch()`

> **Why `naizo.js` omits nested `[naizo-list]` inside `[naizo-item]`:** Nested `[naizo-list]` breaks unique `[naizo-add="name"]` targeting, `auto-template` clearing rules, and flat `db.lists[name]` indexing while adding hundreds of lines of recursive DOM diffing (`PRODUCT.md`, `D57`). Store sub-arrays directly on each item (`item.slots`), render into a `[naizo-ignore]` child memoized with `dataset.slotSignature` so unrelated edits never destroy sub-control focus, and persist updates via `Naizo.updateItem()` / `Naizo.batch()`.

```html
<div id="projects-list" naizo-list="projects" naizo-no-controls>
  <template naizo-template>
    <article class="project-card" naizo-item>
      <label><input type="text" naizo="name" placeholder="Project name..." /></label>
      <div class="slots-mount" naizo-ignore></div>
    </article>
  </template>
</div>

<script>
  function syncProjectSlots() {
    const projects = Naizo.getList('projects');
    document.querySelectorAll('#projects-list > [naizo-item]').forEach((card, cardIdx) => {
      const mount = card.querySelector('.slots-mount');
      const slots = Array.isArray(projects[cardIdx]?.slots) ? projects[cardIdx].slots : [];
      const sig = JSON.stringify(slots);
      if (!mount || mount.dataset.slotSignature === sig) return;
      mount.dataset.slotSignature = sig;
      mount.replaceChildren(
        ...slots.map((slot, slotIdx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = `${slot.quarter}: ${slot.hours}h ×`;
          btn.addEventListener('click', () => {
            const latest = Array.isArray(Naizo.getList('projects')[cardIdx]?.slots)
              ? Naizo.getList('projects')[cardIdx].slots
              : [];
            Naizo.batch(() => {
              Naizo.updateItem('projects', cardIdx, {
                slots: latest.filter((_, i) => i !== slotIdx),
              });
            });
          });
          return btn;
        }),
      );
    });
  }
  Naizo.ready(syncProjectSlots);
  window.addEventListener('naizo:hydrate', syncProjectSlots);
  window.addEventListener('naizo:change', syncProjectSlots);
</script>
```

#### (c) 60fps Coupled `<input type="range">` `100%`-Ceiling Sliders with 3-Zone CSS Gradient Tracks

> **Why `naizo.js` omits `async` setters and auto-deferred single-call persistence:** Making getters/setters `async` forces `await` across `< 0.5 ms` in-memory logic and breaks synchronous read-after-write (`D57`). For 60fps range or canvas scrubbing across coupled values, `Naizo.batch(fn, { deferPersist: true })` updates `store` and bound DOM synchronously while deferring `JSON.stringify` / `localStorage` serialization to the 150 ms debounce (still flushed immediately on `⌘S`, `Naizo.save()`, `Naizo.exportHTML()`, and `pagehide`).

```html
<style>
  input.alloc-range {
    appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background:
      linear-gradient(
        to right,
        #10b981 0% var(--val, 0%),
        #e5e0d8 var(--val, 0%) var(--cap, 100%),
        transparent var(--cap, 100%) 100%
      ),
      repeating-linear-gradient(-45deg, #f5f2eb 0 4px, #ded8cc 4px 8px);
  }
</style>

<div id="alloc-group">
  <label>
    Build (<span naizo="alloc_build">40</span>%)
    <input type="range" class="alloc-range" min="0" max="100" naizo="alloc_build" value="40" />
  </label>
  <label>
    Polish (<span naizo="alloc_polish">30</span>%)
    <input type="range" class="alloc-range" min="0" max="100" naizo="alloc_polish" value="30" />
  </label>
  <p>Unallocated headroom: <strong naizo="alloc_free">30</strong>%</p>
</div>

<script>
  const KEYS = ['alloc_build', 'alloc_polish'];
  function paintSliderTracks() {
    const vals = KEYS.map((k) => Number(Naizo.getField(k) ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    KEYS.forEach((key, idx) => {
      const el = document.querySelector(`input.alloc-range[naizo="${key}"]`);
      if (!el) return;
      const cap = Math.max(0, 100 - (total - vals[idx]));
      el.style.setProperty('--val', `${vals[idx]}%`);
      el.style.setProperty('--cap', `${cap}%`);
    });
  }
  document.getElementById('alloc-group').addEventListener(
    'input',
    (e) => {
      const key = e.target.getAttribute?.('naizo');
      if (!KEYS.includes(key)) return;
      const otherSum = KEYS.filter((k) => k !== key).reduce(
        (sum, k) => sum + Number(Naizo.getField(k) ?? 0),
        0,
      );
      const clamped = Math.min(Number(e.target.value), Math.max(0, 100 - otherSum));
      if (clamped !== Number(e.target.value)) e.target.value = String(clamped);
      Naizo.batch(
        () => {
          Naizo.setField(key, clamped);
          Naizo.setField('alloc_free', Math.max(0, 100 - otherSum - clamped));
        },
        { deferPersist: true },
      );
    },
    true,
  );
  Naizo.ready(paintSliderTracks);
  window.addEventListener('naizo:hydrate', paintSliderTracks);
  window.addEventListener('naizo:change', paintSliderTracks);
</script>
```

#### (d) `naizo="key"` Plain-Text Mirroring + Shared `<datalist>` Autocomplete + `[naizo-ignore]` Conditional Links/Badges

> **Why `naizo.js` omits `naizo-text`, `naizo-href`, and `naizo-index`:** Expression/URL directives turn HTML attributes into a mini template engine and risk `javascript:` href injection (`D26`, `D43`, `D57`). Standard `naizo="key"` on `<span>` / `<h3>` already live-mirrors sibling inputs (`EC19`, `EC56`), one shared `<datalist id="...">` outside `[naizo-list]` gives native free-text autocomplete, and `[naizo-ignore]` renders formatted row badges (`CARD-01`) and protocol-checked `<a>` links safely.

```html
<datalist id="owner-directory">
  <option value="Alex"></option>
  <option value="Jordan"></option>
  <option value="Sam"></option>
</datalist>

<div id="cards-list" naizo-list="cards">
  <template naizo-template>
    <article class="card" naizo-item>
      <header>
        <span class="card-index" naizo-ignore></span>
        <!-- Passive <h3 naizo="name"> safely precedes <input naizo="name" value="Untitled"> (EC56) -->
        <h3 naizo="name"></h3>
        <a class="card-link" naizo-ignore target="_blank" rel="noopener noreferrer" hidden
          >Open ↗</a
        >
      </header>
      <label>Title <input type="text" naizo="name" value="Untitled" /></label>
      <label>Owner <input type="text" naizo="owner" list="owner-directory" /></label>
      <label>Spec URL <input type="url" naizo="spec_url" placeholder="https://..." /></label>
    </article>
  </template>
</div>

<script>
  function syncCardMeta() {
    const cards = Naizo.getList('cards');
    document.querySelectorAll('#cards-list > [naizo-item]').forEach((row, i) => {
      const badge = row.querySelector('.card-index');
      if (badge) badge.textContent = `CARD-${String(i + 1).padStart(2, '0')}`;
      const link = row.querySelector('.card-link');
      const rawUrl = String(cards[i]?.spec_url ?? '').trim();
      const safeHref = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
      if (link) {
        link.hidden = !safeHref;
        if (safeHref) link.href = safeHref;
      }
    });
  }
  Naizo.ready(syncCardMeta);
  window.addEventListener('naizo:hydrate', syncCardMeta);
  window.addEventListener('naizo:change', syncCardMeta);
</script>
```

#### (e) Syncing Dynamic `<option>` Lists into `<template naizo-template>.content`

> **Why `naizo.js` omits `naizo-options` and `naizo-autocreate-option`:** Auto-generating `<option>` tags from arbitrary strings bakes typos and stale enum values into `Naizo.exportHTML()` (`D57`). Populate dynamic `<option>` elements into `<template naizo-template>.content` (plus live `[naizo-item]` selects) whenever the source list changes so every cloned row already has valid `<option>` tags before hydration (`EC15`, `EC55`).

```javascript
function syncTeamSelectOptions() {
  const teams = Naizo.getList('teams')
    .map((t) => String(t.name ?? '').trim())
    .filter(Boolean);
  const buildOptions = (selectEl, currentVal) => {
    selectEl.replaceChildren(
      new Option('— Unassigned —', ''),
      ...teams.map((name) => new Option(name, name)),
    );
    selectEl.value = teams.includes(currentVal) ? currentVal : '';
    if (!currentVal && selectEl.value !== '') selectEl.selectedIndex = -1;
  };

  // 1. Keep <template naizo-template>.content synchronized for future addItem() / setList() clones
  const tpl = document.querySelector('[naizo-list="tasks"] > template[naizo-template]');
  const tplSelect = tpl?.content.querySelector('select[naizo="team"]');
  if (tplSelect) buildOptions(tplSelect, '');

  // 2. Refresh already-rendered [naizo-item] rows while preserving stored item.team values
  const tasks = Naizo.getList('tasks');
  document.querySelectorAll('[naizo-list="tasks"] > [naizo-item]').forEach((row, i) => {
    const sel = row.querySelector('select[naizo="team"]');
    if (sel) buildOptions(sel, String(tasks[i]?.team ?? ''));
  });
}
Naizo.ready(syncTeamSelectOptions);
window.addEventListener('naizo:hydrate', syncTeamSelectOptions);
window.addEventListener('naizo:change', (e) => {
  if (e.detail?.list === 'teams' || e.detail?.scope === 'batch') syncTeamSelectOptions();
});
```

#### (f) Delegated Native `'change'` for Commit-Time Cross-Field Derivation (`name → slug`)

> **Why `naizo.js` omits `naizo-lazy` (and why `naizo:change` never fires on `blur` for text inputs):** `naizo.js` updates `store` on every `input` event so live mirroring, `localStorage`, and `⌘S` are always current. When the user later blurs the input, `store` already matches `el.value`, so `shouldUpdateStoredValue()` returns `false` and `naizo:change` does not re-fire (`D57`). Use a delegated native DOM `'change'` listener whenever a derived field (`slug`, `sku`) should auto-fill only once editing commits.

```javascript
document.querySelector('[naizo-list="cards"]').addEventListener('change', (e) => {
  if (!(e.target instanceof HTMLInputElement) || e.target.getAttribute('naizo') !== 'name') return;
  const itemEl = e.target.closest('[naizo-item]');
  const rows = Array.from(document.querySelectorAll('[naizo-list="cards"] > [naizo-item]'));
  const index = itemEl ? rows.indexOf(itemEl) : -1;
  if (index < 0) return;
  const item = Naizo.getList('cards')[index];
  if (item && !String(item.slug ?? '').trim()) {
    const slug = e.target.value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug) Naizo.updateItem('cards', index, { slug });
  }
});
```

#### (g) Immutable Raw-Record Pools with Derived Merge / Clarification State

> **Why `naizo.js` omits `Naizo.clearList()`, `Naizo.updateWhere()`, `--naizo-bar-*`, and `[naizo-cloak]`:** `Naizo.setList(name, [])` clears any list in one validated call; `Naizo.batch()` expresses arbitrary multi-record merges without a custom query DSL; `naizo-pill-corner` / `naizo-no-pill` position or hide the Status Pill without breaking FLIP 4-corner snap geometry; and `<template naizo-template>` with `0` static `[naizo-item]` shells prevents pre-hydration flash without a `[naizo-cloak]` script race (`D57`).

- **Triage / Deduplication Studio Architecture:** Keep imported source records untouched in an unbound or read-only `db.lists.raw_records` pool (`Naizo.setList('raw_records', importedRows)` to load; `Naizo.setList('raw_records', [])` to clear) and store human merge groups, canonical field overrides, and clarification notes in `db.lists.merged_items` or `db.custom.merges` via `Naizo.batch()`:

```javascript
function mergeSelectedRecords(sourceIds, canonicalTitle) {
  const groupId = 'grp-' + Date.now();
  Naizo.batch(() => {
    Naizo.addItem('merged_items', {
      id: groupId,
      title: canonicalTitle,
      sourceIds, // Pass-through array pointing into immutable db.lists.raw_records (D15)
      status: 'Needs Clarification',
    });
    Naizo.set('selectedRawIds', []);
  });
}
```

### Blueprint E: Interactive Option Lab & Human Review Prototype (`D45`)

When helping a user compare design directions, layout options, architecture trade-offs, or copy variants, generate a self-persisting `naizo.js` comparison page (`design-lab.html`):

- Bind option controls (`<input type="radio" name="direction" value="washi" naizo="direction">`, `<select naizo="measure">`, `<select naizo="inspector_layout">`) and a review notes `<textarea naizo="design_notes" rows="4">` to `#naizodb`.
- Use `Naizo.ready()` + `naizo:hydrate` + `naizo:change` to switch live preview attributes (`document.documentElement.dataset.direction = Naizo.getField('direction')`) in real time.
- Ask the user to explore the options in their browser, write feedback in the notes box, and press **`⌘S` / `Ctrl+S`** to save to disk. On the next turn, read `<script id="naizodb" type="application/json">` directly from disk to apply their exact selected options and written notes.

### Blueprint F: Declarative Mini-API Client, Webhooks, & `#net` Network Rules (`naizo-get` / `naizo-post`, `D43`, `D50`, `D51`, `D52`)

Use `naizo-get`, `naizo-post`, or `Naizo.fetch()` when an HTML app needs to seed or sync `#naizodb` from public JSON APIs, static `.json` files, or a `localhost` agent server, or push `#naizodb` payloads to webhooks:

```html
<!-- Seed a list once on first boot only when empty (never overwrites user edits on F5 reload) -->
<div
  naizo-get="https://api.github.com/repos/nickosh/naizo/issues"
  naizo-into="list:issues"
  naizo-trigger="init"
></div>

<!-- Pull a nested JSON scalar into db.fields on click -->
<button
  type="button"
  naizo-get="https://api.example.com/status.json"
  naizo-path="release.latestTag"
  naizo-into="field:release_tag"
>
  Sync Tag
</button>

<!-- Push db.fields to a webhook via CORS-safelisted text/plain;charset=UTF-8 POST -->
<button type="button" naizo-post="https://hooks.example.com/notify" naizo-body="fields">
  Send Update
</button>
```

- **Store-first vs. DOM-only vs. raw fetch targets (`D15`, `D22`, `D51`, `D52`, `EC59`):** Use `naizo-into="field:<key>"`, `list:<name>`, `custom:<key>`, or `db` (also the default when `naizo-into` is omitted on declarative `naizo-get`, automatically backing up any non-empty current `store` to `naizodb_backup_<key>` for 1-click `↺ Restore`, `EC59`) to persist into `#naizodb`. `naizo-into="#selector"` writes strictly via `textContent` (never `innerHTML`) as a transient DOM preview without mutating `#naizodb`. Omitting `naizo-into` on declarative `naizo-post` or omitting `options.into` on programmatic `await Naizo.fetch(url)` (any HTTP method) is non-mutating – returning `{ ok, status, data }` so custom JS can transform external API JSON before calling `Naizo.setList()` / `Naizo.setField()`.
- **Rightmost `#net` wired-globe indicator, strict `1..6` Status Pill buttons, & debugging (`D50`, `D56`, `D57`, `D59`, `EC02`, `EC04`, `EC36`, `EC48`, `EC59`):** The translucent frosted-glass Status Pill (`#__naizodb_host__`) renders the leftmost `20px` _Maru ni Mitsuishi_ (`丸に三つ石` / `品`) `#dot` crest (Green `#10b981` for `saved`/`saving`, Amber `#f59e0b` for `cached`/`needs-permission`/`conflict`, Red `#ef4444` for `error`, with `Boot-Up`, `Saving Heartbeat` `1.55s` cycle completion, `Conflict Clash`, `Needs Permission Wave Pulse`, and `Error Sync Pulse`), followed by `22×22px` circular icon buttons in strict `1..6` left-to-right order (`1. Link/Resume Disk Sync & Unlink Disk` swapping in Slot 1, `2. Save to PC`, `3. Copy JSON / ✓ Copied`, `4. Repair JSON` Wrench when startup or live linked-disk `#naizodb` JSON is malformed—backing up raw broken disk text to `naizodb_raw_backup_<key>`, pausing automatic writes until repaired, and auto-recovering if fixed externally on disk, `5. Restore Backup` History Clock-Undo, `6. Reset to Initial State` Red Eraser shown in Online Mode and unlinked Local Mode `!fileHandle` whenever `localStorage` diverges from `initialDiskDb` and auto-hiding once linked to disk) and the rightmost `18×18px` `#net` wired-globe (`API idle`, `API active` `L→R` wave held `>= 600 ms`, or `API request failed` red pulse that persists across subsequent successful requests until the user clicks `#net` to clear it or reloads the page; see `examples/weather.html`), plus FLIP 4-corner snap drag persisted in `naizodb_ui_<key>` (with optional initial corner hint `naizo-pill-corner` / `data-naizo-pill-corner`). `naizo.js` intentionally omits a built-in network inspector so the runtime stays light and flexible – inspect failed requests in the browser's DevTools `Network` tab.
- **Local Mode vs. Online Mode network, browser, & server rules (`D43`, `D59`, `EC61`):**
  - **Local Mode (`file://` or plain non-watching `http://localhost` such as `python3 -m http.server` / `npx serve`):** Fetched state persists into `localStorage` and surgically into `<script id="naizodb">` on disk when linked (out of the box in **Chrome/Edge/Arc/Opera**, via `brave://flags/#file-system-access-api` in **Brave**, or via `localStorage` + `.html` download + `📋 Copy JSON` in **Safari/Firefox**; avoid file-watching live-reload dev servers like **Vite**, **VS Code Live Server**, or **BrowserSync**). Note that `file://` sends `Origin: null` (requiring `Access-Control-Allow-Origin: *` to read responses, or `naizo-cors="no-cors"` without `naizo-into` for blind `POST` webhooks) and blocks relative `fetch('./data.json')` unless served via `http://localhost`.
  - **Online Mode (`https://` static hosts):** Relative `naizo-get="./preset.json"` works out of the box and bakes fetched data into **`⬇ Save to PC`** downloads; browsers block mixed-content `http://` on `https://` pages and require `Access-Control-Allow-Private-Network: true` for `localhost` loopback calls.

---

## 6. Human-First Typography & Minimalist Design (`D45` — Fallback When Author Has No Style Preference)

1. **Always follow the author's explicit preferences first:**
   - If the user or project specifies a visual style, layout structure, color palette, component library, or CSS framework (e.g., Tailwind, brutalist, dense dashboard grid, neon dark theme, or existing brand tokens), **honor the author's direction completely**. Never override explicit user preferences with a default house style.
2. **Default fallback when the author has NOT specified styling preferences (`Washi Editorial` minimalism):**
   - When the user asks for an HTML tool, doc, plan, or app without specifying visual styling, avoid stereotypical AI "neuro-slop" (nested multi-column bento cards, heavy drop shadows, neon gradients, uppercase pill-badge clutter on every heading, and cramped multi-pane sidebars).
   - Default to a calm, human-readable **editorial layout**:
     - **Palette:** Warm paper background in light mode (`#faf8f5` surface, `#ffffff` elevated inputs, `#1c1b18` ink, `#57534e` muted prose, `#e5e0d8` hair-thin `1px` borders, `#a8432b` terracotta accent) and warm charcoal in dark mode (`#141311` surface, `#1c1b18` elevated inputs, `#ece8e1` ink, `#a6a096` muted prose, `#2e2c28` borders, `#e07a5f` accent).
     - **Typography & Measure:** Pair an editorial serif (`'Newsreader'`, `'Iowan Old Style'`, `Georgia`, `serif`) for headings with a clean humanist sans-serif (`'Plus Jakarta Sans'`, `system-ui`, `sans-serif`) for body copy (`16px–16.5px`, `line-height: 1.65–1.75`) inside a calm single-column container (`max-width: 760px–900px`), separating sections with hair-thin `1px` horizontal rules instead of nested boxes.
     - **Punctuation & Tables:** Prefer spaced en-dashes (`–`) over unspaced em-dashes in prose. Keep reference tables to at most **3 balanced columns** (grouping secondary metadata as compact block badges inside the first cell) and never set `white-space: nowrap` on columns containing long attribute or method signatures.
3. **Theme persistence without dirtying initial boot state (`"theme": "system"`, `EC48`, `D45`):**
   - When adding a persistent Light/Dark theme toggle (`naizo="theme"`), initialize `"theme": "system"` in `#naizodb` and let CSS `@media (prefers-color-scheme: dark) { html:not([data-theme='light']) { ... } }` handle OS dark-mode detection automatically.
   - **Never** call `Naizo.setField('theme', 'dark')` on initial page load based on `window.matchMedia`, because mutating `store` on boot marks the document dirty against `initialDiskDb` and prematurely surfaces the Online Mode `↺ Reset` button before the user has made any edits. Call `Naizo.setField('theme', nextTheme)` only when the user explicitly clicks the theme toggle.

---

## 7. Surgical Disk Editing Protocol for CLI / IDE AI Agents

When modifying an existing `naizo.js` `.html` file on disk to update data (`fields`, `lists`, or `custom`):

1. Read the file and extract the JSON inside the live `<script id="naizodb" type="application/json">...</script>` in `<head>` (skipping any `<!-- ... -->` HTML comments if the file contains commented-out examples, `EC60`).
2. Parse the JSON and update `db.fields`, `db.lists`, or `db.custom` while keeping untouched keys and item `id`s intact (`EC58`: unique primitive `item.id`s merge item-by-item across additions, deletions, reorders, and per-property live edits; `id`-less checklists merge disjoint `0 .. base.length - 1` row edits and appends).
3. Update `db._meta = { ...db._meta, updatedAt: new Date().toISOString() }`.
4. Serialize with `JSON.stringify(db, null, 2).replace(/</g, '\\u003c')` and replace **only** the `<script id="naizodb">...</script>` block in the HTML file (using a callback replacement function so `$1` or `$&` inside user JSON values are never interpreted as regex capture groups):

```bash
node -e '
const fs = require("fs");
const file = "plan.html";
const html = fs.readFileSync(file, "utf8");
const re = /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|\x27naizodb\x27|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
const match = html.match(re);
if (!match) throw new Error("Missing #naizodb block");
const db = JSON.parse(match[2]);

// Mutate db.fields, db.lists, or db.custom here:
db.fields.status = "Approved";
db._meta = { ...db._meta, updatedAt: new Date().toISOString() };

const json = JSON.stringify(db, null, 2).replace(/</g, "\\u003c");
fs.writeFileSync(file, html.replace(re, (_m, open, _inner, close) => `${open}\n${json}\n${close}`), "utf8");
'
```

---

## 8. Cookbook & External Integrations (`references/cookbook/` — Load on Demand)

Keep simple `naizo.js` apps dependency-free using Sections 1–7 above. Read a progressive-disclosure Cookbook guide below **only** when the user's task involves that specific external library, media craft, or CLI/testing workflow (`D58`):

| Cookbook Guide & Web Fallback                                                                                                                                                                                 | When to Read (Trigger)                                                                                                      | Key Patterns Covered                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **[`references/cookbook/basecoat-ui-and-dense-forms.md`](references/cookbook/basecoat-ui-and-dense-forms.md)**<br>`https://naizo.js.org/references/cookbook/basecoat-ui-and-dense-forms.md`                   | Building with **Basecoat UI** (`basecoat-css`), dense multi-column `<select>`/`<textarea>` card grids, or `<dialog>` UIs    | `"theme": "system"` `.dark` sync, CSS Grid `min-width: 0` `.select` reset, `field-sizing: fixed; resize: vertical` `.textarea` alignment, `data-filled` triage UX, `<dialog naizo-ignore>` |
| **[`references/cookbook/third-party-dom-and-export.md`](references/cookbook/third-party-dom-and-export.md)**<br>`https://naizo.js.org/references/cookbook/third-party-dom-and-export.md`                      | Pairing `naizo.js` with **Tailwind Play CDN**, **Lucide** icons, **Mermaid**, **`canvas-confetti`**, or **Chart.js**        | Surgical `#naizodb` sync vs. `⬇ Save to PC` export, `data-naizo-strip` on runtime `<style>`/`<canvas>`, non-destructive icon/diagram source wrappers, in-place `chart.update('none')`      |
| **[`references/cookbook/maps-and-live-apis.md`](references/cookbook/maps-and-live-apis.md)**<br>`https://naizo.js.org/references/cookbook/maps-and-live-apis.md`                                              | Building **`file://`-portable interactive maps** (**OpenLayers**), live weather/geo feeds, or route/waypoint studios        | `Origin: null` OpenLayers mount inside `data-naizo-strip`, multi-provider CORS `Naizo.fetch()` chains (`D52`), pin promotion to `[naizo-list]`, `Naizo.setList([])` + 1-click `↺ Undo`     |
| **[`references/cookbook/audio-motion-and-svg-avatars.md`](references/cookbook/audio-motion-and-svg-avatars.md)**<br>`https://naizo.js.org/references/cookbook/audio-motion-and-svg-avatars.md`                | Adding **animated SVGs**, **UI motion**, **procedural Web Audio FX** (`AudioContext`), or **modular SVG avatars**           | `<g transform>` + `fill-box` vs. nested `<svg>`, outer placement vs. inner animated `<g>`, static `<symbol>` vs. inlined animated shapes, FLIP, beat completion, Web Audio, SVG DNA merge  |
| **[`references/cookbook/data-ingestion-export-and-testing.md`](references/cookbook/data-ingestion-export-and-testing.md)**<br>`https://naizo.js.org/references/cookbook/data-ingestion-export-and-testing.md` | Importing **CSV / spreadsheets** (**PapaParse**), exporting **Slack / Sheets TSV**, **CLI seeding** (`gws`), **Playwright** | `FileReader` + `rowHash` idempotent CSV import via `Naizo.setList()`, TSV/Slack clipboard helpers, Node/Python/`gws` surgical `#naizodb` writers, Playwright Shadow DOM & `Naizo.reset()`  |

---

## 9. Installing This Skill in Your Workspace

To equip Claude Code, Antigravity, Cursor, GitHub Copilot, Gemini CLI, or Codex with this skill (including `references/cookbook/*.md`) in any repository, install it via the GitHub CLI (`gh skill`), the npm Skills CLI (`npx skills`), or `curl`:

```bash
# 1. GitHub CLI (gh v2.90+ — installs SKILL.md + references/cookbook/*.md from the latest release)
gh skill install nickosh/naizo naizo

# 2. npm Skills CLI (npx skills — installs SKILL.md + references/cookbook/*.md)
npx skills add nickosh/naizo --skill naizo

# 3. Direct curl / file copy (no CLI required; cookbook guides remain readable via https://naizo.js.org/references/cookbook/*.md)
mkdir -p .agents/skills/naizo && curl -fsSL https://naizo.js.org/SKILL.md -o .agents/skills/naizo/SKILL.md
mkdir -p .claude/skills/naizo && curl -fsSL https://naizo.js.org/SKILL.md -o .claude/skills/naizo/SKILL.md
```

### Experimental / In-Development (`main` Branch)

To preview unreleased features from `main` before the next tagged release is published, pair the in-development `dist/naizo.js` bundle with the `@main` skill (note: `main` is under active development and may contain experimental or not-yet-released changes):

```html
<!-- In-development runtime directly from main (or local ./dist/naizo.js) -->
<script src="https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js" defer></script>
```

```bash
# In-development AI skill from main
gh skill install nickosh/naizo naizo@main
npx skills add nickosh/naizo@main --skill naizo
mkdir -p .agents/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .agents/skills/naizo/SKILL.md
```
