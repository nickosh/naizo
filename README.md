<div align="center">

# `naizo.js`

**The Built-In Engine for Self-Persisting HTML & AI Agent Workflows**

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Bundle Size](https://img.shields.io/badge/min%2Bgzip-~10.8_KB-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

_Turn static HTML files into self-saving apps with built-in JSON state (`#naizodb`) for Human + AI workflows._

[Quick Start](#quick-start) · [Starter Examples](#starter-examples) · [AI Agent Skill](#ai-agent-skill-skillsnaizoskillmd) · [Attributes](#declarative-html-attributes) · [JS API](#javascript-api-windownaizo--windownaizodb) · [Full Usage Guide](docs/USAGE.md)

</div>

---

## Why **_Naizo_**?

In Japanese, **_naizō_ (ないぞう)** carries two homophonous meanings—both of which capture what `naizo.js` does for HTML:

- **内蔵 (_naizō_ — built-in / embedded / housed within):** Every `.html` artifact houses its own canonical JSON micro-database (`<script id="naizodb" type="application/json">`) right inside `<head>`. No external server, no separate `.json` sidecar, and no state trapped exclusively in browser storage—everything is **built-in** to the single file.
- **内臓 (_naizō_ — internal organs / viscera):** Plain HTML markup is only a static skeleton. `naizo.js` supplies the **vital internal organs** inside the document—reactive field bindings, a dynamic list repeater, and a two-way disk circulatory system—turning inert `.html` files into living, breathing applications shared between humans in the browser and AI agents on disk.

---

## The Problem `naizo.js` Solves

AI coding agents (like Claude Code, Cursor, Antigravity, Codex, and Gemini CLI) are shifting from plain Markdown to **rich HTML artifacts** for specs, implementation plans, interactive checklists, code reviews, and custom triage tools.

HTML is far more expressive than Markdown—until a human wants to interact with it:

1. **Static HTML is a lifeless skeleton:** Checking boxes, typing notes, or adding tasks in a local `.html` file disappears the moment you refresh the tab.
2. **Browser storage hides edits from AI agents:** Saving state to `localStorage` keeps it trapped inside your browser profile. When your CLI or IDE AI agent reads `plan.html` from disk on the next turn, it is completely blind to your changes.

**`naizo.js`** gives HTML both **内蔵 (built-in storage)** and **内臓 (living internal organs)** with a single `<script>` tag:

- **`<script id="naizodb" type="application/json">` — 内蔵 (_Built-In Memory_):** The embedded JSON micro-database living right inside `<head>`, directly readable and writable by AI agents on disk and cleanly diffable in Git.
- **`naizo.js` — 内臓 (_Vital Organs_):** The tiny reactive engine that binds your HTML inputs and dynamic lists (`naizo="key"`, `naizo-list="tasks"`) and keeps **Human edits in the browser** and **AI Agent edits on disk** in two-way sync without a backend server.

---

## Inspiration

`naizo.js` grew out of two ideas:

- **[The Unreasonable Effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/):** At first, replacing Markdown with HTML felt backwards — raw HTML is noisy to read and tedious to edit by hand, whereas Markdown makes jotting down quick notes effortless. The real friction with HTML wasn't rendering it; it was **persisting edits** without hand-editing tags or asking an AI agent for every small tweak. That sparked the core idea: _what if a self-contained HTML file could save its own state and act like a lightweight app?_
- **[htmx](https://htmx.org/):** Proof that a tiny, flexible library — just one `<script>` tag and a few declarative attributes — can give plain HTML superpowers. Where `htmx` connects HTML to backends, `naizo.js` turns HTML into a self-persisting document synced between your browser and AI agents on disk.

---

## Quick Start

You don't need Node.js, a bundler, or a local server to use `naizo.js`. All you need is an `.html` file and a browser.

### 1. Create an `.html` file

Save the following as `plan.html` on your computer (or copy any template from [`examples/`](examples/)):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My Project Plan</title>

    <!-- 1. Built-in JSON database (#naizodb) -->
    <script id="naizodb" type="application/json">
      {
        "_meta": {},
        "fields": {
          "title": "Launch Plan",
          "notes": "Outline key milestones and open questions."
        },
        "lists": {
          "tasks": [
            { "done": true, "task": "Draft initial specification" },
            { "done": false, "task": "Review edge cases with the team" }
          ]
        },
        "custom": {}
      }
    </script>

    <!-- 2. Load naizo.js -->
    <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
  </head>
  <body>
    <!-- 3. Bind fields with naizo="key" and repeating lists with naizo-list="name" -->
    <h1 contenteditable="true" naizo="title">Launch Plan</h1>

    <label>
      Notes
      <textarea naizo="notes" rows="3"></textarea>
    </label>

    <div naizo-list="tasks">
      <div naizo-item>
        <label><input type="checkbox" naizo="done" /></label>
        <label><input type="text" naizo="task" placeholder="Describe task..." /></label>
      </div>
    </div>
  </body>
</html>
```

### 2. Open it in your browser and press `⌘S` (or `Ctrl+S`)

1. **Open `plan.html` in your browser** by double-clicking it in Finder / File Explorer.
2. **Start editing:** Click the heading to rename it, type in the notes box, or hover over a task to reorder (`↑` `↓`), delete (`×`), or click **`+ Add Item`**. Every change is cached in your browser immediately.
3. **Link the file on disk:** Press **`⌘S`** on macOS or **`Ctrl+S`** on Windows/Linux (or click **`Link Disk`** on the status pill in the bottom-right corner) and select `plan.html`.
4. **Auto-saved to disk:** Once linked, the status pill turns green (**`Synced to Disk`**). Every edit you make in the browser is now saved directly back into `plan.html` on your hard drive—and automatically flushes to disk the moment you switch tabs.

> **Browser note:** Direct in-place disk saving uses the File System Access API (`showSaveFilePicker`), supported in Chrome, Edge, Brave, and Arc. In Safari and Firefox, your edits persist automatically in `localStorage`, and you can click **`📋 Copy`** on the pill to copy the `#naizodb` JSON or click the pill to download an updated `.html` file.

### 3. Co-edit with your AI Agent (or any text editor)

1. Point your AI coding agent (or text editor) at `plan.html`.
2. All of your browser edits are waiting inside `<script id="naizodb">` at the top of `<head>` as clean, 2-space indented JSON.
3. Ask your AI agent to check off completed tasks, add new items, or update fields in `#naizodb`—or ask it to redesign the HTML/CSS in `<body>`.
4. Whenever the file on disk is updated while your browser tab is open, `naizo.js` detects the change within ~2 seconds and merges the new data into your live page without interrupting what you're typing.

### Ways to Load `naizo.js`

```html
<!-- jsDelivr CDN (readable bundle) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>

<!-- unpkg CDN (readable bundle) -->
<script src="https://unpkg.com/naizojs@latest/dist/naizo.js" defer></script>

<!-- Prebuilt minified bundle (~10.8 KB gzipped, works on either CDN) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js" defer></script>

<!-- Offline / local copy -->
<script src="./dist/naizo.js" defer></script>
```

Both CDNs serve the published `naizojs` npm package (`@latest` follows new releases automatically; replace `@latest` with an exact version such as `@0.1.0` to pin a fixed version). See the [Usage Reference](docs/USAGE.md) for complete authoring patterns and the [Publishing Guide](docs/PUBLISHING.md#cdn-urls-and-automatic-updates) for CDN caching details.

---

## Starter Examples

Copy any of the self-contained single-file apps in [`examples/`](examples/) to jump-start your own tools:

| Template                                                 | What It Demonstrates                                                                                                                                                                                                                                                                      |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`examples/starter.html`](examples/starter.html)**     | **Project Spec & Milestones** — Minimal spec sheet with an editable heading, owner and status fields, summary textarea, and repeating milestone checklist.                                                                                                                                |
| **[`examples/checklist.html`](examples/checklist.html)** | **Release Verification Checklist** — Pre-release sign-off sheet with reviewer metadata, environment dropdown, release readiness toggle, prioritized verification items, and blocker notes.                                                                                                |
| **[`examples/notes.html`](examples/notes.html)**         | **Master–Detail Engineering Notebook** — Multi-note workspace built declaratively on `[naizo-list="notes"]` with sidebar search & category filters, note pinning, live character/word/task (`- [ ]`) counters, `Alt+N` / `Alt+↑/↓` keyboard navigation, and Light/Dark theme persistence. |
| **[`examples/inventory.html`](examples/inventory.html)** | **Asset & Inventory Studio** — Filterable card grid with custom per-card JSON key-value badges, `<dialog>` creation/property modals, dynamic location filter options, live KPI summaries, and non-destructive sorting.                                                                    |

---

## AI Agent Skill (`skills/naizo/SKILL.md`)

Want your AI coding agent (Claude Code, Antigravity, Cursor, Gemini CLI, or Codex) to automatically generate self-saving `naizo.js` HTML apps and co-edit `#naizodb` on disk? Copy [`skills/naizo/SKILL.md`](skills/naizo/SKILL.md) into your project's skills folder:

```bash
# Antigravity, Cursor, Codex, Gemini CLI
mkdir -p .agents/skills/naizo
curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .agents/skills/naizo/SKILL.md

# Claude Code
mkdir -p .claude/skills/naizo
curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .claude/skills/naizo/SKILL.md
```

---

## Local Mode vs. Online Mode (`⬇ Save to PC`)

A single `naizo.js` HTML file adapts automatically depending on where it is opened:

- **Local Mode (`file://`, `localhost`, or linked disk file):** Designed for local human + AI agent collaboration. The status pill prompts **`Click to Link Disk`** (or press **`⌘S` / `Ctrl+S`**) and turns green (**`Synced to Disk`**) once linked, watching the local file every ~2 seconds for external AI agent edits.
- **Online Mode (GitHub Pages or any `https://` static web host):** When hosted online where no server file write is possible, `naizo.js` automatically switches to **Online Mode**:
  - The status pill shows green **`Saved in Browser`** (persisting each visitor's edits in `localStorage`).
  - Once a visitor makes edits, a **`↺ Reset`** button (with a safe inline confirmation popover and **`↺ Restore`** backup) lets them reset the demo back to its initial published state anytime.
  - Clicking **`⬇ Save to PC`** (`Naizo.downloadHTML()`) downloads a portable `.html` file containing the visitor's current data and a CDN `<script src>`. Opening that downloaded file on their computer boots straight into **Local Mode** at the exact state they had on the web.

---

## Declarative HTML Attributes

`naizo.js` supports both concise **`naizo` / `naizo-*`** attributes (recommended for low token overhead) and HTML5-compliant **`data-naizo` / `data-naizo-*`** attributes (for strict HTML validators):

| Short Attribute                    | HTML5 `data-*` Alias                    | Target Element                                                              | Description                                                                                                                     |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`                      | `data-naizo="key"`                      | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf | Binds the element's state to `fields["key"]` (or to the item's `"key"` property when on or inside a `[naizo-item]`).            |
| `naizo-list="name"`                | `data-naizo-list="name"`                | Container (`<div>`, `<ul>`, `<tbody>`)                                      | Declares a repeating list bound to `lists["name"]` in `#naizodb`. Automatically injects a `+ Add Item` button below the list.   |
| `naizo-item`                       | `data-naizo-item`                       | Child of `[naizo-list]`                                                     | Marks a repeating item row or card. Automatically receives hover `↑` `↓` `×` controls.                                          |
| `naizo-template`                   | `data-naizo-template`                   | `<template>` inside `[naizo-list]`                                          | Optional explicit HTML blueprint for new items. Auto-generated (`data-naizo-auto-template`) from the first item if omitted.     |
| `naizo-add="name"`                 | `data-naizo-add="name"`                 | `<button>`                                                                  | Appends a new blank item to `[naizo-list="name"]` and focuses its first text field.                                             |
| `naizo-remove`                     | `data-naizo-remove`                     | `<button>` inside `[naizo-item]`                                            | Removes the enclosing `[naizo-item]`.                                                                                           |
| `naizo-move="up\|down"`            | `data-naizo-move="up\|down"`            | `<button>` inside `[naizo-item]`                                            | Moves the enclosing `[naizo-item]` up or down.                                                                                  |
| `naizo-no-controls`                | `data-naizo-no-controls`                | `[naizo-list]`                                                              | Disables automatic injection of `+ Add Item` and `↑` `↓` `×` buttons for that list.                                             |
| `naizo-ignore`                     | `data-naizo-ignore`                     | Any HTML element                                                            | Excludes the element and its subtree from state binding while preserving it in exported HTML.                                   |
| `naizo-id="scope"`                 | `data-naizo-id="scope"`                 | `<html>` or `<body>`                                                        | Optional document scope identifier to isolate `localStorage` and IndexedDB file handles on `localhost`.                         |
| `naizo-mode="online\|local\|auto"` | `data-naizo-mode="online\|local\|auto"` | `<html>` or `<body>`                                                        | Overrides automatic Local Mode (`file:`, `localhost`) vs. Online Mode (remote `http(s):` host with `⬇ Save to PC` & `↺ Reset`). |
| `naizo-manual`                     | `data-naizo-manual`                     | `<html>`, `<body>`, or `<script>`                                           | Opts out of automatic `initNaizo()` boot when loading the browser IIFE bundle so you can call `Naizo.init()` manually.          |

---

## JavaScript API (`window.Naizo` / `window.NaizoDB`)

For custom widgets, charts, filters, or programmatic updates, use `window.Naizo` (see [docs/USAGE.md](docs/USAGE.md) for the complete API and event guide):

```javascript
// Custom State Namespace (db.custom)
const rps = Naizo.get('rateLimitRps');
Naizo.set('rateLimitRps', 250);
Naizo.delete('obsoleteCustomKey');

// Standalone Fields Namespace (db.fields)
const owner = Naizo.getField('owner');
Naizo.setField('owner', 'Kenji');
Naizo.deleteField('obsoleteFlag');

// Programmatic List Manipulation (db.lists)
const tasks = Naizo.getList('tasks');
Naizo.addItem('tasks', { done: false, title: 'Write unit tests', priority: 'High' });
Naizo.updateItem('tasks', 0, { done: true });
Naizo.moveItem('tasks', 2, 0);
Naizo.removeItem('tasks', 1);

// Dynamic Subtree Binding & Persistence Utilities
Naizo.bind(document.getElementById('dynamic-panel')); // Hydrate dynamically mounted DOM
await Naizo.save(); // Flush cache and await single-flight disk write (Promise<boolean>)
Naizo.reset(); // Back up current state to ↺ Restore and reset to initial baseline state
await Naizo.unlink(); // Forget linked FileSystemFileHandle
const json = await Naizo.copyJSON(); // Copy #naizodb JSON to clipboard and return string
const html = Naizo.exportHTML(); // Return clean HTML snapshot with baked attributes
const portableHtml = Naizo.downloadHTML('my-app.html'); // Download portable HTML snapshot with CDN script URL

// Lifecycle & Mutation Events
window.addEventListener('naizo:hydrate', (e) => console.log('Hydrated store:', e.detail));
window.addEventListener('naizo:change', (e) => console.log('State changed:', e.detail));
window.addEventListener('naizo:item', (e) => console.log('New list row:', e.detail));
```

---

## How Disk Sync & Conflict Resolution Work

1. **Body is the template, `#naizodb` is the data:** When linked to a local file (`showSaveFilePicker`), `naizo.js` surgically updates only the `<script id="naizodb">` block in place (`\u003c`-escaped, UTF-8 BOM preserved) so third-party runtime DOM mutations (Tailwind Play CDN, Lucide, Mermaid) never pollute the file on disk and Git diffs show only clean JSON data changes. Edit `#naizodb` to change data; edit `<body>` markup to change the view.
2. **Pass-through keys:** Unbound fields in `db.fields`, unbound lists in `db.lists`, and extra keys on list item objects (such as agent-authored `id`, `estimate`, or custom card properties) pass through untouched in memory and on save.
3. **Live ~2 s watch, `⌘S` / `Ctrl+S` shortcut, & shallow 3-way merge:** Pressing `⌘S` / `Ctrl+S` suppresses the browser's broken webpage save dialog and immediately links or flushes `#naizodb` to disk (and switching tabs flushes pending edits automatically). While a linked tab is visible (and on window `focus`, before every disk write, and across page reloads), `naizo.js` checks `file.lastModified` and compares `#naizodb` against its per-key FNV-1a snapshot hash manifest (`naizodb_disk_hash_<key>`). Concurrent human edits in the browser and AI agent edits on disk to different top-level keys (`fields[k]`, `lists[k]`, `custom[k]`) both survive without clobbering `document.activeElement`. On same-key collisions, disk wins and the pre-merge browser state is backed up to `naizodb_backup_<key>` with a 1-click **`↺ Restore`** button in the status pill (alongside **`📋 Copy`**, **`× Unlink`**, and **`↺ Repair`** if startup `#naizodb` JSON is malformed).

---

## How `naizo.js` Compares

Several tools explore reactive HTML, declarative persistence, or self-saving single-file apps, but each targets a different layer of the stack:

| Feature / Tool                        | **`naizo.js`**                                                | **[LOCAMO](https://github.com/DaiAoki/locamo)**             | **[ClayJS](https://clayjs.com/) / [HyperclayJS](https://hyperclayjs.com/)** | **[Bento](https://bento.page/) (`.bento.html`)**     | **[Mavo](https://mavo.io/)**                   | **[Alpine.js](https://alpinejs.dev/) + `$persist`** | **[TiddlyWiki](https://tiddlywiki.com/) / [Feather Wiki](https://feather.wiki/)** |
| :------------------------------------ | :------------------------------------------------------------ | :---------------------------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Primary Goal**                      | Drop-in script for custom HTML + AI agent sync                | Ready-to-use single-file memo app for humans & AI agents    | Malleable HTML apps via save server / host                                  | Pre-built single-file office apps (Slides, etc.)     | Declarative CRUD web apps from HTML            | General frontend reactivity + `localStorage`        | Standalone single-file personal wiki                                              |
| **Works on Arbitrary Custom HTML**    | **Yes** (any `.html` file)                                    | No (fixed memo app UI)                                      | **Yes**                                                                     | No (fixed app shells)                                | **Yes**                                        | **Yes**                                             | No (wiki UI / tiddlers)                                                           |
| **Canonical In-File JSON (`<head>`)** | **Yes** (`#naizodb` JSON; body is template, baked on export)  | **Yes** (`#app-data` JSON in `<body>`; `outerHTML` rewrite) | Optional (`clay-data` / `live` plugin; DOM-first)                           | **Yes** (`#bento-doc` JSON)                          | No (external `.json` / cloud / `localStorage`) | No (`localStorage` only)                            | Internal tiddler store                                                            |
| **Zero-Server Local Disk Save**       | **Yes** (surgical `#naizodb` File System API + HTML fallback) | **Yes** (`⌘S` File System Access API; Chromium only)        | Requires `POST /_/save` server or desktop app                               | **Yes** (File System Access API + download fallback) | No (cloud APIs or download)                    | No                                                  | Yes (via Saver plugins / download)                                                |
| **Two-Way Human ↔ AI Disk Sync**      | **Yes** (~2 s live watch + shallow key merge + restore)       | Manual reload only (`⌘S` overwrites external disk edits)    | Server ETag / 3-way `merge` plugin                                          | Manual reload / JSON replace                         | No                                             | No (`localStorage` masks disk edits)                | No                                                                                |
| **Declarative List Repeater**         | **Yes** (`naizo-list` / `naizo-item`)                         | N/A (hardcoded page sidebar)                                | Basic (`add-from` / `add-to` template clone)                                | N/A                                                  | **Yes** (`mv-multiple`)                        | **Yes** (`x-for`)                                   | Wiki templates                                                                    |
| **Runtime Footprint (Gzip)**          | **~10.8 KB** (0 deps)                                         | ~5.5 KB bundled app (0 deps)                                | ~3 KB loader + network plugins (~1 MB standalone)                           | ~700 KB bundled app                                  | ~60+ KB                                        | ~16 KB                                              | ~56 KB – 2+ MB                                                                    |

---

## Contributing & Repository Development

If you are contributing to `naizo.js` itself (modifying `src/` or running the automated test suite), this repository uses the [Vite+ CLI](https://viteplus.dev/guide/global-cli) (`vp`):

```bash
vp install  # Install dependencies
vp pack     # Build dist/naizo.js, dist/naizo.min.js, dist/index.mjs, and dist/index.d.mts
vp test     # Run Vitest unit & DOM suite against built outputs
vp check    # Run Oxfmt, Oxlint, and type-checking together
vp dev      # Start the local playground dev server (http://localhost:3000)
```

See [AGENTS.md](AGENTS.md) for architecture and contributor conventions and [docs/PUBLISHING.md](docs/PUBLISHING.md) for release and npm publication workflows.

---

## License

MIT
