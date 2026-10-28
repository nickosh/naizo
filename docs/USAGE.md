# `naizo.js` — Comprehensive Usage Reference

This guide is the complete authoring and integration reference for **`naizo.js`** (npm package `naizojs`)—the zero-dependency, self-persisting HTML built-in database (`#naizodb`) and declarative list repeater (`[naizo-list]`) for Human + AI Agent workflows.

For product vision and scope boundaries, see [PRODUCT.md](PRODUCT.md). For architectural rationale (`Dxx`) and boundary cases (`ECxx`), see [DECISIONS.md](DECISIONS.md) and [EDGE_CASES.md](EDGE_CASES.md).

---

## Table of Contents

1. [Core Mental Model: Body is Template, `#naizodb` is Data](#1-core-mental-model-body-is-template-naizodb-is-data)
2. [The `#naizodb` Canonical JSON Schema](#2-the-naizodb-canonical-json-schema)
3. [Loading `naizo.js` (CDN, Local Bundle, & ESM)](#3-loading-naizojs-cdn-local-bundle--esm)
4. [Declarative HTML Attributes Reference](#4-declarative-html-attributes-reference)
5. [Scalar Field Bindings (`naizo="key"`)](#5-scalar-field-bindings-naizokey)
6. [Declarative List Repeaters (`naizo-list` & `naizo-item`)](#6-declarative-list-repeaters-naizo-list--naizo-item)
7. [Templates (`naizo-template` vs. `data-naizo-auto-template`)](#7-templates-naizo-template-vs-data-naizo-auto-template)
8. [State Exclusion (`naizo-ignore`) vs. Export Stripping (`naizo-strip`)](#8-state-exclusion-naizo-ignore-vs-export-stripping-naizo-strip)
9. [Programmatic JavaScript API (`window.Naizo`) & Events](#9-programmatic-javascript-api-windownaizo--events)
10. [Local Mode vs. Online Mode & Web-to-Local App Exchange](#10-local-mode-vs-online-mode--web-to-local-app-exchange)
11. [Two-Way Disk Sync, Live Watch, & Conflict Resolution](#11-two-way-disk-sync-live-watch--conflict-resolution)
12. [Architectural Recipes (`examples/`)](#12-architectural-recipes-examples)
13. [Lightweight Vanilla UI Patterns (Search/Filter & Tabs)](#13-lightweight-vanilla-ui-patterns-searchfilter--tabs)
14. [Local-First & AI Agent Workflows](#14-local-first--ai-agent-workflows)

---

## 1. Core Mental Model: Body is Template, `#naizodb` is Data

In Japanese, **_naizō_ (ないぞう)** carries two meanings that define the architecture of a `naizo.js` document:

- **内蔵 (_built-in / housed within_):** Every `.html` file embeds its canonical state inside `<script id="naizodb" type="application/json">` in `<head>`.
- **内臓 (_internal organs_):** `naizo.js` acts as the document's reactive internal organs, keeping the live DOM, `localStorage`, and `<script id="naizodb">` on disk synchronized.

Under decisions `D15`, `D16`, and `D23`, `naizo.js` strictly separates **data** from **view markup**:

1. **`<script id="naizodb">` is the canonical data:** On boot, `naizo.js` parses `#naizodb` (and any newer `localStorage` state) into an in-memory `NaizoDatabase` store and hydrates bound elements and list items in `<body>`.
2. **`<body>` is the declarative template:** When linked to a local file via the File System Access API (`showSaveFilePicker`), saving rewrites **only** the `<script id="naizodb">...</script>` block on disk (`D16`). Every other byte of the file stays untouched—so third-party runtime scripts (Tailwind Play CDN, Lucide icons, Mermaid diagrams, syntax highlighters) never pollute your file on disk or create noisy Git diffs.
3. **HTML attributes are baked only on full-HTML export (`D23`):** Live edits update the in-memory store in `O(1)` without mutating DOM attributes (`setAttribute('value', ...)`), preventing `<textarea>` cursor jumps and preserving native `form.reset()`. Full attribute baking and runtime UI stripping run only on a cloned document when calling `Naizo.exportHTML()` or `Naizo.downloadHTML()`.

> **Golden Rule for Humans and AI Agents:** Edit `<script id="naizodb">` on disk to change **data**; edit `<body>` markup on disk to change the **view**.

---

## 2. The `#naizodb` Canonical JSON Schema

Place `<script id="naizodb" type="application/json">` near the top of `<head>` (before `<script src="...naizo.js" defer></script>`). If omitted on an empty or new page, `naizo.js` automatically creates it in `<head>`.

```html
<head>
  <script id="naizodb" type="application/json">
    {
      "_meta": {
        "id": "release-plan-v2",
        "updatedAt": "2026-10-26T12:00:00.000Z"
      },
      "fields": {
        "title": "Q4 Launch Readiness Plan",
        "owner": "Kenji",
        "approved": false,
        "confidence": 85
      },
      "lists": {
        "tasks": [
          {
            "id": "task-1",
            "done": true,
            "title": "Verify surgical #naizodb disk writes",
            "estimate": "2h"
          }
        ]
      },
      "custom": {
        "activeTab": "checklist"
      }
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
</head>
```

### Top-Level Buckets (`NaizoDatabase`)

| Bucket   | Type                                             | Purpose                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_meta`  | `Record<string, unknown>`                        | Metadata dictionary. `naizo.js` updates `_meta.updatedAt` (ISO-8601 timestamp) **only** when serialized content in `fields`, `lists`, or `custom` actually changes (`EC06`). Optional `_meta.id` scopes storage keys (`EC11`). |
| `fields` | `Record<string, unknown>`                        | Standalone scalar values bound via `naizo="key"` / `data-naizo="key"` outside `[naizo-item]`, or read/written via `Naizo.getField(key)` / `Naizo.setField(key, value)`.                                                        |
| `lists`  | `Record<string, Array<Record<string, unknown>>>` | Repeating arrays of plain item objects bound to `[naizo-list="name"]` containers, or manipulated via `Naizo.getList`, `addItem`, `updateItem`, `moveItem`, and `removeItem`.                                                   |
| `custom` | `Record<string, unknown>`                        | Arbitrary JSON-serializable state for custom JavaScript widgets, read/written via `Naizo.get(key)`, `Naizo.set(key, value)`, and `Naizo.delete(key)`.                                                                          |

### Pass-Through Keys (`D15`, `EC14`)

`naizo.js` never resets `fields` or `lists` to `{}` when capturing DOM edits. Instead, the in-memory store merges bound DOM changes into existing objects and maps each rendered `[naizo-item]` DOM element to its backing item object via a `WeakMap`:

- **Unbound `fields` keys** (e.g., metadata written by an AI agent that has no matching input in `<body>`) remain intact.
- **Unbound `lists` arrays** (lists stored in `#naizodb` without a corresponding `[naizo-list]` container on the current page) remain intact.
- **Extra list-item keys** (such as agent-assigned `"id"`, `"estimate"`, `"updatedAt"`, or custom per-card dictionary attributes in [`examples/inventory.html`](../examples/inventory.html)) survive edits, reordering (`moveItem`), and partial updates (`updateItem`).
- Deleting a key is always explicit via `Naizo.deleteField(key)`, `Naizo.delete(key)`, or `Naizo.removeItem(listName, index)`.

### Script-Safe `\u003c` Escaping (`D13`, `EC08`)

In HTML5, a literal `</script>` sequence inside a `<script type="application/json">` block prematurely closes the script tag and breaks the document parser. Whenever `naizo.js` serializes `#naizodb` (both in the DOM and on disk), it formats the JSON with 2-space indentation and escapes every `<` character as `\u003c`:

```javascript
JSON.stringify(db, null, 2).replace(/</g, '\\u003c');
```

`\u003c` is standard RFC 8259 JSON Unicode escaping: `JSON.parse()` decodes `\u003c` back into `<` transparently with zero data alteration, while ensuring `</script>`, `<script>`, and `<!--` in user notes are completely safe inside HTML.

### Validation, Own-Property Safety, & Broken-JSON Recovery (`EC04`, `EC24`, `EC33`, `EC35`, `EC38`)

- **Startup shape validation (`EC04`, `EC33`):** On boot, `naizo.js` verifies that `#naizodb` is a plain object whose `_meta`, `fields`, `lists`, and `custom` properties (if present) are plain objects, and that every list in `lists` is an array of plain objects. If `<script id="naizodb">` contains malformed JSON or an invalid bucket shape, `naizo.js`:
  1. Preserves the raw `<script id="naizodb">` text untouched in the DOM,
  2. Hydrates in-memory state from the last good `localStorage` cache if available,
  3. Displays a red **`Invalid #naizodb JSON`** status pill with a 1-click **`↺ Repair`** button, and
  4. Blocks automatic disk write-back so a syntax typo made by hand never gets overwritten or corrupted silently. Clicking **`↺ Repair`** rewrites `#naizodb` from the active in-memory store and resumes normal persistence.
- **Prototype-pollution protection (`EC24`, `EC38`):** All internal dictionary lookups use `Object.hasOwn()` and all property assignments use `Object.defineProperty()`, so keys like `__proto__`, `constructor`, or `toString` are stored and serialized as ordinary own data properties without touching `Object.prototype`.
- **Strict JSON value validation (`EC35`):** `Naizo.set()`, `Naizo.setField()`, `Naizo.addItem()`, and `Naizo.updateItem()` validate that values are finite, acyclic JSON types (`string`, finite `number`, `boolean`, `null`, plain objects, and dense arrays). Passing `undefined`, `NaN`, `Infinity`, functions, symbols, `BigInt`, class instances, or circular references logs a warning and leaves the store unchanged.

---

## 3. Loading `naizo.js` (CDN, Local Bundle, & ESM)

### Option A: npm-Backed CDN (`jsDelivr` or `unpkg` — Recommended for Standalone HTML)

Load one provider in `<head>` with `defer` (`D34`, `D39`):

```html
<!-- Readable IIFE bundle (jsDelivr) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>

<!-- Prebuilt minified IIFE bundle (~12.3 KB gzipped) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js" defer></script>

<!-- Alternative: unpkg -->
<script src="https://unpkg.com/naizojs@latest/dist/naizo.js" defer></script>
```

Use `@latest` to follow published releases automatically as CDN caches refresh, pin a specific version tag for immutable artifacts, or use `https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js` (or local `./dist/naizo.js`) for the latest in-development build on `main`. See [PUBLISHING.md](PUBLISHING.md#cdn-urls-and-automatic-updates) for CDN caching details.

### Option B: Local File Copy (Offline & Local Repository Use)

```html
<script src="./dist/naizo.js" defer></script>
```

When an HTML file using a relative path like `../dist/naizo.js` or `./dist/naizo.js` is served online (`https://`) and a visitor clicks **`⬇ Save to PC`** (`Naizo.downloadHTML()`), `naizo.js` automatically rewrites the relative `<script src>` on the downloaded clone to `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js` so the downloaded file works standalone on their computer (`D41`, `EC48`).

### Option C: Side-Effect-Free ESM Import (`naizojs`)

While the browser IIFE (`dist/naizo.js`) sets `window.Naizo` / `window.NaizoDB` and auto-runs `initNaizo()` on load, the ESM entrypoint (`dist/index.mjs`) is completely side-effect free (`D25`, `EC37`, `EC49`):

```typescript
import {
  Naizo,
  NaizoDB,
  initNaizo,
  type NaizoAPI,
  type NaizoDatabase,
  type NaizoMeta,
} from 'naizojs';

await initNaizo();
```

To use the browser IIFE bundle without auto-initializing on `DOMContentLoaded`, add `naizo-manual` (or `data-naizo-manual`) to `<html>`, `<body>`, or the `<script>` tag and call `await Naizo.init()` when ready.

---

## 4. Declarative HTML Attributes Reference

`naizo.js` supports both concise **`naizo` / `naizo-*`** attributes and HTML5-compliant **`data-naizo` / `data-naizo-*`** attributes everywhere (`D08`). Every short attribute has a strict 1-to-1 `data-*` counterpart (`EC49`):

| Short Attribute                    | HTML5 `data-*` Alias                    | Placement                                                                                              | Behavior                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`                      | `data-naizo="key"`                      | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf element, or `[naizo-item]` | Binds the element to `db.fields["key"]` when standalone, or to `item["key"]` when inside (or on) a `[naizo-item]`.                                                                        |
| `naizo-list="name"`                | `data-naizo-list="name"`                | List container (`<div>`, `<ul>`, `<ol>`, `<tbody>`, `<table>`)                                         | Binds direct `[naizo-item]` children to `db.lists["name"]` and appends a `+ Add Item` footer unless `naizo-no-controls` is set.                                                           |
| `naizo-item`                       | `data-naizo-item`                       | Direct child of `[naizo-list]` (`<div>`, `<li>`, `<tr>`, etc.)                                         | Marks a repeating row or card. Receives hover `↑`, `↓`, and `×` controls unless `naizo-no-controls` is set on the parent list.                                                            |
| `naizo-template`                   | `data-naizo-template`                   | Direct child `<template>` inside `[naizo-list]`                                                        | Explicit HTML blueprint cloned when creating new items in `[naizo-list]`. If omitted, `naizo.js` auto-infers one from the first `[naizo-item]`.                                           |
| `naizo-add="name"`                 | `data-naizo-add="name"`                 | `<button>` (anywhere in document)                                                                      | Appends a blank `{}` item to `[naizo-list="name"]` and focuses the first text input in the newly created row (`EC31`).                                                                    |
| `naizo-remove`                     | `data-naizo-remove`                     | `<button>` inside `[naizo-item]`                                                                       | Removes the enclosing `[naizo-item]` row and its backing object from `db.lists`.                                                                                                          |
| `naizo-move="up"` / `"down"`       | `data-naizo-move="up"` / `"down"`       | `<button>` inside `[naizo-item]`                                                                       | Moves the enclosing `[naizo-item]` row up (`index - 1`) or down (`index + 1`) in both the DOM and `db.lists`.                                                                             |
| `naizo-no-controls`                | `data-naizo-no-controls`                | On a `[naizo-list]` container                                                                          | Suppresses auto-injected `.naizo-item-tools` (`↑ ↓ ×`) and `.naizo-list-footer` (`+ Add Item`) so you can render custom controls or read-only lists.                                      |
| `naizo-ignore`                     | `data-naizo-ignore`                     | Any element                                                                                            | Excludes the element and its entire subtree from state binding and seeding while keeping it intact in templates and exported HTML (`D12`, `EC07`).                                        |
| `naizo-strip`                      | `data-naizo-strip`                      | Any element                                                                                            | Excludes the element and its subtree from state binding and strips it from auto-inferred list templates and `Naizo.exportHTML()` / `Naizo.downloadHTML()` (`D12`, `D47`, `EC03`, `EC07`). |
| `naizo-id="scope"`                 | `data-naizo-id="scope"`                 | `<html>` or `<body>`                                                                                   | Scopes `localStorage` keys (`naizodb_state_<path>::<scope>`) and IndexedDB file handles so multiple documents on `localhost` never collide (`EC11`).                                      |
| `naizo-mode="online\|local\|auto"` | `data-naizo-mode="online\|local\|auto"` | `<html>` or `<body>`                                                                                   | Overrides automatic Local Mode vs. Online Mode detection (`D41`, `EC48`).                                                                                                                 |
| `naizo-manual`                     | `data-naizo-manual`                     | `<html>`, `<body>`, or `<script>`                                                                      | Disables automatic `initNaizo()` boot in the browser IIFE bundle (`EC37`).                                                                                                                |

---

## 5. Scalar Field Bindings (`naizo="key"`)

Standalone elements with `naizo="key"` (or `data-naizo="key"`) outside `[naizo-item]` bind to `db.fields["key"]`.

### Explicit Opt-In Only (`D12`, `D15`, `EC11`, `EC49`)

`naizo.js` **never** captures unannotated inputs or falls back to `id` or `name` attributes. Only elements with `naizo="key"` or `data-naizo="key"` are bound. If an element exists in the DOM with a default value (e.g., `<input type="text" naizo="owner" value="Alex">`) and `"owner"` is not yet present in `db.fields`, `naizo.js` seeds `db.fields.owner = "Alex"` on boot.

### Supported Elements & Value Coercion (`D14`, `D22`, `EC12`, `EC15`, `EC18`, `EC21`, `EC25`)

| Element                                                           | Stored JSON Type             | Details & Edge-Case Protections                                                                                                                                                                   |
| ----------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<input type="text\|search\|email\|url\|tel\|date\|time\|color">` | `string` (or preserved type) | Reads/writes `.value`. If `#naizodb` stored a `number` or `boolean` (e.g., `3`) and the DOM string matches `String(prevVal)`, the original JSON type is preserved (`EC25`).                       |
| `<input type="number">` / `<input type="range">`                  | `number \| null`             | Coerces finite numeric input to `number`; stores `null` when the input is cleared (`""`) (`EC12`).                                                                                                |
| `<input type="checkbox">`                                         | `boolean`                    | Reads/writes `.checked`. Hydrating strings `"false"`, `"0"`, `""`, `"no"`, or `"off"` coerces to `false` rather than truthy `true` (`EC25`).                                                      |
| `<input type="radio" name="grp" value="a" naizo="choice">`        | `string`                     | All radios in the group carry `naizo="choice"`; the checked radio's `.value` is stored.                                                                                                           |
| `<textarea naizo="notes">`                                        | `string`                     | Reads/writes `.value` on live DOM; bakes `.textContent` only on the export clone so the cursor never jumps to the end while typing (`D23`, `EC12`, `EC16`).                                       |
| `<select naizo="status">`                                         | `string`                     | Reads/writes `.value`. If `#naizodb` contains a value with no matching `<option>`, `naizo.js` logs a warning and keeps the stored value in memory instead of clobbering it with `""` (`EC15`).    |
| `<select multiple naizo="tags">`                                  | `string[]`                   | Reads/writes an array of selected `<option>` values (`EC12`).                                                                                                                                     |
| `<details naizo="panel_open">`                                    | `boolean`                    | Binds `HTMLDetailsElement.open` via a capture-phase `toggle` listener without touching child elements (`EC12`).                                                                                   |
| `[contenteditable]` (`""`, `"true"`, `"plaintext-only"`)          | `string`                     | Reads and writes plain text (`textContent`) by default so untrusted strings in `#naizodb` never execute as `innerHTML` XSS (`D22`, `EC18`). `contenteditable="false"` is not treated as editable. |
| Leaf element (`<span naizo="version">1.0</span>`)                 | `string`                     | Reads/writes `textContent` only if the element has **no** non-ignored child elements. Non-leaf elements with child markup are skipped with a console warning (`EC12`).                            |
| `<input type="password\|file\|button\|submit\|reset\|image">`     | _Skipped_ (`EC21`)           | Always ignored with a console warning so passwords never leak into `#naizodb` and `type="file"` never throws `InvalidStateError`.                                                                 |

### Duplicate Scalar Bindings & Native `<form>` Reset (`EC12`, `EC19`)

- **Duplicate key synchronization (`EC19`):** You can bind multiple standalone elements to the same key (for example, `<h1 contenteditable="true" naizo="doc_title">` in the header and `<input type="text" naizo="doc_title">` in a settings drawer). Editing either element updates `db.fields.doc_title` in `O(1)` and immediately propagates the new value to all other standalone elements bound to `"doc_title"`.
- **Native `form.reset()` support (`EC12`):** Because `naizo.js` does not mutate `defaultValue` / `defaultChecked` attributes on the live DOM during typing (`D23`), calling `form.reset()` or clicking `<button type="reset">` restores the original HTML defaults and automatically re-captures those reset values into `#naizodb`.

---

## 6. Declarative List Repeaters (`naizo-list` & `naizo-item`)

Wrap any repeating section in `naizo-list="list_name"` (or `data-naizo-list="list_name"`) and mark each direct repeating child with `naizo-item` (or `data-naizo-item`):

```html
<div naizo-list="tasks">
  <div class="task-row" naizo-item>
    <label>
      <input type="checkbox" naizo="done" />
      <span>Completed</span>
    </label>
    <label>
      <span>Task title</span>
      <input type="text" naizo="title" placeholder="Describe task..." />
    </label>
    <label>
      <span>Priority</span>
      <select naizo="priority">
        <option value="High">High</option>
        <option value="Med">Med</option>
        <option value="Low">Low</option>
      </select>
    </label>
  </div>
</div>
```

### Wrapping `<label>` Rule Inside Lists (`EC39`)

Never pair `<label for="task-input">` with `<input id="task-input">` inside a `[naizo-item]`. When `naizo.js` clones the row for multiple items, every row would share the same duplicate `id="task-input"`, causing clicks on row 3's label to toggle row 1's input. Always wrap `<label>` directly around the `<input>` or `<select>` (using a `<span class="sr-only">` for screen-reader text when visual labels are omitted, as shown in [`examples/starter.html`](../examples/starter.html) and [`examples/checklist.html`](../examples/checklist.html)).

### Self-Bound `[naizo-item]` Elements (`D14`, `EC13`, `EC46`)

For simple single-value lists (such as bullet points or tags), place `naizo="prop"` directly on the `[naizo-item]` root element itself:

```html
<ul naizo-list="highlights">
  <li naizo-item contenteditable="true" naizo="text">First highlight</li>
</ul>
```

`naizo.js` automatically excludes and preserves any `[naizo-ignore]` or `[naizo-strip]` / `[data-naizo-strip]` child elements (including the injected `.naizo-item-tools` `↑ ↓ ×` toolbar) when reading or writing `textContent` on a self-bound `[naizo-item]` (`D47`, `EC46`), so button labels and badges never leak into `db.lists.highlights[i].text` and hydrating the item never destroys its hover toolbar or `[naizo-ignore]` children.

### Valid Table Repeaters (`<table>` / `<tbody naizo-list>` / `<tr naizo-item>`, `EC13`)

HTML tables strictly forbid `<button>` or `<div>` elements as direct children of `<tbody>` or `<tr>`. When `[naizo-list]` is placed on a `<tbody>` (or `<table>`) and `[naizo-item]` is a `<tr>`:

1. `naizo.js` injects `.naizo-item-tools` (`↑ ↓ ×`) inside the **last `<td>` or `<th>`** of each `<tr naizo-item>`.
2. `naizo.js` places `.naizo-list-footer` (`+ Add Item`) **immediately after the enclosing `<table>`** element.

```html
<table>
  <thead>
    <tr>
      <th>Done</th>
      <th>Deliverable</th>
      <th>Owner</th>
    </tr>
  </thead>
  <tbody naizo-list="deliverables">
    <tr naizo-item>
      <td>
        <label><input type="checkbox" naizo="done" /></label>
      </td>
      <td>
        <label><input type="text" naizo="title" /></label>
      </td>
      <td>
        <label><input type="text" naizo="owner" /></label>
      </td>
    </tr>
  </tbody>
</table>
```

### Per-Row Radio Group Scoping (`EC13`)

If a `[naizo-item]` contains `<input type="radio" name="severity" naizo="severity" value="...">`, browsers would normally group all rows' radios together because they share `name="severity"`. `naizo.js` automatically scopes each row's radio `name` attribute to a unique per-row identifier on hydration (storing the original name in `data-naizo-radio-name`) and restores the original `name="severity"` attribute on `Naizo.exportHTML()` / `Naizo.downloadHTML()`.

### Custom List Controls & `naizo-no-controls`

By default, `naizo.js` injects a hover toolbar (`.naizo-item-tools` with `↑`, `↓`, `×`) into each `[naizo-item]` and a `.naizo-list-footer` (`+ Add Item`) below each `[naizo-list]`. To build custom toolbars (or when rendering cards/panes where default controls aren't desired, as in [`examples/notes.html`](../examples/notes.html) and [`examples/inventory.html`](../examples/inventory.html)):

1. Add `naizo-no-controls` (or `data-naizo-no-controls`) to the `[naizo-list]` container.
2. Optionally place your own buttons using `naizo-add="list_name"`, `naizo-move="up"`, `naizo-move="down"`, and `naizo-remove` inside `[naizo-item]`, or call `Naizo.addItem()` / `Naizo.removeItem()` / `Naizo.moveItem()` from JavaScript.

---

## 7. Templates (`naizo-template` vs. `data-naizo-auto-template`)

Every `[naizo-list]` needs an HTML blueprint for rendering items from `#naizodb` and appending new rows (`D14`, `EC09`):

### 1. Auto-Inferred Template (`data-naizo-auto-template="true"` — Default)

If you do **not** author a `<template>` tag inside `[naizo-list]`, `naizo.js` automatically clones the first `[naizo-item]` child on boot, clears its bound values (`clearElementValue()`), strips `[naizo-strip]` / `[data-naizo-strip]` controls while preserving `[naizo-ignore]` subtrees (`D47`, `EC07`), and inserts `<template naizo-template data-naizo-auto-template="true">` into the list.

- **On future boots:** Because `data-naizo-auto-template` is marked as auto-generated, `naizo.js` regenerates it from the first `[naizo-item]` whenever the list has items—so if you or an AI agent edit the `[naizo-item]` markup in `<body>`, the template automatically picks up your new markup (`EC09`).
- **On `Naizo.exportHTML()` / `Naizo.downloadHTML()`:** If the list currently has $\ge 1$ item, `template[data-naizo-auto-template]` is stripped from the exported HTML to keep the markup clean. If the user deleted every item in the list ($0$ items remaining), `template[data-naizo-auto-template]` is **kept** in the exported HTML so the empty list never loses its item blueprint (`EC09`).

### 2. Explicit Authored Template (`<template naizo-template>`)

When a list may start with $0$ items in `<body>` or requires a specific blank blueprint, include an explicit direct-child `<template naizo-template>` (without `data-naizo-auto-template`):

```html
<div naizo-list="risks">
  <template naizo-template>
    <div class="risk-card" naizo-item>
      <label><input type="text" naizo="summary" placeholder="Risk description..." /></label>
      <label>
        <select naizo="impact">
          <option value="Low" selected>Low</option>
          <option value="High">High</option>
        </select>
      </label>
    </div>
  </template>
</div>
```

Explicitly authored `<template naizo-template>` elements are never overwritten on boot and are always preserved on `Naizo.exportHTML()`.

---

## 8. State Exclusion (`naizo-ignore`) vs. Export Stripping (`naizo-strip`)

Decisions `D12` and `D47` (`EC03`, `EC07`, `EC23`, `EC29`) separate **excluding elements from state binding while keeping them in exported HTML** (`naizo-ignore`) from **stripping runtime or hosted-only elements on export** (`naizo-strip`):

| Attribute                            | Bound to `#naizodb`? | Preserved in Auto-Templates? | Preserved in `exportHTML()` / `downloadHTML()`? | Hidden in `@media print`? | Typical Use Case                                                                                                                                               |
| ------------------------------------ | -------------------- | ---------------------------- | ----------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `naizo-ignore` / `data-naizo-ignore` | **No** (subtree)     | **Yes** (`EC07`)             | **Yes** (`EC07`)                                | No (author controls CSS)  | Search inputs, filter dropdowns, custom JS widgets (`Naizo.get`/`set`), decorative card buttons/modals                                                         |
| `naizo-strip` / `data-naizo-strip`   | **No** (subtree)     | **No** (stripped)            | **No** (stripped, `D47`, `EC03`)                | **Yes** (`EC29`)          | Hosted-only analytics scripts (`<script ... naizo-strip>`), web demo banners, transient overlays, and auto-injected `.naizo-item-tools` / `.naizo-list-footer` |

- Placing `naizo-ignore` or `naizo-strip` on any container excludes both the element itself and all descendants (`el.closest('[naizo-ignore], [data-naizo-ignore], [naizo-strip], [data-naizo-strip]')`, `EC23`) from hydration, initial DOM seeding, and `input`/`change` capture.
- When a visitor exports or downloads a hosted page via **`⬇ Save to PC`** (`Naizo.downloadHTML()` / `Naizo.exportHTML()`), any element with `naizo-strip` or `data-naizo-strip` (such as a web analytics beacon or hosted banner, alongside `#__naizodb_host__`, `#__naizodb_styles__`, and injected list controls) is cleanly removed from the downloaded `.html` file (`D47`).
- When printing a spec or saving to PDF (`Cmd+P` / `Ctrl+P`), `@media print` rules automatically hide the Shadow DOM status pill (`#__naizodb_host__`) and all `[naizo-strip]` / `[data-naizo-strip]` elements (`EC29`).

---

## 9. Programmatic JavaScript API (`window.Naizo`) & Events

`window.Naizo` (aliased as `window.NaizoDB`) exposes the full store and persistence lifecycle (`D14`, `D15`, `D21`, `D40`, `D41`):

### Method Reference (`NaizoAPI`)

| Method                                           | Return Type                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Naizo.init()`                                   | `Promise<void>`                  | Initializes (or re-initializes) `naizo.js`: mounts Shadow DOM pill, infers templates, attaches listeners with `AbortController` cleanup, resolves `#naizodb` vs. `localStorage`, hydrates DOM, and checks IndexedDB `fileHandle`.                                                                                                                                                                                                                         |
| `Naizo.get(key?)`                                | `unknown`                        | Returns `db.custom[key]` when `key` is provided, or the live `NaizoDatabase` (`{ _meta, fields, lists, custom }`) when `key` is omitted.                                                                                                                                                                                                                                                                                                                  |
| `Naizo.set(key, value)`                          | `void`                           | Validates JSON value (`EC35`), deep-clones and stores `db.custom[key]`, dispatches `naizo:change` (`{ scope: 'custom', key, value }`), and flushes persistence.                                                                                                                                                                                                                                                                                           |
| `Naizo.delete(key)`                              | `void`                           | Removes `db.custom[key]` if present, dispatches `naizo:change` (`{ scope: 'custom', action: 'delete', key }`), and flushes persistence.                                                                                                                                                                                                                                                                                                                   |
| `Naizo.getField(key)`                            | `unknown`                        | Returns `db.fields[key]`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Naizo.setField(key, value)`                     | `void`                           | Validates JSON value (`EC35`), sets `db.fields[key]`, updates all bound standalone `[naizo="key"]` elements in the DOM, dispatches `naizo:change` (`{ scope: 'fields', key, value }`), and flushes persistence.                                                                                                                                                                                                                                           |
| `Naizo.deleteField(key)`                         | `void`                           | Deletes `db.fields[key]`, clears bound standalone `[naizo="key"]` DOM elements (`clearElementValue`), dispatches `naizo:change` (`{ scope: 'fields', action: 'delete', key }`), and flushes persistence.                                                                                                                                                                                                                                                  |
| `Naizo.getList(listName)`                        | `Array<Record<string, unknown>>` | Returns `db.lists[listName]` (or `[]` if not found).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Naizo.addItem(listName, itemData?)`             | `void`                           | Validates `itemData` (defaults to `{}`), appends a new `[naizo-item]` DOM node if `[naizo-list]` is present (without stealing focus, `EC31`), pushes to `db.lists[listName]`, and dispatches `naizo:item` and `naizo:change`.                                                                                                                                                                                                                             |
| `Naizo.updateItem(listName, index, partialData)` | `void`                           | Validates `partialData`, shallow-merges its keys into `db.lists[listName][index]` (preserving untouched keys), updates matching bound fields in that row's DOM, dispatches `naizo:change`, and flushes persistence.                                                                                                                                                                                                                                       |
| `Naizo.moveItem(listName, fromIndex, toIndex)`   | `void`                           | Moves the item in `db.lists[listName]` and reorders the corresponding `[naizo-item]` DOM node in place (preserving its `WeakMap` reference), dispatches `naizo:change`, and flushes persistence.                                                                                                                                                                                                                                                          |
| `Naizo.removeItem(listName, index)`              | `void`                           | Removes `db.lists[listName][index]` and its `[naizo-item]` DOM element, dispatches `naizo:change`, and flushes persistence.                                                                                                                                                                                                                                                                                                                               |
| `Naizo.bind(root?)`                              | `void`                           | Hydrates bound elements inside a dynamically inserted DOM subtree (`root` defaults to `document`) from the store without overwriting existing stored values with DOM defaults (`D21`, `EC20`).                                                                                                                                                                                                                                                            |
| `Naizo.save()`                                   | `Promise<boolean>`               | Immediately flushes pending capture to `localStorage` and `#naizodb`, and if a `fileHandle` is linked, awaits the single-flight surgical disk write (`EC36`). Returns `true` when the disk write (or unlinked cache flush) succeeded.                                                                                                                                                                                                                     |
| `Naizo.reset()`                                  | `void`                           | If the store differs from the initial boot baseline (`initialDiskDb`), backs up current state to `naizodb_backup_<key>` (**`↺ Restore`**), resets `store` to `initialDiskDb`, clears `naizodb_state_<key>`, re-hydrates DOM, and emits `naizo:hydrate` + `naizo:change` (`{ scope: 'reset' }`) (`D41`, `EC48`).                                                                                                                                           |
| `Naizo.unlink()`                                 | `Promise<void>`                  | Stops the ~2 s disk watcher, clears the active `fileHandle`, deletes the stored handle from IndexedDB `NaizoDB_Handles`, and returns the status pill to `Browser Cache · Click to Link Disk` (or `Saved in Browser` in Online Mode).                                                                                                                                                                                                                      |
| `Naizo.copyJSON()`                               | `Promise<string>`                | Flushes pending state, writes the 2-space formatted `#naizodb` JSON string to `navigator.clipboard.writeText()` when available, and returns the JSON string (`D27`).                                                                                                                                                                                                                                                                                      |
| `Naizo.exportHTML()`                             | `string`                         | Clones the document, bakes form attributes (`value`, `checked`, `selected`, `open`, `textContent`), restores radio `name` attributes, strips `[naizo-strip]` / `[data-naizo-strip]` and non-empty `data-naizo-auto-template`, and returns `<!DOCTYPE html>\n...`. In Online Mode, also rewrites relative `naizo(.min).js` script tags to `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js` and strips `naizo-mode="online"` (`D41`, `D47`). |
| `Naizo.downloadHTML(filename?)`                  | `string`                         | Generates a portable standalone HTML snapshot (always rewriting relative `naizo(.min).js` script tags to `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js` and stripping `naizo-mode="online"`), triggers a browser `.html` file download (`URL.revokeObjectURL` cleanup), and returns the HTML string (`D41`, `EC48`).                                                                                                                     |

### Custom Window Events (`EC40`)

Listen on `window` to synchronize custom visualizations, charts, counters, or sidebars:

```javascript
// 1. Fired on initial boot, external disk merge, cross-tab storage sync, ↺ Restore, and ↺ Reset
window.addEventListener('naizo:hydrate', (e) => {
  const db = e.detail; // Full NaizoDatabase: { _meta, fields, lists, custom }
  renderCustomDashboard(db);
});

// 2. Fired whenever a bound input changes or Naizo.set / setField / addItem / updateItem / moveItem / removeItem / reset is called
window.addEventListener('naizo:change', (e) => {
  // e.detail: { scope: 'fields' | 'lists' | 'custom' | 'reset' | 'restore', action?, list?, key?, index?, value?, db }
  renderCustomDashboard(e.detail.db);
});

// 3. Fired when a new [naizo-item] DOM element is appended to a list
window.addEventListener('naizo:item', (e) => {
  const { list, item, data, index } = e.detail;
  console.log(`Added row #${index} to ${list}:`, item, data);
});
```

---

## 10. Local Mode vs. Online Mode & Web-to-Local App Exchange

A single `naizo.js` `.html` file adapts automatically depending on whether it is opened as a **local tool** or hosted on a **static web server** (`D40`, `D41`, `EC47`, `EC48`):

### Mode Detection Rules (`isOnlineMode()`)

1. **Explicit attribute override (`naizo-mode` / `data-naizo-mode` on `<html>` or `<body>`):**
   - `naizo-mode="online"` forces **Online Mode** (as long as no `fileHandle` is currently linked).
   - `naizo-mode="local"` forces **Local Mode** (even on an `https://` origin).
   - `naizo-mode="auto"` (or omitted) uses automatic detection below.
2. **Automatic detection:**
   - **Local Mode:** `location.protocol === 'file:'`, or `location.hostname` is `localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`, `*.local`, `*.localhost`, or whenever a local `FileSystemFileHandle` is linked.
   - **Online Mode:** Any remote `http:` or `https:` hostname (such as `https://username.github.io/...` or `https://naizo.js.org/...`) when no `fileHandle` is linked.

### Local Mode vs. Online Mode Behavior Matrix

| Capability / UI Element           | Local Mode (`file://`, `localhost`, or linked file)                                                                                                                                              | Online Mode (Remote `https://` static host, unlinked)                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default Status Pill**           | Amber **`Browser Cache · Click to Link Disk`** until linked; Green **`Synced to Disk`** after `writable.close()` completes (`EC36`).                                                             | Green **`Saved in Browser`** when `localStorage` is active (or Amber **`In-Memory Only`** if storage is blocked).                                                                                                                                                   |
| **Primary Pill Button**           | **`Link Disk`** (or **`Resume Disk Sync`** if handle permission needs re-granting; hidden once actively synced).                                                                                 | **`⬇ Save to PC`** (`Naizo.downloadHTML()`).                                                                                                                                                                                                                        |
| **`⌘S` / `Ctrl+S` Shortcut**      | Suppresses native browser _"Save Webpage, Complete"_ dialog; invokes `Naizo.save()` if granted, or opens `showSaveFilePicker()` / permission prompt directly from the keyboard gesture (`EC47`). | Suppresses native browser save dialog; flushes `localStorage` immediately and flashes **`✓ Saved in Browser`** on the status pill.                                                                                                                                  |
| **Tab Hide / Switch (`Cmd+Tab`)** | Synchronously flushes `localStorage` AND immediately starts `writeToDisk()` if a debounced edit was pending (`M4.5b`, `EC47`).                                                                   | Synchronously flushes `localStorage`.                                                                                                                                                                                                                               |
| **Secondary Reset / Unlink**      | **`× Unlink`** (`Naizo.unlink()`) shown when a `fileHandle` is linked.                                                                                                                           | **`↺ Reset`** (`Naizo.reset()`) shown whenever state differs from the initial published baseline (`initialDiskDb`), guarded by an inline Shadow DOM confirmation popover + backup to **`↺ Restore`**.                                                               |
| **`⬇ Save to PC` Handoff**        | N/A (writes directly in place to the linked `.html` file on disk, or falls back to `.html` download on non-Chromium browsers).                                                                   | Downloads a single `.html` file with baked state, relative `naizo(.min).js` `<script src>` rewritten to `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js`, and `naizo-mode="online"` stripped so it opens in **Local Mode** on the user's PC (`D41`). |

### Status Pill Action Buttons Reference (`#__naizodb_host__`)

The floating bottom-right pill is isolated inside a Shadow DOM root (`#__naizodb_host__`) and surfaces contextual actions:

- **`Link Disk` / `Resume Disk Sync` / `⬇ Save to PC` (`#action`):** Links or resumes the `FileSystemFileHandle` in Local Mode, or downloads a portable `.html` copy in Online Mode.
- **`↺ Restore` / `↺ Repair` (`#restore`):** Appears as **`↺ Restore`** whenever `naizodb_backup_<key>` exists (after an external disk collision or after confirming `↺ Reset`) to restore the backed-up state into `store`, DOM, `localStorage`, and disk; or switches its label to **`↺ Repair`** when startup `<script id="naizodb">` contains invalid JSON (`EC04`), allowing 1-click recovery from the in-memory store.
- **`📋 Copy` (`#copy`):** Calls `Naizo.copyJSON()` to copy the 2-space formatted `#naizodb` JSON to the clipboard and flashes `✓ Copied`. Ideal for pasting state into an AI chat window or when running in Safari/Firefox without `showSaveFilePicker`.
- **`× Unlink` (`#unlink`):** Appears in Local Mode when a `fileHandle` is linked; forgets the persisted handle from IndexedDB (`Naizo.unlink()`).
- **`↺ Reset` (`#reset`):** Appears in Online Mode when the user has made edits (`isDirtyFromInitial()`). Opens the inline `#reset-confirm` popover (`Reset app to initial state?` with **`Reset`** and **`Cancel`**, also dismissible via `Escape`).

---

## 11. Two-Way Disk Sync, Live Watch, & Conflict Resolution

`naizo.js` is built for **real-time Human + AI Agent co-editing** on the same `.html` file (`D13`, `D16`, `D20`, `D24`, `D27`, `D40`):

### 1. Surgical `#naizodb` Disk Writes (`D16`, `D24`, `EC26`, `EC28`)

When a `FileSystemFileHandle` is linked with `'granted'` `readwrite` permission:

- Disk writes are serialized through a **single-flight queue** (`EC26`); edits typed while a write is in flight coalesce into a single follow-up write.
- Before writing, `performSingleDiskWrite()` reads the current file from disk via `await fileHandle.getFile()`:
  - It preserves any leading UTF-8 BOM (`\uFEFF`) using `TextDecoder('utf-8', { ignoreBOM: true })` (`EC28`).
  - If the user accidentally selected a non-empty file that does **not** contain `<script id="naizodb">`, `naizo.js` asks for confirmation via `window.confirm()` before injecting `<script id="naizodb">` after `<head>` (`EC28`).
  - Otherwise, it replaces **only** the inner content of `<script id="naizodb">...</script>` with the `\u003c`-escaped JSON payload and records the snapshot hash from the exact payload written (`EC26`).

### 2. When External Disk Edits Are Checked (`EC10`)

`naizo.js` checks whether the on-disk `<script id="naizodb">` changed externally at four points:

1. **On page boot (`initNaizo()`):** Compares the current `<script id="naizodb">` in the loaded HTML against `naizodb_disk_hash_<key>` in `localStorage`.
2. **Every ~2 seconds while the tab is visible (`startDiskWatch()`):** Polls `(await fileHandle.getFile()).lastModified` (a metadata check) and reads the file only when `lastModified` changes.
3. **On window `focus` and `visibilitychange: visible`:** Immediately checks `fileHandle.getFile()` when you switch back to the browser from your terminal or IDE.
4. **Immediately before every disk write (`performSingleDiskWrite()`):** Prevents a pending browser write from blindly overwriting an AI agent edit that landed on disk moments earlier.

### 3. Compact FNV-1a Snapshot Manifest & 3-Way Shallow Merge (`D16`, `D20`, `EC17`, `EC46`)

Instead of storing a full duplicate copy of `#naizodb` in `localStorage`, `naizodb_disk_hash_<key>` stores a compact FNV-1a hash manifest of the last known disk state (`EC46`):

```text
fnv1a:<rootHash>|{"fields":{"owner":"fnv1a:1a2b3c4d"},"lists":{"tasks":"fnv1a:9c0d1e2f"},"custom":{"theme":"fnv1a:3a4b5c6d"}}
```

When an external disk edit is detected (and the browser also has uncommitted or cached edits), `shallowMergeDatabases()` performs a **3-way shallow top-level key merge** across `fields[k]`, `lists[k]`, and `custom[k]` using the per-key base hashes:

| Key State Since Last Disk Snapshot             | Merge Outcome                                                                                                                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only **Browser** changed `fields.owner`        | **Browser value kept** (and scheduled for disk write-back).                                                                                                                                                                  |
| Only **Disk (AI Agent)** changed `lists.tasks` | **Disk value adopted** into the live DOM and store.                                                                                                                                                                          |
| Both changed **different** top-level keys      | **Both changes survive cleanly** with zero conflict warning.                                                                                                                                                                 |
| Both changed the **same** key (`lists.tasks`)  | **Disk wins** by default, while the pre-merge browser state is saved to `naizodb_backup_<key>` and the status pill shows amber **`External Disk Edit · Conflict Backed Up`** with a 1-click **`↺ Restore`** button (`EC17`). |

**Active-element mid-keystroke guard (`EC10`):** When a live external update hydrates the DOM while you are actively typing inside a bound input (`document.activeElement`), `hydrateSubtreeFromStore()` skips overwriting `document.activeElement` so your cursor position and in-progress keystrokes are never clobbered.

### 4. Multi-Tab Browser Synchronization (`EC27`, `EC47`)

If the same document is open in two tabs of the same browser, `handleStorageEvent()` listens to the HTML5 `window` `'storage'` event:

- When Tab A updates `naizodb_state_<key>`, Tab B merges any uncommitted `150 ms` `persistTimeout` edits via `shallowMergeDatabases()` (using `e.oldValue` as the merge base) and hydrates the DOM.
- When Tab A completes a disk write and updates `naizodb_disk_hash_<key>` with a root hash matching Tab B's store, Tab B automatically updates its disk baseline and transitions its status pill to green **`Synced to Disk`**.

---

## 12. Architectural Recipes (`examples/`)

The [`examples/`](../examples/) directory provides four complete, self-contained single-file HTML applications illustrating progressively richer architectural patterns:

### Recipe 1: Flat Checklist & Release Sign-Off ([`examples/starter.html`](../examples/starter.html) & [`examples/checklist.html`](../examples/checklist.html))

**Use when:** Generating project specs, PR review checklists, bug triage sheets, or release sign-offs with zero custom JavaScript.

- **Structure:** Scalar header fields (`contenteditable="true" naizo="checklist_title"`, `<input naizo="reviewer">`, `<select naizo="environment">`, `<input type="checkbox" naizo="ready_for_release">`) paired with a `[naizo-list="checks"]` repeater.
- **Key pattern:** Every input inside `[naizo-item]` is wrapped in a `<label>` (`EC39`), with `<span class="sr-only">` providing accessible labels for compact row layouts. Zero custom `<script>` code is needed—`naizo.js` handles all state binding, row cloning, `↑ ↓ ×` reordering, and persistence.

### Recipe 2: Filterable Card Grid with Dynamic Per-Item Custom Keys ([`examples/inventory.html`](../examples/inventory.html))

**Use when:** Building asset trackers, issue boards, component catalogs, or CRM views where each card has standard fields plus arbitrary per-card metadata keys (`chip`, `ram`, `renewalDate`, `vram`) and live KPI summaries.

- **Structure:** `[naizo-list="inventory" naizo-no-controls]` renders card items (`[naizo-item]`) with bound inputs (`sku`, `name`, `type`, `status`, `location`, `owner`, `qty`, `unitCost`, `notes`).
- **Key patterns:**
  1. **Pass-through per-card dictionary keys (`D15`):** Each item in `db.lists.inventory` can hold arbitrary extra JSON keys beyond the standard bound inputs. A custom `[naizo-ignore]` area inside each card renders those extra keys as badges and lets users add/delete custom keys via a `<dialog>` modal (`Naizo.updateItem(listName, idx, updatedCard)`).
  2. **Dynamic `<select>` options before hydration (`EC15`):** Because the location filter `<select naizo="filter_location">` populates its `<option>` tags dynamically from the inventory items, `naizo.js` preserves the stored `db.fields.filter_location` value until `syncLocationFilterOptions()` renders the matching `<option>` on `naizo:hydrate`.
  3. **Non-destructive CSS Grid sorting:** Instead of mutating the `db.lists.inventory` array order on every sort change, sorting sets `cardEl.style.order = String(rank)` on the CSS Grid items, keeping array indices stable.

### Recipe 3: Zero-DOM-Wipe Declarative Master–Detail Notebook ([`examples/notes.html`](../examples/notes.html))

**Use when:** Building multi-document workspaces (engineering notebooks, ADR browsers, prompt libraries, multi-tabbed spec editors) with a searchable sidebar list and a rich detail editor pane.

- **Why naive master–detail fails with declarative sync (`D40`):** Imperatively copying strings into a single shared `<textarea>` on every sidebar click bypasses `[naizo-list]`'s `WeakMap` row bindings, breaks `O(1)` input capture, and loses `document.activeElement` protection when an AI agent edits `#naizodb` on disk.
- **The Declarative Master–Detail Pattern:**
  1. **Every note is a live `[naizo-item]` pane inside `<div naizo-list="notes" naizo-no-controls>`:** Each `[naizo-item]` contains its own bound `<input naizo="title">`, `<select naizo="category">`, `<input type="checkbox" naizo="pinned">`, and `<textarea naizo="body">`, plus pass-through `id` and `updatedAt` keys in `#naizodb`.
  2. **CSS toggles which `[naizo-item]` pane is visible:** The currently selected note ID is persisted in `db.custom.activeNoteId` (`Naizo.get('activeNoteId')` / `Naizo.set('activeNoteId', id)`). A lightweight `syncNotebookUi()` listener on `naizo:hydrate` and `naizo:change` toggles `.is-active` (`display: flex` vs. `display: none`) on the matching `[naizo-item]` pane:
     ```css
     .editor-list > [naizo-item] {
       display: none;
     }
     .editor-list > [naizo-item].is-active {
       display: flex;
     }
     ```
  3. **Sidebar index is a `[naizo-ignore]` view over `Naizo.getList('notes')`:** The category filter dropdown (`<select id="category-filter" naizo="category_filter">`) is bound in `db.fields.category_filter`, while the ephemeral search input (`#note-search`) and rendered sidebar list (`<ul id="note-index-list">`) are marked `naizo-ignore` (`EC23`). Clicking a note in the sidebar calls `Naizo.set('activeNoteId', note.id)`, immediately revealing that note's live `[naizo-item]` editor pane with zero DOM destruction.

---

## 13. Lightweight Vanilla UI Patterns (Search/Filter & Tabs)

By design (`D43`), `naizo.js` is a data persistence and synchronization engine (**内蔵** + **内臓**), not a general UI widget framework—it intentionally omits `naizo-filter` and `naizo-tab` directives so you have full control over multi-criteria filtering and layout in a few lines of vanilla HTML/JS.

### Pattern A: Non-Destructive List Search & Filtering (~8 Lines)

> **Critical Rule:** Never remove `[naizo-item]` elements from the DOM to filter a list—removing a `[naizo-item]` deletes its data from `db.lists`. Instead, toggle `row.hidden = !matches` (or a CSS class).

```html
<!-- Use naizo-ignore for ephemeral search, or naizo="search_query" to persist the filter in #naizodb -->
<input id="task-search" type="search" naizo-ignore placeholder="Filter tasks..." />

<div id="task-list" naizo-list="tasks">
  <div class="task-row" naizo-item>
    <label><input type="checkbox" naizo="done" /></label>
    <label><input type="text" naizo="title" /></label>
  </div>
</div>

<script>
  const searchEl = document.getElementById('task-search');
  function applyFilter() {
    const q = searchEl.value.trim().toLowerCase();
    const items = Naizo.getList('tasks');
    document.querySelectorAll('#task-list > [naizo-item]').forEach((row, i) => {
      const title = String(items[i]?.title ?? '').toLowerCase();
      row.hidden = q !== '' && !title.includes(q);
    });
  }
  searchEl.addEventListener('input', applyFilter);
  window.addEventListener('naizo:hydrate', applyFilter);
  window.addEventListener('naizo:change', applyFilter);
</script>
```

### Pattern B: Persisted Tabs & Collapsible Sections

**1. Native Collapsible Sections (Zero JS):** Bind `<details>` directly with `naizo="section_key"` (`EC12`):

```html
<details naizo="architecture_open" open>
  <summary>Architecture &amp; Data Flow</summary>
  <p>
    The open/closed state of this section persists automatically in db.fields.architecture_open.
  </p>
</details>
```

**2. Persisted View Tabs (~8 Lines of JS):** Bind radio inputs (or `<select naizo="active_tab">`) to `db.fields.active_tab` and toggle `[data-tab-panel]` visibility on `naizo:hydrate` and `naizo:change`:

```html
<nav class="tabs">
  <label
    ><input type="radio" name="view_tab" value="board" naizo="active_tab" checked /> Board</label
  >
  <label><input type="radio" name="view_tab" value="metrics" naizo="active_tab" /> Metrics</label>
</nav>

<section data-tab-panel="board">...</section>
<section data-tab-panel="metrics" hidden>...</section>

<script>
  function syncTabs() {
    const active = Naizo.getField('active_tab') || 'board';
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.hidden = panel.getAttribute('data-tab-panel') !== active;
    });
  }
  window.addEventListener('naizo:hydrate', syncTabs);
  window.addEventListener('naizo:change', syncTabs);
</script>
```

---

## 14. Local-First & AI Agent Workflows

### Workflow 1: Step-by-Step `#naizodb` Disk Editing for CLI / IDE AI Agents

When an AI coding agent (Claude Code, Antigravity, Cursor, Gemini CLI, Codex) inspects or updates a `naizo.js` `.html` file on disk:

1. **Read `<script id="naizodb">`:** Locate the `<script id="naizodb" type="application/json">...</script>` block in `<head>` and parse its JSON content. Do **not** scrape `<body>` input attributes to read current data—under surgical disk sync (`D16`), `#naizodb` holds the latest human edits from the browser.
2. **Mutate the JSON buckets:**
   - Update scalar values in `db.fields`.
   - Append, reorder, or update item objects in `db.lists.<listName>` (preserving any existing item keys like `id`).
   - Update custom widget state in `db.custom`.
   - Bump `db._meta.updatedAt = new Date().toISOString()`.
3. **Serialize safely and replace only `<script id="naizodb">`:** Format with `JSON.stringify(db, null, 2).replace(/</g, '\\u003c')` and replace only the `#naizodb` script block in the file. If the human has the `.html` file open and linked in their browser, `naizo.js`'s ~2 s `file.lastModified` watcher detects the write, merges unrelated top-level keys (`fields`, `lists`, `custom`), and updates the live DOM without requiring a page reload.

**One-liner Node.js helper for CLI agents to update `#naizodb` surgically on disk:**

```bash
node -e '
const fs = require("fs");
const file = "plan.html";
const html = fs.readFileSync(file, "utf8");
const re = /(<script\b[^>]*\bid\s*=\s*(?:"naizodb"|\x27naizodb\x27|naizodb(?=[>\s/]))[^>]*>)([\s\S]*?)(<\/script>)/i;
const match = html.match(re);
if (!match) throw new Error("Missing #naizodb block");
const db = JSON.parse(match[2]);

// Modify fields, lists, or custom state:
db.fields.status = "In Review";
db.lists.milestones = db.lists.milestones || [];
db.lists.milestones.push({ done: false, task: "Added by CLI agent on disk", owner: "Agent" });
db._meta = { ...db._meta, updatedAt: new Date().toISOString() };

const json = JSON.stringify(db, null, 2).replace(/</g, "\\u003c");
fs.writeFileSync(file, html.replace(re, (_m, open, _inner, close) => `${open}\n${json}\n${close}`), "utf8");
'
```

### Workflow 2: Cross-Project Symlinked HTML Hub with `<html naizo-id="...">` (`D13`, `EC11`)

When serving multiple local HTML artifacts over `http://localhost` (or opening multiple `index.html` files via `file://`), `naizo.js` derives its `localStorage` and IndexedDB keys from `location.pathname` (normalizing trailing `/index.html` to `/`) plus an optional **document scope ID**:

1. `<html naizo-id="my-project-spec">` (or `data-naizo-id` on `<html>` / `<body>`), or
2. `"_meta": { "id": "my-project-spec" }` inside `#naizodb`.

Resulting storage keys:

- `naizodb_state_<normalizedPath>::<scopeId>` (current cached `NaizoDatabase`)
- `naizodb_disk_hash_<normalizedPath>::<scopeId>` (compact `fnv1a:` disk snapshot manifest)
- `naizodb_backup_<normalizedPath>::<scopeId>` (pre-merge collision or pre-reset backup)
- IndexedDB `NaizoDB_Handles` -> `handles` store -> key `naizodb_state_<normalizedPath>::<scopeId>`

**Tip for multi-repo developer hubs:** Always set a unique `<html naizo-id="repo-name-plan">` (or `_meta.id`) when generating specs or dashboards across projects. You can then symlink project HTML files into a central local folder or serve them on the same `localhost` port without `localStorage` or linked `FileSystemFileHandle` collisions.

### Workflow 3: Single-File Git Tracking with Minimal Surgical Diffs (`D16`)

Because `naizo.js` writes only `<script id="naizodb">` in place (`D16`) and formats JSON with deterministic 2-space indentation, tracking `.html` plans, architecture decision boards, or release checklists directly in Git produces clean, line-by-line JSON diffs:

```diff
       "lists": {
         "checks": [
           {
-            "done": false,
+            "done": true,
             "task": "Verify surgical #naizodb disk writes",
             "priority": "High"
           }
         ]
       }
```

### Workflow 4: One-Command `cat << 'EOF'` Bootstrap

Any developer or CLI AI agent can create and open a self-persisting `naizo.js` app from the terminal in a single command:

```bash
cat << 'EOF' > plan.html
<!doctype html>
<html lang="en" naizo-id="quick-plan">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive Plan</title>
    <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {
          "title": "Implementation Plan",
          "notes": "Press Cmd+S / Ctrl+S to link this file on disk."
        },
        "lists": {
          "tasks": [
            { "done": false, "task": "Review architecture and edge cases" }
          ]
        },
        "custom": {}
      }
    </script>
    <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem 4rem; }
      label { display: block; margin-bottom: 0.75rem; }
      input[type="text"], textarea { width: 100%; padding: 0.5rem; box-sizing: border-box; font: inherit; }
      .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0; }
      .row label:last-of-type { flex: 1; margin: 0; }
    </style>
  </head>
  <body>
    <h1 contenteditable="true" naizo="title">Implementation Plan</h1>
    <label>
      Notes
      <textarea naizo="notes" rows="3"></textarea>
    </label>
    <div naizo-list="tasks">
      <div class="row" naizo-item>
        <label><input type="checkbox" naizo="done" /></label>
        <label><input type="text" naizo="task" placeholder="New task..." /></label>
      </div>
    </div>
  </body>
</html>
EOF
```

### Workflow 5: Equipping AI Coding Agents with [`skills/naizo/SKILL.md`](../skills/naizo/SKILL.md)

Install the distributable [`skills/naizo/SKILL.md`](../skills/naizo/SKILL.md) skill into any workspace via the GitHub CLI (`gh skill`), the npm Skills CLI (`npx skills`), or `curl` / `cp` so Claude Code, Antigravity, Cursor, GitHub Copilot, Gemini CLI, and Codex know how to author `naizo.js` applications and surgically update `#naizodb` on disk:

```bash
# 1. GitHub CLI (gh v2.90+ — installs from the latest published release)
gh skill install nickosh/naizo naizo

# 2. npm Skills CLI (npx skills)
npx skills add nickosh/naizo --skill naizo

# 3. Direct curl / file copy (Antigravity, Cursor, Codex, Gemini CLI / Claude Code)
mkdir -p .agents/skills/naizo && curl -fsSL https://naizo.js.org/SKILL.md -o .agents/skills/naizo/SKILL.md
mkdir -p .claude/skills/naizo && curl -fsSL https://naizo.js.org/SKILL.md -o .claude/skills/naizo/SKILL.md
```

**Experimental / In-Development (`main` Branch):** To test unreleased features from `main` before the next tagged release is cut, pair the in-development `dist/naizo.js` bundle with the `@main` skill (note: `main` is under active development and may contain experimental or not-yet-released changes):

```html
<!-- In-development runtime directly from main (or local ./dist/naizo.js from a main checkout) -->
<script src="https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js" defer></script>
```

```bash
# In-development AI skill from main
gh skill install nickosh/naizo naizo@main
npx skills add nickosh/naizo@main --skill naizo
mkdir -p .agents/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .agents/skills/naizo/SKILL.md
```

### Workflow 6: Interactive Option Explorer & Human Review Loop (`D45`)

When a human and an AI agent need to evaluate design directions, architecture trade-offs, UI copy variants, or configuration options, `naizo.js` enables a zero-friction **Interactive Option Lab** loop:

1. **AI generates a temporary `naizo.js` comparison page** (e.g., `design-lab.html`) binding radio or `<select>` controls (`naizo="direction"`, `naizo="font_body"`, `naizo="measure"`, `naizo="inspector_layout"`) and a free-form feedback `<textarea naizo="design_notes">` to `#naizodb`.
2. **Human explores options interactively in the browser**, picks the winning combination, types concrete review notes into `<textarea naizo="design_notes">`, and presses **`⌘S` / `Ctrl+S`** to surgically persist `#naizodb` to the `.html` file on disk.
3. **AI reads `<script id="naizodb" type="application/json">` directly from disk** on the next turn—receiving both the exact structured option keys (`db.fields.direction`, `db.fields.measure`, etc.) and the human's written notes (`db.fields.design_notes`) without screenshot copy-pasting or ambiguous chat descriptions—applies the chosen direction, and deletes the temporary lab file when done.
