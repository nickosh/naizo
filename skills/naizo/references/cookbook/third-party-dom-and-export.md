# Third-Party Runtime DOM Libraries & Clean HTML Export (`naizo-strip` vs. `naizo-ignore`)

Use this guide when combining **`naizo.js`** with client-side libraries that inject `<style>` blocks, replace elements, or mount runtime canvases/SVGs in the DOM – including **Tailwind Play CDN**, **Lucide** (or Feather/Heroicons), **Mermaid**, syntax highlighters (**Prism** / **Highlight.js**), **`canvas-confetti`**, and **Chart.js**.

---

## 1. How Persistence Interacts with Third-Party DOM Mutations (`D16`, `D23`, `D47`)

`naizo.js` writes HTML in two distinct ways depending on mode:

1. **Local Mode Surgical Disk Sync (`⌘S` / `Link Disk`, `D16`):** Reads the linked `.html` file on disk and replaces **only** the `<script id="naizodb">...</script>` JSON block in place. Runtime `<style>` tags, `<svg>` icons, or canvases injected into the live browser DOM never touch your `.html` file on disk.
2. **Full-HTML Snapshot Export (`Naizo.exportHTML()` & Online Mode `⬇ Save to PC` / `Naizo.downloadHTML()`, `D23`, `D47`):** Clones `document.documentElement`, bakes current form states (`value`, `checked`, `selected`, `open`) onto bound controls, and removes every element matching **`[naizo-strip], [data-naizo-strip]`** while keeping **`[naizo-ignore], [data-naizo-ignore]`** intact. (`ensureListBlueprints()` applies the same stripping rule when inferring `data-naizo-auto-template`.)

| Attribute                       | Bound to `#naizodb`? | Preserved on `⬇ Save to PC` / `exportHTML()`? | Use For                                                                                                                 |
| ------------------------------- | -------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `naizo-ignore` (`data-naizo-*`) | No                   | **Yes (kept)**                                | Search inputs, `<dialog naizo-ignore>` modals, `<canvas>` shells, and permanent source wrappers for icons/diagrams.     |
| `naizo-strip` (`data-naizo-*`)  | No                   | **No (removed)**                              | Runtime-generated `<style>` tags, rendered `<svg>` diagrams/icons, particle canvases, loading skeletons, and analytics. |

---

## 2. Tailwind Play CDN (`@tailwindcss/browser` / `cdn.tailwindcss.com`)

Tailwind's browser Play CDN scans the live DOM and appends a generated `<style>` tag into `<head>`. Without `data-naizo-strip`, clicking **`⬇ Save to PC`** bakes ~30–50 KB of generated utility CSS into `<head>` _alongside_ the Tailwind CDN `<script>`, bloating the saved `.html` file and risking stale rule specificity on reopen.

Mark your own authored `<style id="app-styles">` explicitly and tag dynamically injected `<style>` elements in `<head>` with `data-naizo-strip="true"`:

```html
<head>
  <script id="naizodb" type="application/json">
    { "_meta": {}, "fields": { "title": "Tailwind Studio" }, "lists": {}, "custom": {} }
  </script>

  <!-- Author styles stay untagged so they survive exportHTML() / Save to PC -->
  <style id="app-styles">
    body {
      padding-bottom: 5.5rem;
    }
  </style>

  <!-- Tag runtime-injected Tailwind <style> elements with data-naizo-strip="true" -->
  <script>
    new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (
            node instanceof HTMLStyleElement &&
            node.id !== 'app-styles' &&
            node.id !== '__naizodb_styles__'
          ) {
            node.setAttribute('data-naizo-strip', 'true');
          }
        }
      }
    }).observe(document.head, { childList: true });
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
</head>
```

---

## 3. Lucide Icons, Mermaid Diagrams, & Syntax Highlighters (Non-Destructive Source + `data-naizo-strip` Output)

Libraries like `lucide.createIcons()` and `mermaid.run()` **destructively replace** their placeholder element (`<i data-lucide="check">` or `<pre class="mermaid">`) with a rendered `<svg>`.

