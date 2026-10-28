<div align="center">

# `naizo.js`

**Self-persisting HTML for human & AI flows.**

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Bundle Size](https://img.shields.io/badge/min%2Bgzip-~12.3_KB-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

_`naizo.js` turns any single `.html` file into a self-saving application — from custom dashboards, studios, and personal trackers to interactive specs and creative micro-tools — with state stored in a built-in JSON block (`<script id="naizodb">`) shared between your browser and AI agents on disk._

[Why Naizo?](#why-naizo) · [Two-Way Loop](#the-human-browser--naizodb--local-file--ai-agent-loop) · [Quick Start](#quick-start) · [Starter Examples](#four-starter-app-blueprints) · [AI Agent Skill](#ai-agent-skill-skillsnaizoskillmd) · [Attributes & API](#declarative-html-attributes--windownaizo-api) · [Modes & Browsers](#browser--mode-capability-matrix) · [Full Usage Guide](docs/USAGE.md)

</div>

---

## Why Naizo?

A single `.html` file can be almost anything: a custom tool tailored to your workflow, a visual canvas, an inventory studio, a project board, or an interactive notebook crafted in seconds with an AI agent. Yet plain HTML has two persistent limits: edits in the browser vanish on refresh, and saving to `localStorage` traps your data inside the browser where CLI or IDE agents on disk cannot see it.

In Japanese, **_naizō_ (ないぞう)** has two homophonous meanings — and `naizo.js` provides both with a single `<script>` tag:

- **内蔵 (_naizō_ — Built-In, `#naizodb` in `<head>`):** Every HTML document houses its own 2-space indented JSON database (`{ _meta, fields, lists, custom }`) inside `<script id="naizodb" type="application/json">`. `<body>` stays a clean template; `#naizodb` holds the canonical data.
- **内臓 (_naizō_ — Internal Organs, `naizo.js` runtime):** Reactive field bindings (`naizo="key"`), a declarative list repeater (`naizo-list="name"`), surgical in-place disk writes (`⌘S` / `Ctrl+S`), and a ~2 s file watcher that 3-way merges external agent edits without interrupting focused inputs.

---

## The Human Browser ↔ `#naizodb` ↔ Local File ↔ AI Agent Loop

Humans interact with rendered HTML controls in the browser; AI agents read and edit structured JSON on disk. `naizo.js` keeps both sides synchronized without a backend server:

1. **Browser DOM:** Edit inputs, `contenteditable` blocks, or `[naizo-list]` rows. `O(1)` event capture updates the in-memory store and `localStorage` immediately.
2. **`#naizodb` Store:** Unbound fields, unbound lists, and extra item keys (such as `id` or `estimate`) pass through untouched. Per-key `fnv1a:` hashes track baseline state.
3. **Local `.html` File:** Pressing `⌘S` / `Ctrl+S` links the file via the File System Access API and surgically updates only the `<script id="naizodb">` block — keeping `git diff` clean and preventing third-party runtime DOM mutations (Tailwind CDN, Lucide, Mermaid) from polluting the file on disk.
4. **CLI / IDE Agent:** When an AI agent edits `#naizodb` on disk, `naizo.js` detects `file.lastModified` within ~2 s, merges unrelated keys, protects `document.activeElement`, and backs up same-key collisions to `↺ Restore`.

```text
Browser DOM  ──(O(1) input + ⌘S surgical write)──►  <script id="naizodb"> in plan.html
             ◄──(~2 s watch + 3-way key merge)────  Edited on disk by CLI / IDE Agent
```

---

## Inspiration

`naizo.js` grew out of two ideas:

- **[The Unreasonable Effectiveness of HTML](https://claude.dev/blog/using-claude-code-the-unreasonable-effectiveness-of-html/):** At first, replacing Markdown with HTML felt backwards — raw HTML is noisy to read and tedious to edit by hand, whereas Markdown makes jotting down quick notes effortless. The real friction with HTML wasn't rendering it; it was **persisting edits** without hand-editing tags or asking an AI agent for every small tweak. That sparked the core idea: _what if a self-contained HTML file could save its own state and act like a lightweight app?_
- **[htmx](https://htmx.org/):** Proof that a tiny, flexible library — just one `<script>` tag and a few declarative attributes — can give plain HTML superpowers. Where `htmx` connects HTML to backends, `naizo.js` turns HTML into a self-persisting document synced between your browser and AI agents on disk.

---

## Quick Start

No Node.js, bundler, or backend server is required:

1. **Embed `#naizodb`:** Place `<script id="naizodb" type="application/json">` and the `naizo.js` script tag inside `<head>`.
2. **Bind Markup:** Add `naizo="key"` to fields and `naizo-list="name"` + `naizo-item` to repeating lists in `<body>`.
3. **Press `⌘S` / `Ctrl+S`:** Open the `.html` file in your browser and press `⌘S` / `Ctrl+S` to link it on disk (or click **`⬇ Save to PC`** in Online Mode).

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

### Ways to Load `naizo.js`

```html
<!-- jsDelivr CDN (readable bundle) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>

<!-- Prebuilt minified bundle (~12.3 KB gzipped, works on either CDN) -->
<script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.min.js" defer></script>

<!-- unpkg CDN (readable bundle) -->
<script src="https://unpkg.com/naizojs@latest/dist/naizo.js" defer></script>

<!-- Offline / local copy -->
<script src="./dist/naizo.js" defer></script>
```

Both CDNs serve the published `naizojs` npm package (`@latest` follows new releases automatically; replace `@latest` with a specific version tag to pin a fixed version). See the [Usage Reference](docs/USAGE.md) for complete authoring patterns and the [Publishing Guide](docs/PUBLISHING.md#cdn-urls-and-automatic-updates) for CDN caching details.

---

## Starter App Blueprints

Because `<body>` is standard HTML, CSS, and JavaScript and `#naizodb` stores arbitrary JSON (`fields`, `lists`, `custom`), you can build almost any single-file application. Use the starter apps in [`examples/`](examples/) as architectural blueprints — try them in Online Mode or click **`⬇ Save to PC`** in the status pill to adapt them on your computer:

| Template                                                 | What It Demonstrates                                                                                                                                                                                                 |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`examples/starter.html`](examples/starter.html)**     | **Project Specification & Milestones** — Minimal spec sheet with an editable heading, owner and status fields, summary textarea, and repeating milestone checklist.                                                  |
| **[`examples/checklist.html`](examples/checklist.html)** | **Release Verification Checklist** — Pre-release sign-off sheet with reviewer metadata, environment dropdown, release readiness toggle, prioritized checks, and blocker notes.                                       |
| **[`examples/notes.html`](examples/notes.html)**         | **Master–Detail Engineering Notebook** — Zero-DOM-wipe multi-note workspace on `[naizo-list="notes"]` with sidebar search, category filtering, pinning, live word/task counters, and `Alt+N` / `Alt+↑/↓` navigation. |
| **[`examples/inventory.html`](examples/inventory.html)** | **Asset & Inventory Studio** — Filterable card grid with custom per-card JSON key-value properties (pass-through keys), `<dialog>` modals, dynamic location filter options, and live KPI summaries.                  |

---

## AI Agent Skill (`skills/naizo/SKILL.md`)

Want your AI coding agent (Claude Code, Antigravity, Cursor, GitHub Copilot, Gemini CLI, or Codex) to automatically generate self-saving `naizo.js` HTML apps and co-edit `#naizodb` on disk? Install [`skills/naizo/SKILL.md`](skills/naizo/SKILL.md) via `gh skill`, `npx skills`, or `curl`:

```bash
# 1. GitHub CLI (gh v2.90+ — installs from the latest published release)
gh skill install nickosh/naizo naizo

# 2. npm Skills CLI (npx skills)
npx skills add nickosh/naizo --skill naizo

# 3. Direct curl (no CLI required — Antigravity, Cursor, Codex, Gemini CLI / Claude Code)
mkdir -p .agents/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .agents/skills/naizo/SKILL.md
mkdir -p .claude/skills/naizo && curl -fsSL https://raw.githubusercontent.com/nickosh/naizo/main/skills/naizo/SKILL.md -o .claude/skills/naizo/SKILL.md
```

### Experimental / In-Development (`main` Branch)

To preview unreleased features on `main` before the next tagged release is published, pair the in-development `dist/naizo.js` bundle with the `@main` skill (note: `main` is under active development and may contain experimental or not-yet-released changes):

```html
<!-- In-development runtime directly from main (or local ./dist/naizo.js from a main checkout) -->
<script src="https://cdn.jsdelivr.net/gh/nickosh/naizo@main/dist/naizo.js" defer></script>
```

```bash
# In-development AI skill from main
gh skill install nickosh/naizo naizo@main
npx skills add nickosh/naizo@main --skill naizo
```

---

## Declarative HTML Attributes & `window.Naizo` API

Every attribute supports both concise **`naizo` / `naizo-*`** syntax and HTML5-compliant **`data-naizo` / `data-naizo-*`** aliases (for example, `naizo="key"` or `data-naizo="key"`):

| Attribute (or `data-*`)            | Target Element                                                              | Behavior                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `naizo="key"`                      | `<input>`, `<textarea>`, `<select>`, `<details>`, `[contenteditable]`, leaf | Binds element state to `fields["key"]` (or item property inside `[naizo-item]`).                                             |
| `naizo-list="name"`                | `<div>`, `<ul>`, `<tbody>`                                                  | Declares a repeating list bound to `lists["name"]` and appends `+ Add Item`.                                                 |
| `naizo-item`                       | Direct child of `[naizo-list]`                                              | Marks a repeating row/card with hover `↑ ↓ ×` controls and `WeakMap` pass-through keys.                                      |
| `naizo-template`                   | `<template>` in list                                                        | Optional explicit blueprint for new items (auto-inferred from first item when omitted).                                      |
| `naizo-add="name"`                 | `<button>`                                                                  | Appends a new blank item to `[naizo-list="name"]`.                                                                           |
| `naizo-remove`                     | `<button>` in item                                                          | Removes the enclosing `[naizo-item]` row.                                                                                    |
| `naizo-move="up\|down"`            | `<button>` in item                                                          | Moves the enclosing `[naizo-item]` row up or down.                                                                           |
| `naizo-no-controls`                | `[naizo-list]`                                                              | Disables automatic injection of `+ Add Item` and row toolbars.                                                               |
| `naizo-ignore`                     | Any element                                                                 | Excludes element/subtree from state binding while preserving it in exported HTML.                                            |
| `naizo-strip`                      | Any element                                                                 | Excludes element/subtree from state binding and strips it from auto-templates and exported/downloaded HTML (`⬇ Save to PC`). |
| `naizo-id="scope"`                 | `<html>` or `<body>`                                                        | Optional document scope identifier to isolate storage keys on `localhost`.                                                   |
| `naizo-mode="online\|local\|auto"` | `<html>` or `<body>`                                                        | Overrides automatic Local Mode vs. Online Mode detection.                                                                    |
| `naizo-manual`                     | `<html>`, `<body>`, or `<script>`                                           | Opts out of automatic boot so you can call `Naizo.init()` manually.                                                          |

```javascript
// Programmatic JavaScript API (window.Naizo / window.NaizoDB)
Naizo.get('rateLimitRps');
Naizo.set('rateLimitRps', 250);
Naizo.delete('oldKey');
Naizo.getField('owner');
Naizo.setField('owner', 'Kenji');
Naizo.deleteField('flag');

Naizo.getList('tasks');
Naizo.addItem('tasks', { done: false, title: 'Ship', priority: 'High' });
Naizo.updateItem('tasks', 0, { done: true });
Naizo.moveItem('tasks', 1, 0);
Naizo.removeItem('tasks', 2);

Naizo.bind(rootEl);
await Naizo.save();
Naizo.reset();
await Naizo.unlink();
await Naizo.copyJSON();
const html = Naizo.exportHTML();
const portable = Naizo.downloadHTML('app.html');

// Events: 'naizo:hydrate', 'naizo:change', 'naizo:item'
```

See [docs/USAGE.md](docs/USAGE.md) for the complete API, event payloads, and architectural recipes.

---

## Browser & Mode Capability Matrix

How `naizo.js` adapts across Local Mode and Online Mode while keeping the status pill truthful about storage durability:

| Mode & Browsers                                                                    | Status Pill & Action                                                          | Persistence, Sync, & Recovery                                                                                                                                                                                                                                                                                                                       |
| :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Mode (Live Disk)**<br>Chrome, Edge, Brave, Arc on `file://` or `localhost` | `Browser Cache · Click to Link Disk`<br>↓ _after linking_<br>`Synced to Disk` | `⌘S` / `Ctrl+S` links or saves immediately; surgical `<script id="naizodb">` in-place write; immediate disk flush on tab switch; IndexedDB handle persistence; ~2 s `file.lastModified` watch; 3-way shallow key merge with `↺ Restore` backup.                                                                                                     |
| **Online Mode (Web Host)**<br>All modern browsers on GitHub Pages or `https://`    | `Saved in Browser`<br>Actions: `⬇ Save to PC` · `↺ Reset`                     | Instant `localStorage` persistence + cross-tab `storage` merge; `↺ Reset` with inline Shadow DOM confirmation and `↺ Restore` undo backup; `⬇ Save to PC` (`Naizo.downloadHTML()`) rewrites relative `naizo.js` paths to `dist/naizo.min.js` on the npm CDN and strips `naizo-mode="online"` so downloaded `.html` files run in Local Mode on a PC. |
| **Local Mode (Fallback)**<br>Safari & Firefox on `file://` or `localhost`          | `Browser Cache · Click to Save HTML`<br>Action: `📋 Copy`                     | Full reactive bindings, `[naizo-list]` repeater, and `localStorage` cache; 1-click `📋 Copy` (`Naizo.copyJSON()`) to copy `#naizodb` JSON to clipboard; 1-click clean `.html` snapshot download via `Naizo.exportHTML()`.                                                                                                                           |

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
| **Runtime Footprint (Gzip)**          | **~12.3 KB** (0 deps)                                         | ~5.5 KB bundled app (0 deps)                                | ~3 KB loader + network plugins (~1 MB standalone)                           | ~700 KB bundled app                                  | ~60+ KB                                        | ~16 KB                                              | ~56 KB – 2+ MB                                                                    |

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
