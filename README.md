<div align="center">

# `naka.js`

**The Lightweight Script for Self-Persisting HTML & AI Agent Workflows**

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Bundle Size](https://img.shields.io/badge/min%2Bgzip-~4.7_KB-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

_Turn any static `.html` file into a living, human-editable application with an embedded JSON inner database (`#nakadb`) that syncs directly back to disk._

</div>

---

## Why `naka.js`?

AI coding agents (like Antigravity, Claude Code, Gemini CLI, and Cursor) are shifting from plain Markdown to **rich HTML artifacts** for specs, implementation plans, interactive checklists, code reviews, and custom triage tools.

HTML is far more expressive than Markdown—until a human wants to edit it:

1. **Static HTML forgets your input:** Checking boxes, typing notes, or adding tasks in a local `.html` file disappears the moment you refresh the tab.
2. **Browser storage hides edits from AI agents:** Saving state to `localStorage` keeps it trapped inside your browser profile. When your CLI AI agent reads `plan.html` from disk on the next turn, it is completely blind to your changes.

**`naka.js`** solves this with a single `<script>` tag:

- **`naka.js`:** The tiny reactive engine that binds your HTML inputs and dynamic lists (`naka="key"`, `naka-list="tasks"`).
- **`<script id="nakadb" type="application/json">`:** The **中 (_naka_ — inside)** JSON micro-database living right inside the HTML file, fully readable and writable by AI agents and Git diffs.
- **仲 (_naka_ — bridge/rapport):** Keeps **Human edits in the browser** and **AI Agent edits on disk** in two-way sync without a backend server.

---

## Quick Start

Run the local demo playground with [Vite+](https://viteplus.dev/):

```bash
vp install
vp dev
# Opens http://localhost:3000/index.html
```

Or drop `naka.js` into any HTML file:

```html
<head>
  <script id="nakadb" type="application/json">
    { "_meta": {}, "fields": {}, "lists": {}, "custom": {} }
  </script>
  <script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/nakajs@main/naka.js" defer></script>
</head>
```

---

## Declarative HTML Attributes

`naka.js` supports both concise **`naka` / `naka-*`** attributes (recommended for low token overhead) and HTML5-compliant **`data-naka` / `data-naka-*`** attributes (for strict HTML validators):

| Short Attribute        | HTML5 `data-*` Alias        | Target Element                                                  | Description                                                                                                                  |
| ---------------------- | --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `naka="key"`           | `data-naka="key"`           | `<input>`, `<textarea>`, `<select>`, `[contenteditable="true"]` | Binds the element's state to `fields["key"]` (or to the item's `"key"` property when inside a `[naka-item]`).                |
| `naka-list="name"`     | `data-naka-list="name"`     | Container (`<div>`, `<ul>`, `<tbody>`)                          | Declares a repeating list bound to `lists["name"]` in `#nakadb`. Automatically injects a `+ Add Item` button below the list. |
| `naka-item`            | `data-naka-item`            | Child of `[naka-list]`                                          | Marks a repeating item row or card. Automatically receives hover `↑` `↓` `×` controls.                                       |
| `naka-template`        | `data-naka-template`        | `<template>` inside `[naka-list]`                               | Optional explicit HTML blueprint for new items. Auto-generated from the first `[naka-item]` if omitted.                      |
| `naka-add="name"`      | `data-naka-add="name"`      | `<button>`                                                      | Appends a new blank item to `[naka-list="name"]`.                                                                            |
| `naka-remove`          | `data-naka-remove`          | `<button>` inside `[naka-item]`                                 | Removes the enclosing `[naka-item]`.                                                                                         |
| `naka-move="up\|down"` | `data-naka-move="up\|down"` | `<button>` inside `[naka-item]`                                 | Moves the enclosing `[naka-item]` up or down.                                                                                |
| `naka-no-controls`     | `data-naka-no-controls`     | `[naka-list]`                                                   | Disables automatic injection of `+ Add Item` and `↑` `↓` `×` buttons for that list.                                          |
| `naka-ignore`          | `data-naka-ignore`          | Any HTML element                                                | Excludes the element from state tracking and strips it from the HTML clone before writing to disk.                           |

---

## JavaScript API (`window.Naka`)

```javascript
// Custom State Namespace
const rps = Naka.get('rateLimitRps');
Naka.set('rateLimitRps', 250);

// Programmatic List Manipulation
const tasks = Naka.getList('tasks');
Naka.addItem('tasks', { done: false, title: 'Write unit tests', priority: 'High' });
Naka.moveItem('tasks', 2, 0);
Naka.removeItem('tasks', 1);

// Core Utilities
Naka.save(); // Manually trigger DOM capture + save cycle
const html = Naka.exportHTML(); // Return clean HTML string stripped of runtime UI
```

---

## How `naka.js` Compares

Several tools explore reactive HTML, declarative persistence, or self-saving single-file apps, but each targets a different layer of the stack:

| Feature / Tool                        | **`naka.js`**                                        | **[ClayJS](https://clayjs.com/) / [HyperclayJS](https://hyperclayjs.com/)** | **[Bento](https://bento.page/) (`.bento.html`)**     | **[Mavo](https://mavo.io/)**                   | **[Alpine.js](https://alpinejs.dev/) + `$persist`** | **[TiddlyWiki](https://tiddlywiki.com/) / [Feather Wiki](https://feather.wiki/)** |
| :------------------------------------ | :--------------------------------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Primary Goal**                      | Drop-in script for custom HTML + AI agent sync       | Malleable HTML apps via save server / host                                  | Pre-built single-file office apps (Slides, etc.)     | Declarative CRUD web apps from HTML            | General frontend reactivity + `localStorage`        | Standalone single-file personal wiki                                              |
| **Works on Arbitrary Custom HTML**    | **Yes** (any `.html` file)                           | **Yes**                                                                     | No (fixed app shells)                                | **Yes**                                        | **Yes**                                             | No (wiki UI / tiddlers)                                                           |
| **Canonical In-File JSON (`<head>`)** | **Yes** (`#nakadb` JSON + baked DOM)                 | Optional (`clay-data` / `live` plugin; DOM-first)                           | **Yes** (`#bento-doc` JSON)                          | No (external `.json` / cloud / `localStorage`) | No (`localStorage` only)                            | Internal tiddler store                                                            |
| **Zero-Server Local Disk Save**       | **Yes** (File System Access API + download fallback) | Requires `POST /_/save` server or desktop app                               | **Yes** (File System Access API + download fallback) | No (cloud APIs or download)                    | No                                                  | Yes (via Saver plugins / download)                                                |
| **Two-Way Human ↔ AI Disk Sync**      | **Yes** (disk snapshot diff + live handle check)     | Server ETag / 3-way `merge` plugin                                          | Manual reload / JSON replace                         | No                                             | No (`localStorage` masks disk edits)                | No                                                                                |
| **Declarative List Repeater**         | **Yes** (`naka-list` / `naka-item`)                  | Basic (`add-from` / `add-to` template clone)                                | N/A                                                  | **Yes** (`mv-multiple`)                        | **Yes** (`x-for`)                                   | Wiki templates                                                                    |
| **Runtime Footprint (Gzip)**          | **~4.7 KB** (0 deps)                                 | ~3 KB loader + network plugins (~1 MB standalone)                           | ~700 KB bundled app                                  | ~60+ KB                                        | ~16 KB                                              | ~56 KB – 2+ MB                                                                    |

---

## Development (`Vite+`)

This repository uses [Vite+](https://viteplus.dev/) (`vp` CLI) configured via `vite.config.ts`:

```bash
vp install  # Install dependencies
vp dev      # Start Vite dev server (http://localhost:3000)
vp check    # Run Oxfmt, Oxlint, and type-checking together
vp test     # Run Vitest unit/DOM suite
vp pack     # Bundle library outputs via tsdown
```

---

## License

MIT