- If you leave the rendered `<svg>` untagged, `⬇ Save to PC` bakes hundreds of inline `<svg>` nodes into the HTML file (and Mermaid will fail to re-render when data changes later).
- If you put `naizo-strip` directly on the replaced placeholder, `⬇ Save to PC` strips the `<svg>`, leaving **nothing** behind when the downloaded `.html` file is opened on disk.

**Clean non-destructive pattern:** Keep a lightweight `[naizo-ignore]` wrapper holding the icon/diagram source in a `data-*` attribute (or `#naizodb`), and inject the rendered output inside a `data-naizo-strip="true"` child:

### (a) Reusable Lucide Icon Slot Helper

```html
<script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js" defer></script>

<!-- Wrapper survives export; inner rendered SVG is stripped cleanly and re-created on reopen -->
<button type="button" class="btn">
  <span data-icon="sparkles" naizo-ignore aria-hidden="true"></span>
  Generate Summary
</button>

<script>
  function renderLucideSlots(root = document) {
    if (!window.lucide) return;
    root.querySelectorAll('[data-icon]').forEach((slot) => {
      const name = slot.getAttribute('data-icon');
      if (!name || slot.dataset.renderedIcon === name) return;
      slot.dataset.renderedIcon = name;
      const mount = document.createElement('span');
      mount.setAttribute('data-naizo-strip', 'true');
      const placeholder = document.createElement('i');
      placeholder.setAttribute('data-lucide', name);
      mount.appendChild(placeholder);
      slot.replaceChildren(mount);
      window.lucide.createIcons({ root: mount });
    });
  }

  // Strip ephemeral data-rendered-icon guard only in memory by checking child presence too:
  function refreshIcons() {
    document.querySelectorAll('[data-icon]').forEach((slot) => {
      if (!slot.firstElementChild) delete slot.dataset.renderedIcon;
    });
    renderLucideSlots();
  }

  Naizo.ready(refreshIcons);
  window.addEventListener('naizo:hydrate', refreshIcons);
  window.addEventListener('naizo:change', refreshIcons);
</script>
```

### (b) Live `#naizodb`-Backed Mermaid Diagram Preview

Store the Mermaid source string in `#naizodb` (`naizo="diagram_src"`) and render the SVG into an adjacent `<div id="mermaid-preview" data-naizo-strip="true"></div>`:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" defer></script>

<label>
  Architecture Diagram (Mermaid)
  <textarea id="diagram-input" naizo="diagram_src" rows="6">
flowchart LR
  Browser["Browser DOM"] <--> DB["#naizodb JSON"]
  DB <--> Agent["AI Agent on Disk"]
  </textarea>
</label>

<!-- Stripped on exportHTML() / Save to PC; re-rendered cleanly from #naizodb on boot -->
<div id="mermaid-preview" data-naizo-strip="true"></div>

<script>
  let mermaidSeq = 0;
  async function syncMermaidPreview() {
    const out = document.getElementById('mermaid-preview');
    const src = String(Naizo.getField('diagram_src') ?? '').trim();
    if (!out || !window.mermaid || !src || out.dataset.lastSrc === src) return;
    out.dataset.lastSrc = src;
    window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    try {
      const { svg } = await window.mermaid.render(`mmd-${++mermaidSeq}`, src);
      out.innerHTML = svg;
    } catch (err) {
      out.textContent = `Diagram syntax error: ${err?.message || err}`;
    }
  }

  Naizo.ready(syncMermaidPreview);
  window.addEventListener('naizo:hydrate', syncMermaidPreview);
  window.addEventListener('naizo:change', (e) => {
    if (!e.detail?.key || e.detail.key === 'diagram_src' || e.detail.scope === 'batch') {
      void syncMermaidPreview();
    }
  });
