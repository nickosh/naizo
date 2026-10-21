<div align="center">

# `naizo.js`

**The Built-In Engine for Self-Persisting HTML & AI Agent Workflows**

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Bundle Size](https://img.shields.io/badge/min%2Bgzip-~4.7_KB-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

_Turn static HTML files into self-saving apps with built-in JSON state (`#naizodb`) for Human + AI workflows._

</div>

---

## Why **_Naizo_**?

In Japanese, **_naizō_ (ないぞう)** carries two homophonous meanings—both of which capture what `naizo.js` does for HTML:

- **内蔵 (_naizō_ — built-in / embedded / housed within):** Every `.html` artifact houses its own canonical JSON micro-database (`<script id="naizodb" type="application/json">`) right inside `<head>`. No external server, no separate `.json` sidecar, and no state trapped exclusively in browser storage—everything is **built-in** to the single file.
- **内臓 (_naizō_ — internal organs / viscera):** Plain HTML markup is only a static skeleton. `naizo.js` supplies the **vital internal organs** inside the document—reactive field bindings, a dynamic list repeater, and a two-way disk circulatory system—turning inert `.html` files into living, breathing applications shared between humans in the browser and AI agents on disk.

---

## The Problem `naizo.js` Solves

AI coding agents (like Codex, Claude Code, OpenCode, Antigravity, and Cursor) are shifting from plain Markdown to **rich HTML artifacts** for specs, implementation plans, interactive checklists, code reviews, and custom triage tools.

HTML is far more expressive than Markdown—until a human wants to interact with it:

1. **Static HTML is a lifeless skeleton:** Checking boxes, typing notes, or adding tasks in a local `.html` file disappears the moment you refresh the tab.
2. **Browser storage hides edits from AI agents:** Saving state to `localStorage` keeps it trapped inside your browser profile. When your CLI AI agent reads `plan.html` from disk on the next turn, it is completely blind to your changes.

**`naizo.js`** gives HTML both **内蔵 (built-in storage)** and **内臓 (living internal organs)** with a single `<script>` tag:

- **`<script id="naizodb" type="application/json">` — 内蔵 (_Built-In Memory_):** The embedded JSON micro-database living right inside the HTML file, directly readable and writable by AI agents on disk and cleanly diffable in Git.
- **`naizo.js` — 内臓 (_Vital Organs_):** The tiny reactive engine that binds your HTML inputs and dynamic lists (`naizo="key"`, `naizo-list="tasks"`) and keeps **Human edits in the browser** and **AI Agent edits on disk** in two-way sync without a backend server.

---

## Inspiration

`naizo.js` grew out of two ideas:

- **[The Unreasonable Effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/):** At first, replacing Markdown with HTML felt backwards — raw HTML is noisy to read and tedious to edit by hand, whereas Markdown makes jotting down quick notes effortless. The real friction with HTML wasn't rendering it; it was **persisting edits** without hand-editing tags or asking an AI agent for every small tweak. That sparked the core idea: _what if a self-contained HTML file could save its own state and act like a lightweight app?_
- **[htmx](https://htmx.org/):** Proof that a tiny, flexible library — just one `<script>` tag and a few declarative attributes — can give plain HTML superpowers. Where `htmx` connects HTML to backends, `naizo.js` turns HTML into a self-persisting document synced between your browser and AI agents on disk.

---

## Quick Start

Run the local demo playground with [Vite+](https://viteplus.dev/):

```bash
vp install
vp pack
vp dev
# Opens http://localhost:3000 (serves site/index.html)
```

Or copy a starter template from [`examples/starter.html`](examples/starter.html) / [`examples/checklist.html`](examples/checklist.html) and drop `naizo.js` into any HTML file:

```html
<head>
  <script id="naizodb" type="application/json">
    { "_meta": {}, "fields": {}, "lists": {}, "custom": {} }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
</head>
```

Edits are cached immediately in `localStorage` and written back to the local `.html` file once linked via the bottom-right status pill (`showSaveFilePicker` in Chromium browsers, with HTML download fallback elsewhere).

You can use unpkg instead of jsDelivr (load one provider):

```html
<script src="https://unpkg.com/naizojs@latest/dist/naizo.js" defer></script>
```

Both providers serve the published npm package. The `@latest` URLs follow new npm releases as CDN caches refresh; no separate CDN deployment is needed. Use `dist/naizo.min.js` in either URL for the prebuilt minified bundle. To keep an HTML artifact on a fixed version, replace `@latest` with an exact version such as `@0.1.0`.

CDN URLs require the package/version to be published to npm. For local development or offline use, load a local copy of `dist/naizo.js`. See the [publishing guide](docs/PUBLISHING.md#cdn-urls-and-automatic-updates) for release and caching details.

---

## Declarative HTML Attributes

`naizo.js` supports both concise **`naizo` / `naizo-*`** attributes (recommended for low token overhead) and HTML5-compliant **`data-naizo` / `data-naizo-*`** attributes (for strict HTML validators):

| Short Attribute         | HTML5 `data-*` Alias                    | Target Element                                                              | Description                                                                                                                   |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`           | `data-naizo="key"` / `data-naizo-field` | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf | Binds the element's state to `fields["key"]` (or to the item's `"key"` property when on or inside a `[naizo-item]`).          |
| `naizo-list="name"`     | `data-naizo-list="name"`                | Container (`<div>`, `<ul>`, `<tbody>`)                                      | Declares a repeating list bound to `lists["name"]` in `#naizodb`. Automatically injects a `+ Add Item` button below the list. |
| `naizo-item`            | `data-naizo-item`                       | Child of `[naizo-list]`                                                     | Marks a repeating item row or card. Automatically receives hover `↑` `↓` `×` controls.                                        |
| `naizo-template`        | `data-naizo-template`                   | `<template>` inside `[naizo-list]`                                          | Optional explicit HTML blueprint for new items. Auto-generated (`data-naizo-auto-template`) from the first item if omitted.   |
| `naizo-add="name"`      | `data-naizo-add="name"`                 | `<button>`                                                                  | Appends a new blank item to `[naizo-list="name"]` and focuses its first text field.                                           |
| `naizo-remove`          | `data-naizo-remove`                     | `<button>` inside `[naizo-item]`                                            | Removes the enclosing `[naizo-item]`.                                                                                         |
| `naizo-move="up\|down"` | `data-naizo-move="up\|down"`            | `<button>` inside `[naizo-item]`                                            | Moves the enclosing `[naizo-item]` up or down.                                                                                |
| `naizo-no-controls`     | `data-naizo-no-controls`                | `[naizo-list]`                                                              | Disables automatic injection of `+ Add Item` and `↑` `↓` `×` buttons for that list.                                           |
| `naizo-ignore`          | `data-naizo-ignore`                     | Any HTML element                                                            | Excludes the element and its subtree from state binding while preserving it in exported HTML.                                 |
| `naizo-id="scope"`      | `data-naizo-id="scope"`                 | `<html>` or `<body>`                                                        | Optional document scope identifier to isolate `localStorage` and IndexedDB file handles on `localhost`.                       |
| `naizo-manual`          | `data-naizo-manual`                     | `<html>`, `<body>`, or `<script>`                                           | Opts out of automatic `initNaizo()` boot when loading the browser IIFE bundle so you can call `Naizo.init()` manually.        |

---

## JavaScript API (`window.Naizo` / `window.NaizoDB`)

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
await Naizo.unlink(); // Forget linked FileSystemFileHandle
const json = await Naizo.copyJSON(); // Copy #naizodb JSON to clipboard and return string
const html = Naizo.exportHTML(); // Return clean HTML snapshot with baked attributes

// Lifecycle & Mutation Events
window.addEventListener('naizo:hydrate', (e) => console.log('Hydrated store:', e.detail));
window.addEventListener('naizo:change', (e) => console.log('State changed:', e.detail));
window.addEventListener('naizo:item', (e) => console.log('New list row:', e.detail));
```

---

## How Disk Sync & Conflict Resolution Work

1. **Body is the template, `#naizodb` is the data:** When linked to a local file via the bottom-right status pill (`showSaveFilePicker`), `naizo.js` surgically updates only the `<script id="naizodb">` block in place (`\u003c`-escaped, UTF-8 BOM preserved) so third-party runtime DOM mutations (Tailwind Play CDN, Lucide, Mermaid) never pollute the file on disk. Edit `#naizodb` to change data; edit `<body>` markup to change the view.
2. **Pass-through keys:** Unbound fields in `db.fields`, unbound lists in `db.lists`, and extra keys on list item objects (such as agent-authored `id` or `estimate`) pass through untouched in memory and on save.
3. **Live ~2 s watch & shallow 3-way merge:** While a linked tab is visible (and on window `focus`, before every disk write, and across page reloads), `naizo.js` checks `file.lastModified` and compares `#naizodb` against its per-key FNV-1a snapshot hash manifest (`naizodb_disk_hash_<key>`). Concurrent human edits in the browser and AI agent edits on disk to different top-level keys (`fields[k]`, `lists[k]`, `custom[k]`) both survive without clobbering `document.activeElement`. On same-key collisions, disk wins and the pre-merge browser state is backed up to `naizodb_backup_<key>` with a 1-click **`↺ Restore`** button in the status pill (alongside **`📋 Copy`**, **`× Unlink`**, and **`↺ Repair`** if startup `#naizodb` JSON is malformed).

---

## How `naizo.js` Compares

Several tools explore reactive HTML, declarative persistence, or self-saving single-file apps, but each targets a different layer of the stack:

| Feature / Tool                        | **`naizo.js`**                                                | **[ClayJS](https://clayjs.com/) / [HyperclayJS](https://hyperclayjs.com/)** | **[Bento](https://bento.page/) (`.bento.html`)**     | **[Mavo](https://mavo.io/)**                   | **[Alpine.js](https://alpinejs.dev/) + `$persist`** | **[TiddlyWiki](https://tiddlywiki.com/) / [Feather Wiki](https://feather.wiki/)** |
| :------------------------------------ | :------------------------------------------------------------ | :-------------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Primary Goal**                      | Drop-in script for custom HTML + AI agent sync                | Malleable HTML apps via save server / host                                  | Pre-built single-file office apps (Slides, etc.)     | Declarative CRUD web apps from HTML            | General frontend reactivity + `localStorage`        | Standalone single-file personal wiki                                              |
| **Works on Arbitrary Custom HTML**    | **Yes** (any `.html` file)                                    | **Yes**                                                                     | No (fixed app shells)                                | **Yes**                                        | **Yes**                                             | No (wiki UI / tiddlers)                                                           |
| **Canonical In-File JSON (`<head>`)** | **Yes** (`#naizodb` JSON; body is template, baked on export)  | Optional (`clay-data` / `live` plugin; DOM-first)                           | **Yes** (`#bento-doc` JSON)                          | No (external `.json` / cloud / `localStorage`) | No (`localStorage` only)                            | Internal tiddler store                                                            |
| **Zero-Server Local Disk Save**       | **Yes** (surgical `#naizodb` File System API + HTML fallback) | Requires `POST /_/save` server or desktop app                               | **Yes** (File System Access API + download fallback) | No (cloud APIs or download)                    | No                                                  | Yes (via Saver plugins / download)                                                |
| **Two-Way Human ↔ AI Disk Sync**      | **Yes** (~2 s live watch + shallow key merge + restore)       | Server ETag / 3-way `merge` plugin                                          | Manual reload / JSON replace                         | No                                             | No (`localStorage` masks disk edits)                | No                                                                                |
| **Declarative List Repeater**         | **Yes** (`naizo-list` / `naizo-item`)                         | Basic (`add-from` / `add-to` template clone)                                | N/A                                                  | **Yes** (`mv-multiple`)                        | **Yes** (`x-for`)                                   | Wiki templates                                                                    |
| **Runtime Footprint (Gzip)**          | **0 deps** (single drop-in script)                            | ~3 KB loader + network plugins (~1 MB standalone)                           | ~700 KB bundled app                                  | ~60+ KB                                        | ~16 KB                                              | ~56 KB – 2+ MB                                                                    |

---

## Development (`Vite+`)

Use the [global Vite+ CLI](https://viteplus.dev/guide/global-cli) (`vp`) for local development. VP reads the project pins automatically: Node **24.22.0** from `.node-version`, pnpm **12.14.0** from `package.json#packageManager`, and the local Vite+ toolchain **1.3.0** from `package.json` / `pnpm-lock.yaml`. Build, lint, format, and test settings live in `vite.config.ts`.

```bash
vp install  # Install dependencies
vp dev      # Start Vite dev server (http://localhost:3000)
vp check    # Run Oxfmt, Oxlint, and type-checking together
vp pack     # Build fresh library outputs before tests or the local demo
vp test     # Run Vitest unit/DOM suite against freshly built outputs
vp node scripts/release.ts version v0.1.0 # Run a script with the pinned Node.js
vp env current # Inspect the resolved Node.js and package-manager versions
```

`vp install --frozen-lockfile` reproduces the locked dependency installation. VP provisions missing managed versions as needed; use `vp env doctor` to diagnose environment selection. Refresh the project pins deliberately with `vp env pin <node-version> --target node-version` and `vp env pin pnpm@<version> --target package-manager`, then verify and commit the changes. CI uses the same declarations through `setup-vp`; the npm publishing job reads `.node-version` directly and keeps its separate, dependency-free npm OIDC setup.

`pnpm-workspace.yaml` keeps runtime and package-manager selection with VP (`runtimeOnFail: ignore`, `pmOnFail: ignore`) and records pnpm resolution settings in the lockfile. The file configures this single-package repository; it does not add workspace packages.

Release preparation is explicit: a manual **Prepare release** request or a newly pushed `Release-As:` footer builds the readable browser bundle and includes it in the version/changelog PR. Ordinary source changes do not require a bundle commit; CI builds before testing. The tracked readable bundle is refreshed in the release PR. Ordinary pushes never refresh that PR, but return it to draft when `main` moves past it, until it is explicitly refreshed. Merging it updates the bundle in the repository, starts verified npm Trusted Publishing, and finalizes the GitHub draft. Both readable and minified bundles are included. For the manual `v0.1.0` bootstrap, GitHub settings, and recovery, see the [publishing guide](https://github.com/nickosh/naizo/blob/main/docs/PUBLISHING.md).

---

## License

MIT
