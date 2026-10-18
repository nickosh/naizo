<div align="center">

# `naka.js`

**The Lightweight Script for Self-Persisting HTML & AI Agent Workflows**

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Bundle Size](https://img.shields.io/badge/gzip-~3.2_KB-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

*Turn any static `.html` file into a living, human-editable application with an embedded JSON inner database (`#nakadb`) that syncs directly back to disk.*

</div>

---

## Why `naka.js`?

AI coding agents (like Antigravity, Claude Code, Gemini CLI, and Cursor) are shifting from plain Markdown to **rich HTML artifacts** for specs, implementation plans, interactive checklists, code reviews, and custom triage tools.

HTML is far more expressive than Markdown—until a human wants to edit it:
1. **Static HTML forgets your input:** Checking boxes, typing notes, or adding tasks in a local `.html` file disappears the moment you refresh the tab.
2. **Browser storage hides edits from AI agents:** Saving state to `localStorage` keeps it trapped inside your browser profile. When your CLI AI agent reads `plan.html` from disk on the next turn, it is completely blind to your changes.

**`naka.js`** solves this with a single `<script>` tag:
* **`naka.js`:** The tiny reactive engine that binds your HTML inputs and dynamic lists.
* **`<script id="nakadb" type="application/json">`:** The **中 (*naka* — inside)** JSON micro-database living right inside the HTML file, fully readable and writable by AI agents and Git diffs.
* **仲 (*naka* — bridge/rapport):** Keeps **Human edits in the browser** and **AI Agent edits on disk** in two-way sync without a backend server.

---

## Quick Start

Run the local demo playground:

```bash
npm run dev
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

| Attribute | Target Element | Description |
|---|---|---|
| `data-naka="key"` | `<input>`, `<textarea>`, `<select>`, `[contenteditable="true"]` | Binds the element's state to `fields["key"]` (or to the item's `"key"` property when inside a `[data-naka-item]`). |
| `data-naka-list="name"` | Container (`<div>`, `<ul>`, `<tbody>`) | Declares a repeating list bound to `lists["name"]` in `#nakadb`. Automatically injects a `+ Add Item` button below the list. |
| `data-naka-item` | Child of `[data-naka-list]` | Marks a repeating item row or card. Automatically receives hover `↑` `↓` `×` controls. |
| `data-naka-template` | `<template>` inside `[data-naka-list]` | Optional explicit HTML blueprint for new items. Auto-generated from the first `[data-naka-item]` if omitted. |
| `data-naka-add="name"` | `<button>` | Appends a new blank item to `[data-naka-list="name"]`. |
| `data-naka-remove` | `<button>` inside `[data-naka-item]` | Removes the enclosing `[data-naka-item]`. |
| `data-naka-move="up\|down"` | `<button>` inside `[data-naka-item]` | Moves the enclosing `[data-naka-item]` up or down. |
| `data-naka-no-controls` | `[data-naka-list]` | Disables automatic injection of `+ Add Item` and `↑` `↓` `×` buttons for that list. |
| `data-naka-ignore` | Any HTML element | Excludes the element from state tracking and strips it from the HTML clone before writing to disk. |

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
Naka.save();                    // Manually trigger DOM capture + save cycle
const html = Naka.exportHTML(); // Return clean HTML string stripped of runtime UI
```

---

## License

MIT
