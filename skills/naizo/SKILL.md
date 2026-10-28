---
name: naizo
license: MIT
description: 'Build and update self-persisting interactive HTML applications (dashboards, interactive studios, personal trackers, design option labs, calculators, visual canvases, engineering notebooks, plans, specs, checklists, triage boards, and custom micro-tools) using naizo.js and its built-in #naizodb JSON database. Activate whenever generating an interactive HTML application or inspecting/editing an existing HTML file that uses <script id="naizodb" type="application/json"> or naizo / data-naizo attributes.'
---

# Naizo (`naizo.js`) — Self-Persisting HTML & AI Agent Co-Editing Skill

Use **`naizo.js`** (npm package `naizojs`) to turn any single `.html` file into a living, self-persisting application whose state syncs between the browser DOM, `localStorage`, and `<script id="naizodb" type="application/json">` on disk.

In Japanese, **_naizō_ (ないぞう)** means both **内蔵 (_built-in / housed within_)** and **内臓 (_internal organs_)**: `<script id="naizodb">` is the built-in JSON database inside `<head>`, and `naizo.js` provides the reactive internal organs that bind inputs, repeat lists, and sync human browser edits with AI agent disk edits.

---

## 1. Golden Rules for AI Agents (Never Violate)

1. **`<body>` is the template; `<script id="naizodb">` is the canonical data:**
   - When linked to a local file via the File System Access API (`⌘S` / `Ctrl+S` or `Link Disk`), `naizo.js` surgically rewrites **only** the `<script id="naizodb">...</script>` block on disk (`D16`). It does **not** rewrite `<body>` markup on disk during normal saves.
   - **To read human edits from disk:** Always parse `<script id="naizodb" type="application/json">` in `<head>`. Never scrape `<body>` input `value` or `checked` attributes to read current state.
   - **To update data on disk:** Modify the JSON inside `<script id="naizodb">` (formatted with 2-space indentation and `<` escaped as `\u003c`). If the user has the file open and linked in their browser, `naizo.js` detects `file.lastModified` within ~2 seconds and merges your changes into the live page without clobbering `document.activeElement`.
   - **To update the UI or layout:** Edit the HTML/CSS inside `<body>` (and add matching initial keys to `#naizodb` if needed).
2. **Preserve pass-through keys (`D15`, `EC14`):**
   - `naizo.js` maintains an in-memory `NaizoDatabase` store and maps each rendered `[naizo-item]` DOM row to its source object via a `WeakMap`.
   - Unbound keys in `fields`, unbound arrays in `lists`, and extra properties on list item objects (such as `"id"`, `"estimate"`, `"updatedAt"`, or custom per-card dictionary keys) pass through untouched. When editing `#naizodb` on disk, always preserve existing keys you did not intend to remove.
3. **Explicit binding only (`D08`, `D12`, `EC11`, `EC49`):**
   - Bind elements exclusively with `naizo="key"` or `data-naizo="key"`. Unannotated inputs (like search bars or filter dropdowns) are never implicitly captured, and `id` or `name` attributes are never used as fallback binding keys.
4. **Wrap `<label>` around inputs inside `[naizo-item]` (`EC39`):**
   - Never use `<label for="some-id">` + `<input id="some-id">` inside a repeating `[naizo-item]`, because cloned rows would share duplicate DOM `id` attributes. Always wrap `<label>` directly around the control (`<label><input type="checkbox" naizo="done" /><span>Done</span></label>`).
5. **Scope documents with `<html naizo-id="...">` (`D13`, `EC11`):**
   - Add a descriptive `naizo-id="project-artifact-slug"` on `<html>` (or `"_meta": { "id": "..." }`) so `localStorage` caches and IndexedDB file handles never collide when multiple HTML tools are opened on `localhost` or `file://`.
6. **Never filter `[naizo-item]` rows by removing them from the DOM (`D43`):**
   - Removing a `[naizo-item]` node deletes its object from `db.lists`. For search or category filtering, toggle `row.hidden = !matches` (or CSS `display: none`).

---

## 2. Core HTML Structure & `#naizodb` Schema

Every `naizo.js` HTML document embeds `<script id="naizodb" type="application/json">` at the top of `<head>` followed by `naizo.js`:

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
    <!-- 3. Declarative bindings in <body> -->
  </body>
</html>
```

### CDN & Local Script Options (`D17`, `D34`, `D39`)

- **jsDelivr (readable):** `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js`
- **jsDelivr (minified, ~12.3 KB gzipped):** `https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js`
- **unpkg:** `https://unpkg.com/naizojs@latest/dist/naizo.js`
- **Pinned version:** replace `@latest` with a specific published version tag
- **Local / offline:** `<script src="./dist/naizo.js" defer></script>` (inside the `naizo` repository examples, use `../dist/naizo.js`)
- **Experimental / in-development (`main` branch `dist/naizo.js`):** `https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js` (unreleased; pair with the `@main` skill below)

