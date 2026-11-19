# Basecoat UI, Dense Multi-Column Forms, & Accessible `<dialog>` Modals

Use this guide when building dense data studios, inventory trackers, triage boards, or multi-field card editors with **`naizo.js`** and **[Basecoat UI](https://basecoatui.com/)** (`basecoat-css`), or whenever a `naizo.js` application renders multi-column `<select>` / `<textarea>` grids and `<dialog>` modals.

---

## 1. Studio Shell & Clean `"theme": "system"` Sync (`D45`, `EC48`)

Basecoat UI styles components via semantic classes (`.card`, `.btn`, `.input`, `.select`, `.textarea`, `.badge`, `.dialog`) and activates dark mode when `<html>` has the `.dark` class.

To support automatic OS dark/light mode **and** a user theme toggle without dirtying `initialDiskDb` on boot (which would prematurely reveal the Status Pill's `↺ Reset` button before the user edits anything):

1. Store `"theme": "system"` in `<script id="naizodb">` (`fields.theme` or `custom.theme`).
2. Compute effective darkness from `theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)` and toggle `document.documentElement.classList.toggle('dark', isDark)` + `dataset.theme`.
3. Call `Naizo.setField('theme', next)` **only** inside the toggle button's `'click'` handler – never during initial boot. (`naizo.js`'s internal `MutationObserver` watches `<html>` `.dark` and `data-theme` automatically, keeping the frosted-glass Status Pill synchronized.)

```html
<!doctype html>
<html lang="en" data-theme="system" naizo-id="studio-slug">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Studio Title</title>

    <script id="naizodb" type="application/json">
      {
        "_meta": { "id": "studio-slug" },
        "fields": {
          "studio_title": "Inventory & Triage Studio",
          "theme": "system"
        },
        "lists": {
          "cards": []
        },
        "custom": {}
      }
    </script>

    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/basecoat-css@1.0.2/dist/basecoat.cdn.min.css"
    />
    <script src="https://cdn.jsdelivr.net/npm/naizojs@latest/dist/naizo.js" defer></script>
  </head>
  <body>
    <header class="topbar">
      <h1 contenteditable="true" naizo="studio_title">Inventory &amp; Triage Studio</h1>
      <button id="theme-toggle-btn" type="button" class="btn-sm-outline" naizo-ignore>
        Theme: <span id="theme-label">Auto</span>
      </button>
    </header>

    <script>
      const darkMq = window.matchMedia('(prefers-color-scheme: dark)');

      function applyStudioTheme() {
        const pref = String(Naizo.getField('theme') || 'system');
        const isDark = pref === 'dark' || (pref === 'system' && darkMq.matches);
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.dataset.theme = pref;
        const labelEl = document.getElementById('theme-label');
        if (labelEl) {
          labelEl.textContent = pref === 'system' ? 'Auto' : pref === 'dark' ? 'Dark' : 'Light';
        }
      }

      document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        const cur = String(Naizo.getField('theme') || 'system');
        const next = cur === 'system' ? 'dark' : cur === 'dark' ? 'light' : 'system';
        Naizo.setField('theme', next);
      });

      darkMq.addEventListener('change', applyStudioTheme);
      Naizo.ready(applyStudioTheme);
      window.addEventListener('naizo:hydrate', applyStudioTheme);
      window.addEventListener('naizo:change', applyStudioTheme);
    </script>
  </body>
</html>
```

---

## 2. CSS Grid Containment & Top-Aligned Resizable `.textarea` Controls

When pairing `basecoat.cdn.min.css` with dense multi-column `[naizo-item]` cards, include this compact reset block right after loading Basecoat:

```css
/* 1. Reserve bottom clearance so cards and buttons never sit under the Status Pill */
body {
  padding-bottom: 6rem;
}

/* 2. Strict CSS Grid track containment: prevents long <select> <option> labels from overflowing split-screen cards */
.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 0.85rem;
}

.field-grid > *,
.field-cell,
.field-label,
.input,
.select,
.textarea {
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

/* Suppress native OS arrow so standalone Basecoat .select renders only its built-in SVG chevron */
.select {
  appearance: none;
  -webkit-appearance: none;
}

/* Span full row cleanly at any column count without forcing an implicit 2nd column on mobile */
.field-span-full {
  grid-column: 1 / -1;
}

/* 3. Top-aligned, manually resizable side-by-side textareas */
.field-label {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.35rem;
}

.field-label > .textarea,
textarea.textarea {
  field-sizing: fixed;
  resize: vertical;
  min-height: 5.25rem;
  /* Do NOT set flex: 1 here — flex: 1 locks height and breaks drag-resizing */
}
```

Why each rule matters:

- **`.select` containment (`min-width: 0; max-width: 100%; width: 100%`) & `appearance: none` (`-webkit-appearance: none`):** Native `<select>` intrinsic width equals its longest `<option>` text. Without `min-width: 0` on both the grid track child and `.select`, long option labels blow out `1fr` card columns on `600px` split-screen windows. Adding `appearance: none; -webkit-appearance: none;` suppresses the browser's default OS arrow when loading `basecoat.cdn.min.css` standalone (without Tailwind Preflight) so Basecoat's SVG chevron never double-renders; also never set `display: block` on `<select>` (use `width: 100%` instead so Chromium's internal `inline-flex` `<select>` layout keeps the caret on one line).
- **`.field-span-full { grid-column: 1 / -1 }`:** Hardcoding inline `style="grid-column: span 2"` forces CSS Grid to create an implicit second track even on single-column mobile viewports; `1 / -1` spans all active tracks cleanly.
- **`field-sizing: fixed; resize: vertical` (no `flex: 1`):** Basecoat sets `field-sizing: content` on `.textarea`, which ignores `rows="3"` and makes side-by-side textareas uneven in height, while `flex: 1` locks `flex-basis` and disables the user's resize handle. Setting `field-sizing: fixed; resize: vertical` aligns top and bottom edges while keeping manual vertical resize smooth.

---

## 3. Unmistakable Empty vs. Filled vs. Clarified Triage Styling (`EC15`, `EC55`)

In audit, inventory, and triage tools, users must spot missing fields at a glance:

1. **Include `<option value="">— Empty (not set) —</option>` on every nullable `<select naizo="key">`:** While `naizo.js` sets `selectedIndex = -1` when `""` or `null` has no matching option (`EC55`), an explicit `<option value="">` lets users intentionally clear a field back to `""` and avoids confusion with Option #0.
2. **Use explicit empty markers in `placeholder`:** Use `placeholder="— Empty (not set) —"` styled in muted italic rather than realistic example URLs (`placeholder="https://github.com/org/repo"`), which look indistinguishable from real stored values in high-contrast themes.
3. **Sync `data-filled="true|false"` idempotently** on `Naizo.ready()`, `naizo:hydrate`, and `naizo:change`, and wrap bulk per-card actions (`Clarify Filled`, `Reset Clarified`) in `Naizo.batch()`:

```css
.input::placeholder,
.textarea::placeholder {
  font-style: italic;
  opacity: 0.65;
}

.field-cell[data-filled='false'] .input,
.field-cell[data-filled='false'] .select,
.field-cell[data-filled='false'] .textarea {
  border-style: dashed;
}

.field-cell[data-clarified='true'] {
  border-left: 3px solid #10b981;
  padding-left: 0.6rem;
}
```

```html
<div id="cards-list" naizo-list="cards" naizo-no-controls>
  <template naizo-template>
    <article class="card" naizo-item>
      <header class="card-header">
        <h3 naizo="name"></h3>
        <button type="button" class="btn-sm-outline" data-action="clarify-filled" naizo-ignore>
          ✓ Clarify Filled
        </button>
      </header>

      <details naizo="cardExpanded" open>
        <summary>Card Fields</summary>
        <div class="field-grid">
          <div class="field-cell">
            <label class="field-label">
              <span>Service Name</span>
              <input
                type="text"
                class="input"
                naizo="name"
                value="Untitled"
                placeholder="— Empty (not set) —"
              />
            </label>
            <label>
              <input type="checkbox" naizo="clarified_name" />
              <span>Clarified</span>
            </label>
          </div>

          <div class="field-cell">
            <label class="field-label">
              <span>Lifecycle Status</span>
              <select class="select" naizo="status">
                <option value="">— Empty (not set) —</option>
                <option value="Active">Active</option>
                <option value="Planned">Planned</option>
                <option value="Deprecated">Deprecated</option>
              </select>
            </label>
            <label>
              <input type="checkbox" naizo="clarified_status" />
              <span>Clarified</span>
            </label>
          </div>
        </div>
      </details>
    </article>
  </template>
</div>

<script>
  const TRACKED_KEYS = ['name', 'status'];
  const cardsListEl = document.getElementById('cards-list');

  function syncTriageState() {
    const cards = Naizo.getList('cards');
    cardsListEl.querySelectorAll(':scope > [naizo-item]').forEach((cardEl, idx) => {
      const card = cards[idx] || {};
      cardEl.querySelectorAll('.field-cell').forEach((cell) => {
        const ctrl = cell.querySelector('[naizo]:not([type="checkbox"])');
        const check = cell.querySelector('input[type="checkbox"][naizo^="clarified_"]');
        if (ctrl) {
          const key = ctrl.getAttribute('naizo');
          const filled = String(card[key] ?? '').trim() !== '';
          cell.dataset.filled = String(filled);
        }
        if (check) {
          const cKey = check.getAttribute('naizo');
          cell.dataset.clarified = String(Boolean(card[cKey]));
        }
      });
    });
  }

  cardsListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="clarify-filled"]');
    if (!btn) return;
    const rows = Array.from(cardsListEl.querySelectorAll(':scope > [naizo-item]'));
    const idx = rows.indexOf(btn.closest('[naizo-item]'));
    if (idx < 0) return;
    const card = Naizo.getList('cards')[idx] || {};
    Naizo.batch(() => {
      const patch = {};
      for (const k of TRACKED_KEYS) {
        if (String(card[k] ?? '').trim() !== '') patch[`clarified_${k}`] = true;
      }
      Naizo.updateItem('cards', idx, patch);
    });
  });

  Naizo.ready(syncTriageState);
  window.addEventListener('naizo:hydrate', syncTriageState);
  window.addEventListener('naizo:change', syncTriageState);
</script>
```

---

## 4. Accessible `<dialog class="dialog" naizo-ignore>` Modals & Backdrop Safety

Native HTML `<dialog>` modals work cleanly with Basecoat UI and `naizo.js` when three rules are followed:

1. **Always add `naizo-ignore` on `<dialog>`:** Scratch inputs inside `"Create Item"` or `"Add Custom Key"` modals are temporary form buffers, not standalone `db.fields` keys (`EC23`). `naizo-ignore` keeps the `<dialog>` markup intact in `Naizo.exportHTML()` / `⬇ Save to PC` while preventing `naizo.js` from binding its scratch inputs.
2. **Use drag-safe backdrop dismissal (`mousedown` + `click` target check):** Checking `e.target === dialogEl` on `'click'` alone accidentally closes the modal when a user drags to highlight text inside an `<input>` and releases the mouse button over the backdrop. Track whether `pointerdown` started on `dialogEl` itself.
3. **Close transient modals on submit/cancel** so an open `[open]` attribute is never left visible when exporting HTML:

```html
<dialog id="create-card-dialog" class="dialog" naizo-ignore aria-labelledby="create-dialog-title">
  <article>
    <header>
      <h2 id="create-dialog-title">New Inventory Item</h2>
    </header>
    <form id="create-card-form" method="dialog" class="form grid gap-4">
      <label class="field-label">
        <span>Name</span>
        <input id="new-card-name" type="text" class="input" required placeholder="Item name..." />
      </label>
      <footer>
        <button type="button" class="btn-outline" data-close-dialog>Cancel</button>
        <button type="submit" class="btn">Create Item</button>
      </footer>
    </form>
  </article>
</dialog>

<script>
  function wireDialogBackdrop(dialogEl) {
    let downOnBackdrop = false;
    dialogEl.addEventListener('pointerdown', (e) => {
      downOnBackdrop = e.target === dialogEl;
    });
    dialogEl.addEventListener('click', (e) => {
      if (downOnBackdrop && e.target === dialogEl) dialogEl.close();
      downOnBackdrop = false;
    });
    dialogEl.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => dialogEl.close());
    });
  }

  const createDialog = document.getElementById('create-card-dialog');
  wireDialogBackdrop(createDialog);

  document.getElementById('create-card-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('new-card-name');
    const name = nameEl.value.trim();
    if (!name) return;
    Naizo.addItem('cards', { id: 'card-' + Date.now(), name, status: '', cardExpanded: true });
    e.target.reset();
    createDialog.close();
  });
</script>
```

---

## 5. Pitfalls to Avoid & Why

- **Calling `Naizo.setField('theme', 'dark')` on boot when `matchMedia` is dark:** Mutates `store` away from `initialDiskDb` before the user touches anything, prematurely surfacing `↺ Reset` in Online Mode and unlinked Local Mode (`EC48`). Use `"theme": "system"` instead.
- **Putting `naizo-strip` instead of `naizo-ignore` on reusable `<dialog>` modals:** `naizo-strip` deletes the `<dialog>` element permanently when a user clicks `⬇ Save to PC` (`Naizo.downloadHTML()`), breaking modal buttons in the downloaded `.html` copy (`D47`).
- **Setting `flex: 1` on `.textarea` inside flex column labels:** Locks `flex-basis` and disables the browser's native vertical resize handle; use `field-sizing: fixed; resize: vertical; min-height: 5.25rem` instead.
- **Setting `display: block` on `<select>` or omitting `appearance: none` on standalone Basecoat `.select`:** `display: block` overrides Chromium's internal `inline-flex` `<select>` layout and wraps the dropdown caret onto a second line (use `width: 100%` instead), while loading `basecoat.cdn.min.css` without Tailwind Preflight renders double carets unless `.select` sets `appearance: none; -webkit-appearance: none;`.
- **Binding boolean `true` / `false` values to `<select class="select">`:** HTML `<select>` values are always strings (`"true"` / `"false"`). Use `<input type="checkbox">` for booleans, or store string enums on `<select>`.
- **Docking fixed toast notifications at `bottom: 1rem; right: 1rem`:** Collides with the default `bottom-right` Status Pill (`16px` inset). Place app toasts at `top-right` or `bottom-center` (or set `naizo-pill-corner="bottom-left"` when `bottom-right` hosts persistent app chrome, `D57`).