</script>
```

---

## 4. `canvas-confetti` & Transient Celebration Overlays

Calling global `confetti()` without a target appends an untagged `position: fixed` `<canvas>` directly to `document.body`. If the user clicks **`⬇ Save to PC`** (`⌘S` fallback) while particles are on screen, that overlay `<canvas>` gets baked into the exported HTML.

Mount a dedicated `<canvas id="fx-canvas" naizo-strip>` once and bind `confetti.create()` to it:

```html
<canvas
  id="fx-canvas"
  naizo-strip
  aria-hidden="true"
  style="position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9990"
></canvas>
<script
  src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"
  defer
></script>

<script>
  let fireConfetti = null;
  function celebrateMilestone() {
    if (!window.confetti) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    if (!fireConfetti) {
      fireConfetti = window.confetti.create(canvas, { resize: true, useWorker: false });
    }
    fireConfetti({ particleCount: 55, spread: 68, origin: { y: 0.65 } });
  }
</script>
```

> **Note (`useWorker: false` for `file://` portability):** Web Workers constructed from `Blob:` URLs can hit Content Security Policy or `Origin: null` restrictions in strict local contexts; `useWorker: false` runs smoothly on the main thread everywhere.

---

## 5. Chart.js & Interactive `<canvas>` Widgets (Update In Place, Keep `<canvas>` Shell)

Unlike SVG libraries, `<canvas>` pixel buffers are not serialized into HTML text – only the empty `<canvas>` tag and any inline `width`/`height`/`style` attributes added by Chart.js are serialized. Wrap the chart in `<div class="chart-wrap" naizo-ignore>`, mount `<canvas>` inside a `data-naizo-strip="true"` stage recreated on boot (so Chart.js's inline pixel dimensions never bake into `exportHTML()`), and call `chart.update('none')` on `naizo:change` instead of destroying and recreating the `Chart` instance on every edit:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js" defer></script>

<div id="velocity-chart-shell" class="chart-shell" naizo-ignore style="height: 240px"></div>

<script>
  let velocityChart = null;

  function syncVelocityChart() {
    const shell = document.getElementById('velocity-chart-shell');
    if (!shell || !window.Chart) return;
    const tasks = Naizo.getList('tasks');
    const doneCount = tasks.filter((t) => Boolean(t.done)).length;
    const openCount = tasks.length - doneCount;

    if (!velocityChart || !shell.contains(velocityChart.canvas)) {
      const mount = document.createElement('div');
      mount.setAttribute('data-naizo-strip', 'true');
      mount.style.height = '100%';
      const canvas = document.createElement('canvas');
      mount.appendChild(canvas);
      shell.replaceChildren(mount);
      velocityChart = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Open'],
          datasets: [{ data: [doneCount, openCount], backgroundColor: ['#10b981', '#e5e0d8'] }],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false },
      });
      return;
    }

    velocityChart.data.datasets[0].data = [doneCount, openCount];
    velocityChart.update('none');
  }

  Naizo.ready(syncVelocityChart);
  window.addEventListener('naizo:hydrate', syncVelocityChart);
  window.addEventListener('naizo:change', syncVelocityChart);
</script>
```

---

## 6. Pitfalls to Avoid & Why

- **Putting `naizo-strip` on your app's own `<script>` or `<style>` tags:** `naizo-strip` removes the element on `⬇ Save to PC` (`Naizo.downloadHTML()`). Only put `naizo-strip` on **hosted-only** scripts (like Cloudflare Web Analytics in `site/index.html`, `M6.4`) or **regenerable runtime output** – never on scripts/styles the downloaded local `.html` file needs to run.
- **Letting `mermaid.initialize({ startOnLoad: true })` mutate `<pre class="mermaid">` directly:** Destroys the Mermaid source text in the DOM, so `⬇ Save to PC` saves a frozen `<svg>` that cannot be edited or re-rendered in dark mode. Always keep source text separate from the `data-naizo-strip` preview node.
- **Destroying and `new Chart()`-ing on every `naizo:change` keystroke:** Causes canvas flicker, resets hover tooltips, and leaks `ResizeObserver` instances. Update `chart.data` and call `chart.update('none')` in place.