---

## 3. Declarative HTML Attributes (`naizo` / `data-naizo`)

Both short `naizo` / `naizo-*` attributes and HTML5 `data-naizo` / `data-naizo-*` aliases are supported everywhere (`D08`):

| Short Attribute                    | HTML5 `data-*` Alias                    | Placement                                                                                              | Behavior                                                                                                                                       |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`                      | `data-naizo="key"`                      | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf element, or `[naizo-item]` | Binds to `db.fields["key"]` when standalone, or to `item["key"]` when inside or on a `[naizo-item]`.                                           |
| `naizo-list="name"`                | `data-naizo-list="name"`                | Container (`<div>`, `<ul>`, `<ol>`, `<tbody>`, `<table>`)                                              | Binds direct `[naizo-item]` children to `db.lists["name"]` and injects `+ Add Item` below the list unless `naizo-no-controls` is present.      |
| `naizo-item`                       | `data-naizo-item`                       | Direct child of `[naizo-list]` (`<div>`, `<li>`, `<tr>`, etc.)                                         | Marks a repeating row/card; injects hover `↑` `↓` `×` toolbar unless `naizo-no-controls` is set on the list.                                   |
| `naizo-template`                   | `data-naizo-template`                   | Direct child `<template>` inside `[naizo-list]`                                                        | Optional explicit blueprint for new items. If omitted, `naizo.js` auto-infers `data-naizo-auto-template="true"` from the first `[naizo-item]`. |
| `naizo-add="name"`                 | `data-naizo-add="name"`                 | `<button>` (anywhere in document)                                                                      | Appends a new blank item to `[naizo-list="name"]` and focuses its first text field (`EC31`).                                                   |
| `naizo-remove`                     | `data-naizo-remove`                     | `<button>` inside `[naizo-item]`                                                                       | Deletes the enclosing `[naizo-item]` from DOM and `db.lists`.                                                                                  |
| `naizo-move="up\|down"`            | `data-naizo-move="up\|down"`            | `<button>` inside `[naizo-item]`                                                                       | Moves the enclosing `[naizo-item]` up or down in DOM and `db.lists`.                                                                           |
| `naizo-no-controls`                | `data-naizo-no-controls`                | `[naizo-list]`                                                                                         | Suppresses auto-injected `↑ ↓ ×` and `+ Add Item` buttons so you can use custom buttons or modals.                                             |
| `naizo-ignore`                     | `data-naizo-ignore`                     | Any element                                                                                            | Excludes the element and its subtree from state binding while preserving it in auto-templates and exported HTML (`D12`, `EC07`).               |
| `naizo-id="scope"`                 | `data-naizo-id="scope"`                 | `<html>` or `<body>`                                                                                   | Scopes `localStorage` and IndexedDB keys (`<path>::<scope>`) to avoid collisions on `localhost`.                                               |
| `naizo-mode="online\|local\|auto"` | `data-naizo-mode="online\|local\|auto"` | `<html>` or `<body>`                                                                                   | Overrides automatic Local Mode vs. Online Mode detection (`D41`, `EC48`).                                                                      |
| `naizo-manual`                     | `data-naizo-manual`                     | `<html>`, `<body>`, or `<script>`                                                                      | Disables automatic `initNaizo()` boot when loading the browser IIFE bundle.                                                                    |

### Scalar Element Coercion & Safety Rules (`D14`, `D22`, `EC12`, `EC15`, `EC18`, `EC21`, `EC25`)

- **Text inputs & `<textarea>`:** `string` (`.value`), preserving stored numbers/booleans when the string representation is unchanged (`EC25`).
- **`<input type="number">` & `<input type="range">`:** finite `number` or `null` when empty (`EC12`).
- **`<input type="checkbox">`:** `boolean` (`.checked`), coercing `"false"`, `"0"`, `""`, `"no"`, and `"off"` to `false` (`EC25`).
- **`<input type="radio">`:** `string` value of the checked radio; inside `[naizo-item]`, radio `name` attributes are automatically scoped per row and restored on export (`EC13`).
- **`<select>` & `<select multiple>`:** `string` or `string[]`. If `#naizodb` contains a value with no matching `<option>` yet, `naizo.js` logs a warning and preserves the stored value in memory instead of overwriting it with `""` (`EC15`).
- **`<details naizo="key">`:** `boolean` (`open` state via capture-phase `toggle` listener, `EC12`).
- **`[contenteditable]` (`""`, `"true"`, `"plaintext-only"`):** plain text via `textContent` (`D22`, `EC18` — never `innerHTML`).
- **Self-bound `[naizo-item]`:** `<li naizo-item contenteditable="true" naizo="text">` binds the item root directly while isolating `textContent` from injected `.naizo-item-tools` (`EC46`).
- **Tables (`<tbody naizo-list>` / `<tr naizo-item>`):** `.naizo-item-tools` is placed inside the last `<td>`/`<th>` of each row and `.naizo-list-footer` is placed immediately after `<table>` (`EC13`).
- **Skipped inputs (`EC21`):** `password`, `file`, `button`, `submit`, `reset`, and `image` are always skipped.

---

## 4. Programmatic API (`window.Naizo` / `window.NaizoDB`) & Events

```javascript
// 1. Custom JSON State (db.custom)
const activeId = Naizo.get('activeNoteId'); // Omit key to get full NaizoDatabase
Naizo.set('activeNoteId', 'note-102'); // Validates finite JSON value (EC35)
Naizo.delete('obsoleteKey');

// 2. Standalone Fields (db.fields)
const status = Naizo.getField('status');
Naizo.setField('status', 'Approved'); // Updates db.fields.status + all bound [naizo="status"] DOM nodes
Naizo.deleteField('legacyField'); // Deletes key + clears bound DOM inputs

// 3. Lists (db.lists)
const items = Naizo.getList('tasks');
Naizo.addItem('tasks', { id: 't-2', done: false, task: 'New task', priority: 'Med' });
Naizo.updateItem('tasks', 0, { done: true }); // Shallow-merges into item 0, preserving extra keys
Naizo.moveItem('tasks', 2, 0);
Naizo.removeItem('tasks', 1);

// 4. Dynamic Subtrees, Persistence, Reset, & Export
Naizo.bind(containerEl); // Hydrate dynamically inserted DOM from store
const ok = await Naizo.save(); // Flush cache + await single-flight disk write (Promise<boolean>)
Naizo.reset(); // Back up dirty state to ↺ Restore and reset to initial boot baseline
await Naizo.unlink(); // Forget linked FileSystemFileHandle
const json = await Naizo.copyJSON(); // Copy 2-space #naizodb JSON to clipboard
const html = Naizo.exportHTML(); // Clean HTML snapshot with baked attributes & stripped runtime UI
const dlHtml = Naizo.downloadHTML('app.html'); // Download portable HTML with CDN script URL

// 5. Window Lifecycle & Mutation Events
window.addEventListener('naizo:hydrate', (e) => {
  // Fired on boot, external disk merge, cross-tab storage sync, ↺ Restore, and ↺ Reset
  console.log('Hydrated store:', e.detail);
});
window.addEventListener('naizo:change', (e) => {
  // e.detail: { scope: 'fields' | 'lists' | 'custom' | 'reset' | 'restore', action?, list?, key?, index?, value?, db }
  console.log('Changed:', e.detail);
});
window.addEventListener('naizo:item', (e) => {
  // e.detail: { list, item, data, index }
  console.log('New list row:', e.detail);
});
```

---

## 5. Canonical Application Blueprints

Choose the blueprint that best matches the user's request (full templates live in `examples/starter.html`, `examples/checklist.html`, `examples/notes.html`, and `examples/inventory.html` in the `naizo` repository):

### Blueprint A: Project Spec & Milestones (`starter.html`) / Release Checklist (`checklist.html`)

Use for implementation plans, PR review checklists, bug triage sheets, and release sign-offs. Needs **zero custom JavaScript**:

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
          <option value="High">High</option>
          <option value="Med">Med</option>
          <option value="Low">Low</option>
        </select>
      </label>
    </div>
  </div>
</section>
```

### Blueprint B: Zero-DOM-Wipe Master–Detail Workspace (`notes.html`, `D40`)

Use for multi-note engineering notebooks, ADR explorers, prompt libraries, or multi-document editors with a sidebar list and active editor pane.

- **Key architectural rule:** Never wipe and copy note text into a single shared `<textarea>`. Instead, render every note as a live `[naizo-item]` inside `<div naizo-list="notes" naizo-no-controls>`, store the selected ID in `db.custom.activeNoteId`, and toggle `.is-active` (`display: flex` vs. `display: none`) on the matching `[naizo-item]` pane via CSS:

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

<!-- Sidebar index (persisted category filter; ephemeral search and rendered list excluded via naizo-ignore) -->
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

<!-- Declarative [naizo-list] where each [naizo-item] is a full editor pane -->
<main naizo-list="notes" naizo-no-controls>
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
</main>

<script>
  let syncing = false;
  function syncNotebookUi() {
    if (syncing) return;
    syncing = true;
    try {
      const notes = Naizo.getList('notes');
      const activeId = Naizo.get('activeNoteId') || notes[0]?.id;
      const panes = document.querySelectorAll('[naizo-list="notes"] > [naizo-item]');
      panes.forEach((pane, idx) => {
        pane.classList.toggle('is-active', notes[idx]?.id === activeId);
      });
      // Render clickable sidebar items into #note-sidebar-list that call Naizo.set('activeNoteId', note.id)
    } finally {
      syncing = false;
    }
  }
  document.getElementById('new-note-btn').addEventListener('click', () => {
    const id = 'note-' + Date.now();
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
  window.addEventListener('naizo:hydrate', syncNotebookUi);
  window.addEventListener('naizo:change', syncNotebookUi);
</script>
```

### Blueprint C: Filterable Card Grid with Per-Item Custom Keys (`inventory.html`, `D15`)

Use for asset trackers, issue boards, or component catalogs where cards have standard bound fields plus arbitrary custom key-value properties:

- Bind standard card fields (`sku`, `name`, `status`, `location`, `qty`, `unitCost`, `notes`) inside `<div naizo-list="inventory" naizo-no-controls>`.
- Store arbitrary custom metadata keys directly on each item object in `db.lists.inventory[i]` (assigning keys via `Object.defineProperty` / `Naizo.updateItem('inventory', index, partial)` so even keys like `__proto__` are safe, `EC38`).
- Render a `[naizo-ignore]` badge container inside each `[naizo-item]` card to display and edit those pass-through keys.
- Use CSS Grid `cardEl.style.order = String(rank)` for non-destructive sorting without mutating array indices.

### Blueprint D: Lightweight Vanilla Search/Filter & Persisted Tabs (`D43`)

**Non-destructive list search (`row.hidden`):**

```javascript
function applyFilter() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  const rows = document.querySelectorAll('[naizo-list="tasks"] > [naizo-item]');
  const items = Naizo.getList('tasks');
  rows.forEach((row, i) => {
    const text = JSON.stringify(items[i] ?? {}).toLowerCase();
    row.hidden = q !== '' && !text.includes(q);
  });
}
document.getElementById('search-input').addEventListener('input', applyFilter);
window.addEventListener('naizo:hydrate', applyFilter);
window.addEventListener('naizo:change', applyFilter);
```

**Persisted collapsible sections & tabs:**

- For collapsible sections, bind `<details naizo="section_open" open>` directly (zero JS required).
- For view tabs, bind radio buttons `<input type="radio" name="tab" value="overview" naizo="active_tab" checked>` and toggle `panel.hidden = panel.dataset.tab !== (Naizo.getField('active_tab') || 'overview')` on `naizo:hydrate` and `naizo:change`.

### Blueprint E: Interactive Option Lab & Human Review Prototype (`D45`)

When helping a user compare design directions, layout options, architecture trade-offs, or copy variants, generate a self-persisting `naizo.js` comparison page (`design-lab.html`):

- Bind option controls (`<input type="radio" name="direction" value="washi" naizo="direction">`, `<select naizo="measure">`, `<select naizo="inspector_layout">`) and a review notes `<textarea naizo="design_notes" rows="4">` to `#naizodb`.
- Listen to `naizo:hydrate` and `naizo:change` to switch live preview styles or layout attributes (`document.documentElement.dataset.direction = Naizo.getField('direction')`) in real time.
- Ask the user to explore the options in their browser, write feedback in the notes box, and press **`⌘S` / `Ctrl+S`** to save to disk. On the next turn, read `<script id="naizodb" type="application/json">` directly from disk to apply their exact selected options and written notes.

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

1. Read the file and extract the JSON inside `<script id="naizodb" type="application/json">...</script>`.
2. Parse the JSON and update `db.fields`, `db.lists`, or `db.custom` while keeping untouched keys intact.
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

## 8. Installing This Skill in Your Workspace

To equip Claude Code, Antigravity, Cursor, GitHub Copilot, Gemini CLI, or Codex with this skill in any repository, install it via the GitHub CLI (`gh skill`), the npm Skills CLI (`npx skills`), or `curl`:

```bash
# 1. GitHub CLI (gh v2.90+ — installs from the latest published release)
gh skill install nickosh/naizo naizo

# 2. npm Skills CLI (npx skills)
npx skills add nickosh/naizo --skill naizo

# 3. Direct curl / file copy (no CLI required)
mkdir -p .agents/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .agents/skills/naizo/SKILL.md
mkdir -p .claude/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .claude/skills/naizo/SKILL.md
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
```
